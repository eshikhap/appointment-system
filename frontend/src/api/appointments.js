/**
 * api/appointments.js
 *
 * All HTTP calls to the backend go through this module.
 *
 * Design decisions:
 *   - Axios instance with a base URL from env variable. In development
 *     (Vite proxy), VITE_API_URL is undefined and we fall back to "" so
 *     requests go to /api/... which Vite proxies to localhost:4000.
 *   - In production (Vercel), VITE_API_URL must be set to the Render URL.
 *   - All functions return { data, error } objects — callers never need
 *     try/catch. This pattern (similar to Supabase's own SDK) makes error
 *     handling at the component level clean and consistent.
 */

import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : "/api",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000, // 15s — generous for cold-start on free Render tier
});

// ── Response interceptor ──────────────────────────────────────────────────────
// Normalise all Axios errors into a consistent { data: null, error: string }
// shape so components don't need to inspect err.response?.data?.error etc.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Extract the most useful error message available
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "An unexpected error occurred.";

    // Re-reject with a plain Error so callers can still use .message
    return Promise.reject(new Error(message));
  }
);

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * Fetch all appointments from the backend.
 * @returns {Promise<{data: Array|null, error: string|null}>}
 */
export async function fetchAppointments() {
  try {
    const res = await apiClient.get("/appointments");
    return { data: res.data.data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

/**
 * Create a new appointment.
 * @param {Object} payload - { customer_name, phone_number, appointment_time, notes? }
 * @returns {Promise<{data: Object|null, error: string|null}>}
 */
export async function createAppointment(payload) {
  try {
    const res = await apiClient.post("/appointments", payload);
    return { data: res.data.data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

/**
 * Delete an appointment by ID.
 * @param {string} id - UUID of the appointment
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function deleteAppointment(id) {
  try {
    await apiClient.delete(`/appointments/${id}`);
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
