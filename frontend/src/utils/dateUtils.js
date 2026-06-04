/**
 * dateUtils.js
 *
 * Date formatting helpers used across the UI.
 * Using date-fns rather than moment.js because:
 *   - Tree-shakeable (we only import functions we use → smaller bundle)
 *   - Immutable (no global state mutation)
 *   - Well-maintained with TypeScript support
 */

import { format, formatDistanceToNow, isPast, isWithinInterval, addMinutes } from "date-fns";

/**
 * Format a date for display in the dashboard table.
 * e.g. "Mon, Jan 15, 2024 at 2:30 PM"
 */
export function formatAppointmentTime(isoString) {
  try {
    return format(new Date(isoString), "EEE, MMM d, yyyy 'at' h:mm a");
  } catch {
    return isoString;
  }
}

/**
 * Format a date for the "created X ago" display.
 * e.g. "about 2 hours ago"
 */
export function timeAgo(isoString) {
  try {
    return formatDistanceToNow(new Date(isoString), { addSuffix: true });
  } catch {
    return "";
  }
}

/**
 * Get a status label and colour for an appointment.
 * @returns {{ label: string, colour: string }}
 */
export function getAppointmentStatus(appointment) {
  const time = new Date(appointment.appointment_time);
  const now  = new Date();

  if (isPast(time)) {
    return { label: "Completed", colour: "#9898b0" };
  }

  // Within next 90 minutes → "Soon"
  if (isWithinInterval(time, { start: now, end: addMinutes(now, 90) })) {
    return { label: "Soon", colour: "#fbbf24" };
  }

  if (appointment.reminder_sent) {
    return { label: "Reminded", colour: "#60a5fa" };
  }

  return { label: "Scheduled", colour: "#4ade80" };
}

/**
 * Returns the minimum datetime-local value (now + 5 minutes)
 * for the appointment time input — prevents scheduling in the past.
 */
export function getMinDateTime() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 5);
  d.setSeconds(0, 0);
  // datetime-local input expects: "YYYY-MM-DDTHH:mm"
  return d.toISOString().slice(0, 16);
}
