/**
 * AppointmentForm.jsx
 *
 * Controlled form for creating a new appointment.
 *
 * Validation strategy:
 *   - Client-side validation runs on submit (not on every keystroke) to
 *     reduce noise. We also show per-field errors after first submit attempt.
 *   - Server-side validation is the source of truth — the backend also
 *     validates via express-validator. If the server rejects it, we surface
 *     the error via react-hot-toast (handled in the hook).
 *
 * Phone number:
 *   - We require E.164 format (+12345678900) because that's what Twilio
 *     expects. The placeholder and helper text guide the user.
 */

import { useState } from "react";
import { getMinDateTime } from "../utils/dateUtils";
import styles from "./AppointmentForm.module.css";

const INITIAL_FORM = {
  customer_name:    "",
  phone_number:     "",
  appointment_time: "",
  notes:            "",
};

export default function AppointmentForm({ onSubmit, submitting }) {
  const [form, setForm]     = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState(false);

  // ── Validation ────────────────────────────────────────────────────────────

  function validate(data) {
    const errs = {};

    if (!data.customer_name.trim()) {
      errs.customer_name = "Name is required.";
    } else if (data.customer_name.trim().length < 2) {
      errs.customer_name = "Name must be at least 2 characters.";
    }

    if (!data.phone_number.trim()) {
      errs.phone_number = "Phone number is required.";
    } else if (!/^\+[1-9]\d{6,14}$/.test(data.phone_number.trim())) {
      errs.phone_number = "Use E.164 format: +12345678900 (country code + number, no spaces).";
    }

    if (!data.appointment_time) {
      errs.appointment_time = "Appointment time is required.";
    } else {
      const selected = new Date(data.appointment_time);
      if (selected <= new Date()) {
        errs.appointment_time = "Appointment must be in the future.";
      }
    }

    if (data.notes && data.notes.length > 500) {
      errs.notes = "Notes must be under 500 characters.";
    }

    return errs;
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleChange(e) {
    const { name, value } = e.target;
    const updated = { ...form, [name]: value };
    setForm(updated);
    // Re-validate on change only after first submit attempt
    if (touched) setErrors(validate(updated));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);

    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    // Convert datetime-local string to ISO 8601 (with timezone)
    const payload = {
      ...form,
      appointment_time: new Date(form.appointment_time).toISOString(),
    };

    const result = await onSubmit(payload);
    if (result?.success) {
      // Reset form on success
      setForm(INITIAL_FORM);
      setErrors({});
      setTouched(false);
    }
  }

  const minDateTime = getMinDateTime();

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.headerIcon}>📅</div>
        <div>
          <h2 className={styles.cardTitle}>New Appointment</h2>
          <p className={styles.cardSubtitle}>
            An SMS confirmation will be sent automatically.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className={styles.form}>
        {/* Customer Name */}
        <div className={styles.fieldGroup}>
          <label htmlFor="customer_name" className={styles.label}>
            Customer Name <span className={styles.required}>*</span>
          </label>
          <input
            id="customer_name"
            name="customer_name"
            type="text"
            className={`${styles.input} ${errors.customer_name ? styles.inputError : ""}`}
            placeholder="e.g. Jane Smith"
            value={form.customer_name}
            onChange={handleChange}
            autoComplete="name"
            maxLength={100}
          />
          {errors.customer_name && (
            <span className={styles.errorMsg}>{errors.customer_name}</span>
          )}
        </div>

        {/* Phone Number */}
        <div className={styles.fieldGroup}>
          <label htmlFor="phone_number" className={styles.label}>
            Phone Number <span className={styles.required}>*</span>
          </label>
          <input
            id="phone_number"
            name="phone_number"
            type="tel"
            className={`${styles.input} ${errors.phone_number ? styles.inputError : ""} ${styles.monoInput}`}
            placeholder="+12345678900"
            value={form.phone_number}
            onChange={handleChange}
            autoComplete="tel"
          />
          <span className={styles.hint}>
            Include country code. E.164 format required (e.g. +1 for US/Canada).
          </span>
          {errors.phone_number && (
            <span className={styles.errorMsg}>{errors.phone_number}</span>
          )}
        </div>

        {/* Appointment Time */}
        <div className={styles.fieldGroup}>
          <label htmlFor="appointment_time" className={styles.label}>
            Appointment Date & Time <span className={styles.required}>*</span>
          </label>
          <input
            id="appointment_time"
            name="appointment_time"
            type="datetime-local"
            className={`${styles.input} ${errors.appointment_time ? styles.inputError : ""}`}
            min={minDateTime}
            value={form.appointment_time}
            onChange={handleChange}
          />
          {errors.appointment_time && (
            <span className={styles.errorMsg}>{errors.appointment_time}</span>
          )}
        </div>

        {/* Notes (optional) */}
        <div className={styles.fieldGroup}>
          <label htmlFor="notes" className={styles.label}>
            Notes <span className={styles.optional}>(optional)</span>
          </label>
          <textarea
            id="notes"
            name="notes"
            className={`${styles.input} ${styles.textarea} ${errors.notes ? styles.inputError : ""}`}
            placeholder="e.g. Annual checkup, bring insurance card..."
            value={form.notes}
            onChange={handleChange}
            rows={3}
            maxLength={500}
          />
          <span className={styles.charCount}>{form.notes.length}/500</span>
          {errors.notes && (
            <span className={styles.errorMsg}>{errors.notes}</span>
          )}
        </div>

        <button
          type="submit"
          className={styles.submitBtn}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <span className={styles.spinner} />
              Booking...
            </>
          ) : (
            <>
              <span>📲</span>
              Book Appointment & Send SMS
            </>
          )}
        </button>
      </form>
    </div>
  );
}
