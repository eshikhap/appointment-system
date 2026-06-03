# Submission Package — AppointmentIQ

---

## PROJECT DESCRIPTION (for GitHub / Cover Letter)

**AppointmentIQ** is a full-stack SMS appointment reminder system built with React, Node.js/Express, Supabase, and Twilio. Users enter a customer name, phone number, and appointment time through a clean web form; the backend immediately saves the appointment to a PostgreSQL database and fires an SMS confirmation via Twilio. A background cron scheduler checks every minute for appointments within the 1-hour window and automatically sends reminder messages — using a conditional database update as an optimistic lock to prevent duplicate sends. The live dashboard polls the API every 30 seconds and reflects real-time data including reminder status.

---

## 5–10 SENTENCE PROJECT EXPLANATION
(Use this verbatim in your written submission)

I built this system using React + Vite on the frontend, Node.js/Express on the backend, Supabase (managed PostgreSQL) as the database, and Twilio for SMS delivery. Data flows from the form → client-side validation → Express API (server-side validation via express-validator) → Supabase insert → non-blocking Twilio API call → HTTP 201 response with the saved record. I separated concerns into controllers, services, and routes so each layer has a single responsibility and can be tested or swapped independently. The reminder scheduler is a node-cron job that fires every minute, queries for appointments 55–65 minutes out with `reminder_sent = false`, marks the flag true before sending (to prevent duplicates on restart), then fires the Twilio call. The frontend uses a custom React hook to own all state and API calls, keeping components purely presentational. The hardest part was the race condition in the scheduler — I solved it with a conditional UPDATE (`WHERE reminder_sent = false`) that acts as an optimistic lock, ensuring only one process can claim responsibility for sending a given reminder. If Twilio credentials aren't configured, the system runs in simulation mode and logs the full message payload to the console, so the send logic can be reviewed without real credentials. The entire project took approximately 6–7 hours to architect, build, and test.

---

## RESUME BULLET POINTS

- Built a full-stack appointment reminder system in Node.js/Express + React with Supabase (PostgreSQL) and Twilio SMS; system sends automatic confirmation and 1-hour reminders with duplicate-prevention via optimistic database locking
- Implemented a node-cron background scheduler with race condition safety — conditional UPDATE pattern ensures each reminder fires exactly once even across server restarts
- Designed a React dashboard with optimistic UI updates, auto-polling, and error recovery; frontend state managed via a custom hook separating data-fetching from presentation
- Applied production security practices: allowlist CORS, per-endpoint rate limiting, server-side validation, no mass assignment, secrets in environment variables only

---

## HONEST TIME ESTIMATE

| Phase | Time |
|---|---|
| Architecture planning | ~1 hour |
| Backend (server, routes, controllers, services) | ~2.5 hours |
| Frontend (form, dashboard, hooks, styles) | ~2 hours |
| Deployment config + README | ~45 minutes |
| Testing & debugging | ~45 minutes |
| **Total** | **~7 hours** |

---

## DEMO VIDEO SCRIPT

**[0:00 – 0:20] Introduction**
"Hi, I'm [name]. I'm going to walk you through AppointmentIQ, the SMS appointment reminder system I built for this practical test. I'll cover the live app, how data flows, and the code — starting with the scheduler's race condition solution, which was the most technically interesting problem."

**[0:20 – 1:00] Live form submission**
Open the app. Fill in: Name = "Sarah Johnson", Phone = "+15551234567", Time = 2 hours from now.
"Notice the phone number is in E.164 format — that's what Twilio requires. Let me submit..."
Show the success toast. "Confirmation SMS sent. Let's look at the Twilio dashboard to confirm."
Switch to Twilio console and show the sent message.

**[1:00 – 1:45] Dashboard**
"The dashboard just updated. Here's Sarah's appointment with status 'Scheduled'. The status is computed from the appointment time relative to now — let me show you that utility function..."
Show `dateUtils.js`, `getAppointmentStatus`.

**[1:45 – 2:45] Database**
Open Supabase table editor. "The row is actually in the database — customer_name, phone_number, appointment_time, reminder_sent is false, twilio_sid is populated."
Show the `reminder_sent` and `reminder_sent_at` columns.

**[2:45 – 4:00] Reminder scheduler walkthrough**
Open `reminderScheduler.js`. "This is the most important file. Let me walk you through it..."
- Explain the 55-65 minute window (why not exactly 60)
- Explain why `reminder_sent = true` is set BEFORE calling Twilio
- Explain the `WHERE reminder_sent = false` in the UPDATE (optimistic lock)

**[4:00 – 4:30] Code quality examples**
Show `twilioService.js` simulation mode. "If you don't have Twilio credentials, the app doesn't crash — it logs exactly what would be sent."
Show `errorHandler.js`. "All errors flow through one middleware. 5xx errors never expose internals in production."

**[4:30 – 5:00] Wrap-up**
"The full source is on GitHub at [link]. Happy to answer any questions about any line of code."

---

## RECRUITER SUBMISSION MESSAGE

Subject: Practical Test Submission — AI Automation Developer

Hi [Name],

Please find my completed practical test submission below.

**Live App:** https://your-app.vercel.app
**GitHub:** https://github.com/yourusername/appointmentiq
**Demo Video:** [Loom/YouTube link]

**What I built:**
A full-stack SMS appointment reminder system using React + Vite (frontend), Node.js/Express (backend), Supabase (database), and Twilio (SMS). It includes the booking form, confirmation SMS on submit, a live dashboard reading directly from Supabase, and the bonus 1-hour automatic reminder scheduler.

**Tech choices and reasoning:**
- Supabase: managed PostgreSQL with a great JS SDK, no infrastructure overhead on the free tier
- Twilio: industry standard for SMS, and the system runs in simulation mode if credentials aren't configured so the send logic is always reviewable
- node-cron: simple, dependency-light scheduler appropriate for this scale
- React + Vite: fast dev experience, component-based for clean separation of concerns

**Hardest problem solved:**
The reminder scheduler's race condition — ensuring reminders fire exactly once even if the server restarts mid-cycle. Solution: mark `reminder_sent = true` before sending, using a conditional UPDATE as an optimistic lock.

**Time taken:** ~7 hours

I'm ready to walk through any part of the code on a call. Looking forward to your feedback.

Best,
[Your Name]
[Phone]
[Email]
