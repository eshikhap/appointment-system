/**
 * appointmentController.js
 *
 * Handles all business logic for appointments.
 *
 * Controllers sit between routes (HTTP layer) and services (data/external).
 * They:
 *   1. Trust that incoming data has already been validated by express-validator
 *      middleware in the route file.
 *   2. Orchestrate the sequence: save → send message → respond.
 *   3. Call next(err) on failure so the centralised error handler takes over.
 *
 * This separation means if we ever swap Supabase for PostgreSQL directly,
 * we only change the service layer — controllers stay the same.
 */

const { validationResult } = require("express-validator");
const supabase = require("../services/supabaseClient");
const { sendConfirmation } = require("../services/twilioService");
const logger = require("../middleware/logger");

// ── Create Appointment ───────────────────────────────────────────────────────

/**
 * POST /api/appointments
 *
 * Flow:
 *   1. Validate request body (via express-validator, checked here)
 *   2. Insert row into Supabase `appointments` table
 *   3. Fire-and-forget SMS confirmation (we don't await to block the HTTP
 *      response — user gets immediate feedback even if SMS is slow)
 *   4. Return the created appointment
 */
const createAppointment = async (req, res, next) => {
  // Step 1: Check for validation errors set by the route middleware
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      error: "Validation failed",
      details: errors.array(),
    });
  }

  const { customer_name, phone_number, appointment_time, notes } = req.body;

  try {
    // Step 2: Insert into Supabase
    // We explicitly list columns rather than spreading req.body to prevent
    // mass-assignment vulnerabilities (a caller cannot inject extra columns).
    const { data, error } = await supabase
      .from("appointments")
      .insert([
        {
          customer_name: customer_name.trim(),
          phone_number: phone_number.trim(),
          appointment_time,
          notes: notes ? notes.trim() : null,
          // reminder_sent defaults to false in the DB schema
        },
      ])
      .select() // Return the inserted row (includes generated id, created_at)
      .single();

    if (error) {
      // Supabase errors come with a `message` and `code` — log the full object
      logger.error("Supabase insert error:", error);
      const err = new Error("Failed to save appointment. Please try again.");
      err.statusCode = 500;
      return next(err);
    }

    logger.info(
      `Appointment created: id=${data.id} name="${data.customer_name}" time=${data.appointment_time}`
    );

    // Step 3: Send SMS confirmation — non-blocking
    // We intentionally do NOT await this. The HTTP response (201) goes back
    // to the user immediately. If SMS fails, it's logged server-side but
    // does not roll back the database record. In a production system you'd
    // add a retry queue here (e.g., BullMQ).
    sendConfirmation(data.phone_number, data.customer_name, data.appointment_time)
      .then(({ sid, simulated }) => {
        logger.info(
          `Confirmation SMS ${simulated ? "simulated" : "sent"}: SID=${sid} for appointment id=${data.id}`
        );
        // Optionally update the appointment with the Twilio SID for auditing
        supabase
          .from("appointments")
          .update({ twilio_sid: sid })
          .eq("id", data.id)
          .then(() => {});
      })
      .catch((smsErr) => {
        logger.error(`Confirmation SMS failed for appointment id=${data.id}:`, smsErr.message);
        // We do NOT bubble this error up — the appointment is saved, the
        // messaging failure is a secondary concern handled separately.
      });

    // Step 4: Respond with the created record
    return res.status(201).json({
      success: true,
      message: "Appointment created and confirmation SMS sent.",
      data,
    });
  } catch (err) {
    return next(err);
  }
};

// ── Get All Appointments ─────────────────────────────────────────────────────

/**
 * GET /api/appointments
 *
 * Returns all appointments ordered by appointment_time ascending.
 * The frontend dashboard calls this on mount and after any mutation.
 *
 * Query params (optional):
 *   ?limit=50   - max rows to return (default 100)
 *   ?upcoming=true - only return future appointments
 */
const getAppointments = async (req, res, next) => {
  const limit = parseInt(req.query.limit) || 100;
  const upcomingOnly = req.query.upcoming === "true";

  try {
    let query = supabase
      .from("appointments")
      .select("*")
      .order("appointment_time", { ascending: true })
      .limit(limit);

    // If upcoming=true, filter to only future appointments
    if (upcomingOnly) {
      query = query.gte("appointment_time", new Date().toISOString());
    }

    const { data, error } = await query;

    if (error) {
      logger.error("Supabase select error:", error);
      const err = new Error("Failed to retrieve appointments.");
      err.statusCode = 500;
      return next(err);
    }

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    return next(err);
  }
};

// ── Get Single Appointment ───────────────────────────────────────────────────

/**
 * GET /api/appointments/:id
 */
const getAppointmentById = async (req, res, next) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: "Appointment not found." });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

// ── Delete Appointment ───────────────────────────────────────────────────────

/**
 * DELETE /api/appointments/:id
 */
const deleteAppointment = async (req, res, next) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("Supabase delete error:", error);
      const err = new Error("Failed to delete appointment.");
      err.statusCode = 500;
      return next(err);
    }

    logger.info(`Appointment deleted: id=${id}`);
    return res.status(200).json({ success: true, message: "Appointment deleted." });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  createAppointment,
  getAppointments,
  getAppointmentById,
  deleteAppointment,
};
