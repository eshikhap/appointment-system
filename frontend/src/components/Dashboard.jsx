/**
 * Dashboard.jsx
 *
 * Displays all appointments in a sortable, filterable table.
 * Data comes from the useAppointments hook (passed as props) — this
 * component is purely presentational.
 *
 * Features:
 *   - Live indicator (timestamp of last refresh)
 *   - Status badges (Scheduled / Soon / Reminded / Completed)
 *   - Delete with optimistic UI update
 *   - Empty / loading / error states
 *   - Manual refresh button
 */

import { useState } from "react";
import { formatAppointmentTime, timeAgo, getAppointmentStatus } from "../utils/dateUtils";
import styles from "./Dashboard.module.css";

export default function Dashboard({
  appointments,
  loading,
  error,
  onDelete,
  onRefresh,
}) {
  const [deletingId, setDeletingId] = useState(null);
  const [filter, setFilter]         = useState("all"); // "all" | "upcoming" | "past"

  // ── Filtering ────────────────────────────────────────────────────────────

  const now = new Date();
  const filtered = appointments.filter((appt) => {
    const t = new Date(appt.appointment_time);
    if (filter === "upcoming") return t >= now;
    if (filter === "past")     return t < now;
    return true;
  });

  // ── Stats ────────────────────────────────────────────────────────────────

  const total    = appointments.length;
  const upcoming = appointments.filter((a) => new Date(a.appointment_time) >= now).length;
  const reminded = appointments.filter((a) => a.reminder_sent).length;

  // ── Delete handler ────────────────────────────────────────────────────────

  async function handleDelete(id) {
    if (!window.confirm("Delete this appointment?")) return;
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.container}>
      {/* Stats row */}
      <div className={styles.stats}>
        <StatCard label="Total" value={total}    colour="var(--accent)" />
        <StatCard label="Upcoming" value={upcoming} colour="var(--success)" />
        <StatCard label="Reminded" value={reminded} colour="var(--info)" />
      </div>

      {/* Dashboard header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Appointments</h2>
          <div className={styles.liveIndicator}>
            <span className={styles.liveDot} />
            Live
          </div>
        </div>

        <div className={styles.controls}>
          {/* Filter tabs */}
          <div className={styles.filterTabs}>
            {["all", "upcoming", "past"].map((f) => (
              <button
                key={f}
                className={`${styles.filterTab} ${filter === f ? styles.filterTabActive : ""}`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Refresh button */}
          <button
            className={styles.refreshBtn}
            onClick={onRefresh}
            disabled={loading}
            title="Refresh appointments"
          >
            <span className={loading ? styles.spinIcon : ""}>↻</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        {error ? (
          <div className={styles.stateBox}>
            <span className={styles.stateIcon}>⚠️</span>
            <p className={styles.stateText}>Failed to load appointments.</p>
            <p className={styles.stateSubtext}>{error}</p>
            <button className={styles.retryBtn} onClick={onRefresh}>Retry</button>
          </div>
        ) : loading && appointments.length === 0 ? (
          <div className={styles.stateBox}>
            <span className={styles.loadSpinner} />
            <p className={styles.stateText}>Loading appointments...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.stateBox}>
            <span className={styles.stateIcon}>📭</span>
            <p className={styles.stateText}>
              {filter === "all"
                ? "No appointments yet. Book one above."
                : `No ${filter} appointments.`}
            </p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Appointment Time</th>
                <th>Status</th>
                <th>Booked</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((appt) => {
                const status = getAppointmentStatus(appt);
                return (
                  <tr key={appt.id} className={`${styles.row} fade-in`}>
                    <td className={styles.nameCell}>
                      <span className={styles.avatar}>
                        {appt.customer_name.charAt(0).toUpperCase()}
                      </span>
                      <span>{appt.customer_name}</span>
                    </td>
                    <td>
                      <span className={styles.phoneCell}>{appt.phone_number}</span>
                    </td>
                    <td className={styles.timeCell}>
                      {formatAppointmentTime(appt.appointment_time)}
                    </td>
                    <td>
                      <span
                        className={styles.badge}
                        style={{ "--badge-colour": status.colour }}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className={styles.agoCell}>{timeAgo(appt.created_at)}</td>
                    <td>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(appt.id)}
                        disabled={deletingId === appt.id}
                        title="Delete appointment"
                      >
                        {deletingId === appt.id ? "…" : "✕"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <p className={styles.countLine}>
          Showing {filtered.length} of {total} appointment{total !== 1 ? "s" : ""}
          {" · "}Auto-refreshes every 30s
        </p>
      )}
    </div>
  );
}

// ── Sub-component: stat card ──────────────────────────────────────────────────

function StatCard({ label, value, colour }) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statValue} style={{ color: colour }}>
        {value}
      </span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
