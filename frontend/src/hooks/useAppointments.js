/**
 * useAppointments.js
 *
 * Custom React hook that owns all appointment state and operations.
 *
 * Why a custom hook?
 *   - Separates data-fetching logic from UI components. Components become
 *     pure presentational — they receive data and callbacks, never call
 *     the API directly.
 *   - Makes logic reusable and testable in isolation.
 *   - Polled auto-refresh: the dashboard re-fetches every 30 seconds so
 *     it reflects changes made in other browser tabs or by the scheduler.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import {
  fetchAppointments,
  createAppointment,
  deleteAppointment,
} from "../api/appointments";

const POLL_INTERVAL_MS = 30_000; // Refresh dashboard every 30 seconds

export function useAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState(null);

  // Ref to track if the component is still mounted before setting state
  // (prevents "can't update state on unmounted component" warnings)
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Fetch / refresh ─────────────────────────────────────────────────────────

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data, error: fetchError } = await fetchAppointments();

    if (!mountedRef.current) return;

    if (fetchError) {
      setError(fetchError);
      if (!silent) toast.error(`Failed to load appointments: ${fetchError}`);
    } else {
      setAppointments(data || []);
      setError(null);
    }

    setLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-poll for live dashboard updates
  useEffect(() => {
    const interval = setInterval(() => {
      refresh(true); // silent = true → don't show loading spinner on auto-refresh
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval); // Clean up on unmount
  }, [refresh]);

  // ── Create ──────────────────────────────────────────────────────────────────

  const addAppointment = useCallback(async (formData) => {
    setSubmitting(true);

    const { data, error: createError } = await createAppointment(formData);

    if (!mountedRef.current) return;
    setSubmitting(false);

    if (createError) {
      toast.error(createError);
      return { success: false };
    }

    // Optimistically prepend to local state so the user sees instant feedback,
    // then trigger a silent refresh to ensure server state is canonical.
    setAppointments((prev) => [data, ...prev].sort(
      (a, b) => new Date(a.appointment_time) - new Date(b.appointment_time)
    ));
    toast.success(`✓ Appointment booked for ${data.customer_name}! SMS sent.`);
    refresh(true);
    return { success: true };
  }, [refresh]);

  // ── Delete ──────────────────────────────────────────────────────────────────

  const removeAppointment = useCallback(async (id) => {
    // Optimistic delete: remove from UI immediately, restore on failure
    const previous = appointments;
    setAppointments((prev) => prev.filter((a) => a.id !== id));

    const { success, error: deleteError } = await deleteAppointment(id);

    if (!mountedRef.current) return;

    if (!success) {
      setAppointments(previous); // Rollback
      toast.error(`Failed to delete: ${deleteError}`);
    } else {
      toast.success("Appointment deleted.");
    }
  }, [appointments]);

  return {
    appointments,
    loading,
    submitting,
    error,
    refresh,
    addAppointment,
    removeAppointment,
  };
}
