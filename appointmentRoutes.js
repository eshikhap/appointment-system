/**
 * appointmentRoutes.js
 *
 * Defines all HTTP routes for appointments and attaches
 * express-validator middleware for input validation.
 *
 * Validation strategy:
 *   - We validate at the route layer (not in the controller) because
 *     validation is an HTTP concern — it describes the shape of an
 *     acceptable request, not business logic.
 *   - express-validator collects errors; the controller checks them with
 *     validationResult() and returns a 422 if any fail.
 *   - Phone number: we accept any E.164-ish string with optional spaces/dashes
 *     rather than imposing strict US-only rules, since this is an
 *     international system.
 */

const express = require("express");
const { body, param } = require("express-validator");
const rateLimit = require("express-rate-limit");
const {
  createAppointment,
  getAppointments,
  getAppointmentById,
  deleteAppointment,
} = require("../controllers/appointmentController");

const router = express.Router();

// ── Rate limiting ────────────────────────────────────────────────────────────
// Prevent abuse of the create endpoint (e.g., mass message flooding via Twilio)
const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // max 20 appointment creates per IP per window
  message: {
    success: false,
    error: "Too many appointments created from this IP. Please wait 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Validation rules ─────────────────────────────────────────────────────────

const createAppointmentValidation = [
  body("customer_name")
    .trim()
    .notEmpty().withMessage("Customer name is required.")
    .isLength({ min: 2, max: 100 }).withMessage("Name must be between 2 and 100 characters."),

  body("phone_number")
    .trim()
    .notEmpty().withMessage("Phone number is required.")
    .matches(/^\+?[1-9]\d{6,14}$/).withMessage(
      "Phone number must be in E.164 format (e.g. +12345678900). " +
      "Include country code, no spaces or dashes."
    ),

  body("appointment_time")
    .notEmpty().withMessage("Appointment time is required.")
    .isISO8601().withMessage("Appointment time must be a valid ISO 8601 date-time string.")
    .custom((value) => {
      // Reject appointments in the past (with a 5-minute grace window)
      const apptTime = new Date(value).getTime();
      const now = Date.now() - 5 * 60 * 1000; // 5 min grace
      if (apptTime < now) {
        throw new Error("Appointment time cannot be in the past.");
      }
      return true;
    }),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Notes must be under 500 characters."),
];

const idValidation = [
  param("id")
    .isUUID().withMessage("Appointment ID must be a valid UUID."),
];

// ── Routes ───────────────────────────────────────────────────────────────────

// GET  /api/appointments       → list all appointments
router.get("/", getAppointments);

// GET  /api/appointments/:id   → get one appointment
router.get("/:id", idValidation, getAppointmentById);

// POST /api/appointments       → create new appointment + send SMS
router.post("/", createLimiter, createAppointmentValidation, createAppointment);

// DELETE /api/appointments/:id → delete appointment
router.delete("/:id", idValidation, deleteAppointment);

module.exports = router;
