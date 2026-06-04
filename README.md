# 🗓 AppointmentIQ — SMS Appointment Reminder System

> A full-stack appointment scheduling system that sends automatic SMS confirmations and reminders via Twilio, backed by Supabase, served by a Node.js/Express API, and presented through a React/Vite frontend.

---

## 📸 Live Demo

- **Frontend:** `https://dancing-rolypoly-c22480.netlify.app`
- **API Health:** `https://appointment-api-8m0k.onrender.com/health`

---

## ✨ Features

| Feature | Status |
|---|---|
| Appointment booking form (name, phone, time, notes) | ✅ |
| SMS confirmation sent instantly via Twilio | ✅ |
| Live dashboard pulling real data from Supabase | ✅ |
| Status badges: Scheduled / Soon / Reminded / Completed | ✅ |
| **BONUS:** Automatic 1-hour-before reminder (cron scheduler) | ✅ |
| Duplicate reminder prevention (`reminder_sent` flag) | ✅ |
| Input validation (client + server side) | ✅ |
| Optimistic UI updates | ✅ |
| Rate limiting & security headers | ✅ |
| Graceful shutdown & error handling | ✅ |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         DATA FLOW                           │
└─────────────────────────────────────────────────────────────┘

 User fills form
       │
       ▼
 React Frontend (Vite)
 • Client-side validation
 • POST /api/appointments
       │
       ▼
 Express Backend (Node.js)
 • express-validator (server validation)
 • appointmentController.createAppointment()
       │
       ├──► Supabase INSERT → appointments table
       │         │
       │         └── Returns created row (id, timestamps)
       │
       └──► twilioService.sendConfirmation()  ← non-blocking
                 │
                 └── Twilio REST API → SMS to customer
       │
       ▼
 HTTP 201 response with appointment data
       │
       ▼
 React updates dashboard (optimistic + re-fetch)


 Every 60 seconds:
 ┌─────────────────────────────────────────────┐
 │  node-cron scheduler fires                  │
 │  → Query Supabase:                          │
 │    WHERE reminder_sent = false              │
 │    AND appointment_time BETWEEN             │
 │        (now + 55min) AND (now + 65min)      │
 │  → For each result:                         │
 │    1. UPDATE reminder_sent = true (first!)  │
 │    2. twilioService.sendReminder()          │
 └─────────────────────────────────────────────┘
```

### Folder Structure

```
appointment-system/
├── backend/
│   ├── controllers/
│   │   └── appointmentController.js   # Business logic
│   ├── middleware/
│   │   ├── errorHandler.js            # Centralised error handling
│   │   └── logger.js                  # Winston logger
│   ├── routes/
│   │   └── appointmentRoutes.js       # Express router + validation rules
│   ├── services/
│   │   ├── supabaseClient.js          # Singleton Supabase client
│   │   ├── twilioService.js           # SMS send/simulation
│   │   └── reminderScheduler.js      # node-cron reminder system
│   ├── server.js                      # App entry point
│   ├── .env.example
│   ├── package.json
│   └── render.yaml                    # Render deployment config
│
└── frontend/
    ├── src/
    │   ├── api/
    │   │   └── appointments.js        # Axios HTTP client
    │   ├── components/
    │   │   ├── AppointmentForm.jsx    # Booking form
    │   │   ├── AppointmentForm.module.css
    │   │   ├── Dashboard.jsx          # Live appointments table
    │   │   └── Dashboard.module.css
    │   ├── hooks/
    │   │   └── useAppointments.js     # State management hook
    │   ├── utils/
    │   │   └── dateUtils.js           # date-fns helpers
    │   ├── App.jsx                    # Root layout
    │   ├── App.module.css
    │   ├── index.css                  # Global styles + CSS variables
    │   └── main.jsx                   # React entry point
    ├── index.html
    ├── vite.config.js
    ├── vercel.json
    └── .env.example
```

---

## 🗄 Database Setup (Supabase)

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a new project, and note your **Project URL** and **Service Role Key** (under Settings → API).

### 2. Run this SQL in the SQL Editor

```sql
-- appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name       TEXT NOT NULL CHECK (char_length(customer_name) BETWEEN 2 AND 100),
  phone_number        TEXT NOT NULL CHECK (phone_number ~ '^\+[1-9]\d{6,14}$'),
  appointment_time    TIMESTAMPTZ NOT NULL,
  notes               TEXT CHECK (char_length(notes) <= 500),

  -- Twilio tracking
  twilio_sid          TEXT,
  reminder_sent       BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_sent_at    TIMESTAMPTZ,
  reminder_twilio_sid TEXT,

  -- Audit
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Index for the scheduler query (reminder_sent + appointment_time)
CREATE INDEX idx_appointments_reminder
  ON appointments (reminder_sent, appointment_time)
  WHERE reminder_sent = FALSE;

-- Index for dashboard ordering
CREATE INDEX idx_appointments_time
  ON appointments (appointment_time ASC);
```

### 3. Enable Row Level Security

Since the backend uses the service role key (which bypasses RLS), you can enable RLS to block direct anonymous access:

```sql
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
-- Service role key bypasses RLS — no policies needed for the backend.
-- Add policies if you ever add user authentication.
```

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

```env
PORT=4000
NODE_ENV=development

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_NUMBER=+12345678900

FRONTEND_URL=http://localhost:5173
```

### Frontend (`frontend/.env`)

```env
# Production only — in dev, Vite proxies /api/* to localhost:4000
VITE_API_URL=https://your-backend.onrender.com
```

---

## 🚀 Local Development

### Prerequisites
- Node.js ≥ 18
- A Supabase project (free tier works)
- A Twilio account (or leave credentials blank for simulation mode)

### Start Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev
# → Server running on http://localhost:4000
```

### Start Frontend

```bash
cd frontend
npm install
npm run dev
# → App running on http://localhost:5173
```

The Vite dev server proxies `/api/*` requests to `localhost:4000`, so no CORS issues in development.

---



## 📱 Twilio Setup

### Trial Account Setup

1. Sign up at [twilio.com](https://twilio.com) (free trial gives ~$15 credit).
2. Verify your personal phone number (you can only SMS verified numbers on trial).
3. Get a Twilio phone number (free with trial).
4. Copy **Account SID**, **Auth Token**, and your Twilio number.
5. Use E.164 format for all numbers: `+12345678900`.

### WhatsApp 

To use WhatsApp instead of SMS, change `TWILIO_FROM_NUMBER` to `whatsapp:+14155238886` (Twilio sandbox) and prefix the recipient number with `whatsapp:` in `twilioService.js`.

### Simulation Mode

If you don't have Twilio credentials, the app runs in **simulation mode** — messages are logged to the console with full details of what *would* be sent. The send logic is identical; only the actual API call is skipped. This lets reviewers verify the implementation is correct without real credentials.

---

## 🧪 Testing Checklist

### Manual End-to-End Test

- [ ] Fill in form with valid name, phone (+E.164), and future date → Submit
- [ ] Verify 201 response and appointment appears in dashboard
- [ ] Check Twilio console for confirmation SMS (or server logs for simulation)
- [ ] Verify `appointment_time` stored in Supabase table
- [ ] Delete an appointment → verifies it's removed from DB and dashboard
- [ ] Set appointment time to 60 minutes from now → wait for scheduler → verify reminder sent and `reminder_sent = true` in DB

### Edge Cases

- [ ] Submit with empty name → validation error shown
- [ ] Submit with invalid phone (`1234`) → validation error shown
- [ ] Submit with past date → validation error shown
- [ ] Submit form twice rapidly → only one record created (rate limiting)
- [ ] Kill backend and refresh dashboard → error state shown with retry button
- [ ] Create appointment 55-65 min out → confirm reminder fires once, not twice



## 🔒 Security Decisions

| Concern | Implementation |
|---|---|
| SQL injection | Supabase parameterised queries (no raw SQL from user input) |
| Mass assignment | Controller explicitly lists allowed columns — `req.body` is never spread directly into DB calls |
| Payload flooding | `express.json({ limit: '10kb' })` |
| Rate limiting | Per-IP rate limiting on create endpoint (20/15min) + global (200/15min) |
| CORS | Allowlist-based — only the deployed frontend origin is permitted |
| Secret exposure | Service role key never reaches the frontend; env vars never committed |
| Information leakage | 500 errors return generic messages in production |

---



This project uses React + Vite on the frontend for a fast, component-based UI with CSS Modules for scoped styling. The backend is Node.js + Express — lightweight, widely understood, and easy to deploy on Render's free tier. Supabase provides a managed PostgreSQL database with a clean JavaScript SDK and no infrastructure overhead. Twilio handles SMS delivery and runs in simulation mode when credentials aren't present, so the send logic is verifiable without spending money.

Data flows from the form → validated on the client → sent to the Express API → validated again server-side → inserted into Supabase → a non-blocking Twilio call fires the confirmation SMS → the frontend gets a 201 response and updates the dashboard optimistically. The reminder scheduler is a node-cron job that runs every minute and queries for appointments 55–65 minutes out with `reminder_sent = false`. Critically, it marks `reminder_sent = true` *before* calling Twilio to prevent duplicate sends even if the scheduler restarts mid-loop.

The hardest part was the race condition in the scheduler: if two scheduler ticks somehow overlapped (e.g., a slow DB query causes the next tick to fire), the same reminder could send twice. The solution is a conditional Supabase update — `UPDATE ... WHERE id = ? AND reminder_sent = false` — which acts as an optimistic lock. Only one update succeeds; the other finds no rows to update and skips sending.

**Time taken: approximately 10 hours** (architecture: 2h, backend: 3h, frontend: 2.5h, deployment/testing: 2h).

---

## 📄 License

MIT — free to use, modify, and deploy.
