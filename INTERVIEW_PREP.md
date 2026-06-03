# AppointmentIQ — Interview Preparation Guide

This document prepares you to answer any technical question the interviewer might ask,
including the most important test: "Point at random code and explain it."

---

## THE MOST IMPORTANT DRILL

The interviewer WILL share screen, point to a random function, and say:
**"Explain exactly what this does and why you wrote it this way."**

Rehearse these answers until they're natural. Don't memorise them word-for-word —
understand the reasoning so you can explain it differently each time.

---

## File-by-File Breakdown

---

### `server.js`

**What it does:**
Entry point for the entire backend. It loads environment variables, sets up Express
middleware (CORS, JSON parsing, rate limiting), mounts the routes, starts the HTTP server,
and starts the reminder scheduler. It also registers graceful shutdown handlers for SIGTERM
and SIGINT.

**Why `require("dotenv").config()` is the very first line:**
Node.js caches module imports. If `supabaseClient.js` or `twilioService.js` load before
dotenv runs, they'll read `undefined` for their env vars and either crash or run in the
wrong mode. Dotenv must fire before any other `require()` that touches `process.env`.

**Why graceful shutdown?**
Render (and any PaaS) sends SIGTERM before killing a container. Without a shutdown handler,
in-flight HTTP requests get brutally cut off mid-response. `server.close()` waits for
existing connections to finish before the process exits. The 10-second timeout is a safety
valve — if something is stuck, we don't hang forever.

**Interview question:** *"Why did you put `require('dotenv').config()` at the top of server.js
instead of in a separate config file?"*
**Answer:** Because `dotenv.config()` must execute before any module that reads `process.env`.
Node module loading is synchronous and cached — the instant another module is `require()`d,
it runs and reads env vars. If dotenv hasn't fired yet, those reads return `undefined`.
Putting it first in server.js guarantees it runs before anything else.

---

### `services/supabaseClient.js`

**What it does:**
Creates a single Supabase client instance using the service role key and exports it.
Any file that needs database access imports this module and gets the same instance.

**Why the service role key (not the anon key)?**
The anon key is designed for browser clients and respects Row Level Security policies.
The service role key bypasses RLS — which is correct for a trusted server process where
we do our own access control. **The service role key must never be exposed to the browser.**

**Why `persistSession: false`?**
Session persistence is for browser clients that need to store auth tokens across page
refreshes. A server process doesn't need this — it's stateless between requests.
Disabling it prevents unnecessary localStorage access attempts (which don't exist in Node).

**Why fail-fast with `process.exit(1)`?**
If credentials are missing, the entire application is non-functional. It's better to
crash immediately with a clear error than to start up and silently fail on every database
call. Fail fast, fail loudly.

---

### `services/twilioService.js`

**What it does:**
Wraps the Twilio REST client. Exports `sendConfirmation()` and `sendReminder()`.
If Twilio credentials are missing, runs in simulation mode — logging what *would* be sent.

**Why simulation mode instead of crashing?**
A missing Twilio credential shouldn't stop the entire app from running. The database
and dashboard still work. The simulation mode lets reviewers verify the send logic
is correct by reading the server logs, even without real credentials.

**Why does `sendConfirmation` use `toLocaleString` instead of raw ISO format?**
"Your appointment is at 2024-01-15T14:00:00.000Z" is unreadable to a customer.
`toLocaleString` with explicit options produces "Monday, January 15, 2024 at 2:00 PM EST"
— exactly what a human would want in an SMS.

**Interview question:** *"Why did you separate sendConfirmation and sendReminder into
two functions instead of one generic sendMessage function?"*
**Answer:** Single responsibility. `sendConfirmation` and `sendReminder` have different
message templates, different timing contexts, and might evolve independently — for example,
the reminder might eventually include a reschedule link. By naming them for their purpose,
the code is self-documenting. The internal `sendMessage` function is the shared
implementation detail — it's private to this module.

---

### `services/reminderScheduler.js`

**What it does:**
A node-cron job that fires every minute. It queries Supabase for appointments that:
1. Have `reminder_sent = false`
2. Have `appointment_time` between NOW+55min and NOW+65min

For each match, it marks `reminder_sent = true` first, then sends the SMS.

**Why mark `reminder_sent = true` BEFORE sending the SMS?**
This is the most important design decision in the scheduler. If we sent the SMS first,
then crashed before updating the database, the next scheduler tick would find the same
appointment (still `reminder_sent = false`) and send the SMS again — duplicate!

By updating the flag first (optimistic lock), even a crash-and-restart scenario won't
cause a duplicate. The tradeoff: if the SMS send fails after the flag is set, we don't
retry automatically (the customer misses their reminder). In production you'd add a retry
queue. But for this system, "no duplicate" is more important than "guaranteed delivery."

**Why a 10-minute window (55-65 min) instead of exactly 60 minutes?**
Cron jobs aren't perfectly precise. Under server load, a minute-cron might fire at T+61
or T+63. If the window were exactly "60 minutes out," any drift would cause a miss.
A 10-minute window centered on 60 minutes (55-65) ensures we never miss a reminder while
still feeling like "about 1 hour" to the recipient.

**Why the conditional UPDATE (`WHERE reminder_sent = false`)?**
This is a second layer of protection against race conditions. The `WHERE reminder_sent = false`
clause means: "only update this row if it hasn't been marked yet." If two scheduler
instances ran in parallel (shouldn't happen, but defensive coding), only one UPDATE
would match — the other would update 0 rows and skip sending.

**Interview question:** *"What happens if the server restarts right after updating
reminder_sent to true but before the SMS sends?"*
**Answer:** The customer misses their reminder SMS. The appointment stays in the database
with `reminder_sent = true`, so the scheduler won't retry. This is an acceptable tradeoff
for a first version — we prioritise preventing spam over guaranteeing delivery. The
production fix is a job queue like BullMQ with at-least-once delivery semantics and
idempotency keys. I made this tradeoff consciously and would have added the queue with
more time.

---

### `controllers/appointmentController.js`

**What it does:**
Contains the business logic for all appointment CRUD operations.
`createAppointment` validates, inserts into Supabase, fires a non-blocking SMS, and responds.

**Why is `sendConfirmation` not awaited in `createAppointment`?**
SMS sends can take 1-3 seconds. If we `await` it, the user stares at a loading spinner
for that entire time. By firing it non-blocking (`.then()/.catch()` on a non-awaited
Promise), the HTTP response goes back immediately with the saved data. The SMS delivers
asynchronously. If it fails, we log it — the appointment is still valid and confirmed.

**Why explicit column listing in the INSERT instead of spreading req.body?**
```js
// BAD — mass assignment vulnerability:
.insert([req.body])

// GOOD — explicit columns:
.insert([{ customer_name, phone_number, appointment_time, notes }])
```
If a malicious caller adds `{ reminder_sent: true, created_at: "1970-01-01" }` to their
request body, the explicit version ignores those fields completely.

---

### `routes/appointmentRoutes.js`

**What it does:**
Defines Express routes and attaches express-validator middleware for input validation.
The rate limiter specifically on the POST route prevents someone from flooding Twilio
(which costs money per message).

**Why validate in the route, not the controller?**
Validation describes the shape of an acceptable HTTP request — that's an HTTP/routing
concern. Business logic belongs in the controller. If we later added a WebSocket or CLI
interface that calls the same controller, the controller shouldn't care about HTTP-specific
validation.

**Why reject past appointment times with a 5-minute grace window?**
A user who fills the form, gets distracted for 2 minutes, then submits would be
infuriating to reject with "appointment is in the past." The 5-minute grace window
catches genuine past dates while allowing minor form-filling delays.

---

### `hooks/useAppointments.js` (Frontend)

**What it does:**
Custom React hook that centralises all appointment state (list, loading, submitting, error)
and all operations (refresh, add, delete). Components receive data and callbacks — they
never call the API directly.

**Why optimistic updates?**
Without optimistic updates, the user clicks "Delete" and the row stays visible for ~500ms
while the API call completes. With optimistic updates, the row disappears instantly —
the UI feels immediate. If the API call fails, we restore the previous state (rollback)
and show an error toast.

**Why auto-poll every 30 seconds?**
The scheduler runs server-side. When it updates `reminder_sent = true`, the frontend
doesn't know. Auto-polling keeps the dashboard fresh without requiring WebSockets (which
would add complexity). 30 seconds is a reasonable balance — frequent enough to feel live,
infrequent enough not to hammer the API.

**Why `mountedRef` check?**
If a component unmounts (user navigates away) while an async operation is in progress,
React will warn about setting state on an unmounted component. The `mountedRef` check
prevents this.

---

### `api/appointments.js` (Frontend)

**What it does:**
Configures an Axios instance with the correct base URL and a response interceptor.
Exports typed async functions (`fetchAppointments`, `createAppointment`, `deleteAppointment`).

**Why a response interceptor?**
Without it, every API call would need:
```js
try {
  const res = await axios.post(...)
  // handle response
} catch (err) {
  const msg = err.response?.data?.error || err.response?.data?.message || err.message || "Unknown"
  // handle error
}
```
The interceptor normalises all errors into a plain `Error` with a `.message` — callers
just need `err.message`. DRY principle.

**Why `{ data, error }` return pattern (instead of throw)?**
Copied from Supabase's own SDK design. Components can write:
```js
const { data, error } = await createAppointment(payload)
if (error) { /* handle */ }
```
...instead of wrapping every call in try/catch. Cleaner, more functional.

---

## Common Interview Questions & Answers

**Q: How would you scale this to 10,000 appointments per day?**
A: Replace the polling dashboard with Supabase Realtime (WebSocket-based). Move the
cron scheduler to a dedicated worker process or BullMQ queue so it doesn't block the
web server. Add database connection pooling (PgBouncer). Use Twilio's message queuing
for high-volume sends to avoid rate limits.

**Q: What if the Render server restarts? Do reminders get lost?**
A: No — the scheduler reads from the database on every tick. After a restart, the next
tick re-queries Supabase and picks up any pending reminders. There's no in-memory state
that's lost on restart. This is intentional stateless design.

**Q: Why not use WebSockets for the live dashboard?**
A: Polling every 30 seconds is simpler, has zero extra dependencies, and is perfectly
adequate for this use case (appointment updates are infrequent). WebSockets add connection
management complexity and reconnection logic. I'd add Supabase Realtime if sub-5-second
latency became a requirement.

**Q: How do you prevent a customer from being reminded twice?**
A: Three layers: (1) The `reminder_sent` database flag is the authoritative guard.
(2) The scheduler query explicitly filters `WHERE reminder_sent = false`.
(3) The UPDATE uses a conditional `WHERE reminder_sent = false` clause (optimistic lock),
so concurrent scheduler instances can't both process the same appointment.

**Q: What's the most important thing you'd add next?**
A: A proper job queue (BullMQ/Redis) for SMS delivery with retry logic and dead-letter
handling. Currently if Twilio is down when a confirmation or reminder fires, the message
is simply lost. A queue would retry up to N times before alerting an admin.
