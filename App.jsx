/**
 * App.jsx
 *
 * Root component. Owns the layout and passes data from useAppointments
 * down to child components.
 *
 * Layout: two-column on desktop (form left, dashboard right),
 * single-column on mobile (form above dashboard).
 */

import { useAppointments } from "./hooks/useAppointments";
import AppointmentForm from "./components/AppointmentForm";
import Dashboard from "./components/Dashboard";
import styles from "./App.module.css";

export default function App() {
  const {
    appointments,
    loading,
    submitting,
    error,
    refresh,
    addAppointment,
    removeAppointment,
  } = useAppointments();

  return (
    <div className={styles.app}>
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🗓</span>
          <span className={styles.logoText}>AppointmentIQ</span>
        </div>
        <div className={styles.headerMeta}>
          <span className={styles.poweredBy}>Powered by Twilio + Supabase</span>
        </div>
      </header>

      {/* ── Main layout ─────────────────────────────────────────── */}
      <main className={styles.main}>
        {/* Left column: booking form */}
        <aside className={styles.sidebar}>
          <AppointmentForm
            onSubmit={addAppointment}
            submitting={submitting}
          />

          {/* Info box */}
          <div className={styles.infoBox}>
            <h3 className={styles.infoTitle}>How it works</h3>
            <ol className={styles.infoList}>
              <li>Fill in the customer's name, phone, and appointment time.</li>
              <li>An SMS confirmation is sent instantly via Twilio.</li>
              <li>A reminder is automatically sent ~1 hour before the appointment.</li>
              <li>The dashboard updates live every 30 seconds.</li>
            </ol>
          </div>
        </aside>

        {/* Right column: dashboard */}
        <section className={styles.content}>
          <Dashboard
            appointments={appointments}
            loading={loading}
            error={error}
            onDelete={removeAppointment}
            onRefresh={refresh}
          />
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <span>AppointmentIQ · Built with React, Express, Supabase & Twilio</span>
      </footer>
    </div>
  );
}
