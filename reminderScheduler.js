/**
 * reminderScheduler.js
 *
 * Automatic 1-hour-before reminder system using node-cron.
 *
 * ── How it works ─────────────────────────────────────────────────────────────
 *   Every minute, a cron job runs and:
 *   1. Queries Supabase for appointments where:
 *      - reminder_sent = false  (hasn't been reminded yet)
 *      - appointment_time is between NOW+55min and NOW+65min
 *        (a 10-minute window centred on the 1-hour mark)
 *   2. For each matching appointment, sends the reminder SMS.
 *   3. Immediately marks reminder_sent = true in the database BEFORE
 *      awaiting the SMS send — this prevents duplicate sends if the
 *      scheduler fires twice in quick succession (race condition safety).
 *
 * ── Why a 10-minute window? ───────────────────────────────────────────────────
 *   A scheduler that fires every minute could theoretically miss an exact
 *   1-hour mark if the server is under load or restarts. A 10-minute window
 *   (55–65 minutes out) ensures we never miss a reminder while still feeling
 *   "about 1 hour" to the recipient.
 *
 * ── Duplicate prevention ─────────────────────────────────────────────────────
 *   The `reminder_sent` flag is the authoritative guard. We update it before
 *   sending the SMS (optimistic lock). If SMS then fails, we log the error but
 *   do NOT reset the flag — better to miss one SMS than spam the customer.
 *   In a higher-scale system you'd use a proper job queue with idempotency keys.
 */

const cron = require("node-cron");
const supabase = require("./supabaseClient");
const { sendReminder } = require("./twilioService");
const logger = require("../middleware/logger");

// ── Core scheduler function (exported for unit testing) ───────────────────────

async function checkAndSendReminders() {
  const now = new Date();

  // Define the reminder window: 55 → 65 minutes from now
  const windowStart = new Date(now.getTime() + 55 * 60 * 1000).toISOString();
  const windowEnd   = new Date(now.getTime() + 65 * 60 * 1000).toISOString();

  logger.debug(
    `[Scheduler] Checking reminders. Window: ${windowStart} → ${windowEnd}`
  );

  // Fetch appointments that need a reminder
  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id, customer_name, phone_number, appointment_time")
    .eq("reminder_sent", false)
    .gte("appointment_time", windowStart)
    .lte("appointment_time", windowEnd);

  if (error) {
    logger.error("[Scheduler] Error fetching appointments for reminders:", error.message);
    return; // Don't crash the scheduler — try again next minute
  }

  if (!appointments || appointments.length === 0) {
    logger.debug("[Scheduler] No reminders due this cycle.");
    return;
  }

  logger.info(`[Scheduler] Found ${appointments.length} appointment(s) to remind.`);

  // Process each appointment that needs a reminder
  for (const appt of appointments) {
    try {
      // ── Step 1: Mark as sent BEFORE sending SMS ────────────────────────────
      // This optimistic update is the key to preventing duplicate sends.
      // If the server restarts mid-loop and restarts the scheduler, this
      // appointment will already be marked and skipped on the next cycle.
      const { error: updateError } = await supabase
        .from("appointments")
        .update({
          reminder_sent: true,
          reminder_sent_at: new Date().toISOString(),
        })
        .eq("id", appt.id)
        .eq("reminder_sent", false); // Conditional update: only if still false
                                      // (extra guard against race conditions)

      if (updateError) {
        logger.error(
          `[Scheduler] Failed to mark reminder_sent for id=${appt.id}. ` +
          `Skipping to avoid potential duplicate. Error: ${updateError.message}`
        );
        continue; // Skip sending — better safe than duplicate
      }

      // ── Step 2: Send the reminder SMS ────────────────────────────────────
      const { sid, simulated } = await sendReminder(
        appt.phone_number,
        appt.customer_name,
        appt.appointment_time
      );

      logger.info(
        `[Scheduler] Reminder ${simulated ? "simulated" : "sent"} ` +
        `for appointment id=${appt.id} (SID: ${sid}).`
      );

      // Optionally store the reminder SID for auditing
      await supabase
        .from("appointments")
        .update({ reminder_twilio_sid: sid })
        .eq("id", appt.id);

    } catch (err) {
      // Log but don't re-throw — we want the loop to continue for other appointments
      logger.error(
        `[Scheduler] Failed to send reminder for id=${appt.id}: ${err.message}`
      );
    }
  }
}

// ── Start the cron job ────────────────────────────────────────────────────────

function startReminderScheduler() {
  // node-cron syntax: "* * * * *" = every minute
  // Docs: https://github.com/node-cron/node-cron#cron-syntax
  const job = cron.schedule("* * * * *", async () => {
    await checkAndSendReminders();
  });

  logger.info("[Scheduler] Reminder scheduler started. Checking every minute.");
  return job; // Return job so it can be stopped in tests or graceful shutdown
}

module.exports = { startReminderScheduler, checkAndSendReminders };
