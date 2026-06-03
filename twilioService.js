/**
 * twilioService.js
 *
 * Thin wrapper around the Twilio REST client.
 *
 * Design decisions:
 *   - All Twilio logic lives here. Routes/controllers never import Twilio
 *     directly. This makes it trivial to swap the messaging provider later
 *     (e.g., switch to WhatsApp Cloud API) by changing only this file.
 *   - We export named functions (`sendConfirmation`, `sendReminder`) rather
 *     than exposing the raw client, so callers use a domain vocabulary.
 *   - If Twilio credentials are missing we log a warning and fall back to
 *     simulation mode instead of crashing the whole server. This lets the
 *     app run fully in development without real credentials.
 */

const logger = require("../middleware/logger");

// ── Twilio client initialisation ─────────────────────────────────────────────

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;

let twilioClient = null;
let simulationMode = false;

if (!accountSid || !authToken || !fromNumber) {
  logger.warn(
    "Twilio credentials not fully configured. Running in SIMULATION MODE — " +
      "messages will be logged to the console but not actually sent. " +
      "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER to enable real sends."
  );
  simulationMode = true;
} else {
  twilioClient = require("twilio")(accountSid, authToken);
  logger.info(`Twilio initialised. Messages will be sent from ${fromNumber}`);
}

// ── Internal helper ──────────────────────────────────────────────────────────

/**
 * sendMessage
 *
 * Low-level send function. All public exports delegate here.
 *
 * @param {string} to   - Recipient phone in E.164 format (+12345678900)
 *                        OR WhatsApp format (whatsapp:+12345678900)
 * @param {string} body - Message text
 * @returns {Promise<{sid: string, simulated: boolean}>}
 */
async function sendMessage(to, body) {
  if (simulationMode) {
    // In simulation mode we log exactly what *would* be sent so a reviewer
    // can verify the logic is correct without needing real credentials.
    logger.info("──────────────── SIMULATED SMS ────────────────");
    logger.info(`  TO:   ${to}`);
    logger.info(`  FROM: ${fromNumber || "(not configured)"}`);
    logger.info(`  BODY: ${body}`);
    logger.info("────────────────────────────────────────────────");
    return { sid: `SIMULATED_${Date.now()}`, simulated: true };
  }

  // Real Twilio send ─────────────────────────────────────────────────────────
  // The `from` and `to` fields support both SMS (+1...) and WhatsApp
  // (whatsapp:+1...) format — Twilio detects the channel automatically.
  const message = await twilioClient.messages.create({
    from: fromNumber,
    to,
    body,
  });

  logger.info(`SMS sent successfully. SID: ${message.sid} → ${to}`);
  return { sid: message.sid, simulated: false };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * sendConfirmation
 *
 * Called immediately after a new appointment is saved.
 *
 * @param {string} to              - Recipient phone number (E.164)
 * @param {string} customerName    - Customer's display name
 * @param {string} appointmentTime - ISO 8601 string of the appointment
 */
async function sendConfirmation(to, customerName, appointmentTime) {
  // Format the date in a human-friendly way for the SMS body
  const formattedTime = new Date(appointmentTime).toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const body =
    `Hello ${customerName}, your appointment has been confirmed for ` +
    `${formattedTime}. ` +
    `Reply STOP to opt out of reminders.`;

  return sendMessage(to, body);
}

/**
 * sendReminder
 *
 * Called by the scheduler ~1 hour before the appointment.
 *
 * @param {string} to              - Recipient phone number (E.164)
 * @param {string} customerName    - Customer's display name
 * @param {string} appointmentTime - ISO 8601 string of the appointment
 */
async function sendReminder(to, customerName, appointmentTime) {
  const formattedTime = new Date(appointmentTime).toLocaleString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const body =
    `Reminder: Hi ${customerName}, your appointment is in approximately 1 hour ` +
    `(${formattedTime}). Please arrive 5 minutes early. ` +
    `Reply STOP to opt out.`;

  return sendMessage(to, body);
}

module.exports = { sendConfirmation, sendReminder };
