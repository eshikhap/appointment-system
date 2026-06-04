/**
 * server.js
 *
 * Application entry point. Responsibilities:
 *   1. Load environment variables (must be first)
 *   2. Configure Express middleware stack
 *   3. Mount routes
 *   4. Start the HTTP server
 *   5. Start the reminder scheduler
 *   6. Register graceful shutdown handlers
 *
 * ── Why this order matters ────────────────────────────────────────────────────
 *   require("dotenv").config() MUST run before any module that reads
 *   process.env — that includes supabaseClient.js and twilioService.js.
 *   Node.js caches module exports, so if those modules load before dotenv
 *   runs, they'll see undefined for their env vars.
 */

require("dotenv").config(); // ← Must be first line

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const logger = require("./middleware/logger");
const errorHandler = require("./middleware/errorHandler");
const appointmentRoutes = require("./routes/appointmentRoutes");
const { startReminderScheduler } = require("./services/reminderScheduler");

// ── App configuration ─────────────────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 4000;

// ── Middleware stack ──────────────────────────────────────────────────────────

// Trust proxy headers (needed for accurate IP detection behind Render/Railway)
app.set("trust proxy", 1);

// CORS — only allow requests from our known frontend origin(s)
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  // Add additional origins here if needed (e.g., staging URL)
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, Postman, curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      logger.warn(`CORS blocked request from origin: ${origin}`);
      return callback(new Error(`CORS policy: origin ${origin} not allowed`));
    },
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false, // We're not using cookies/sessions
  })
);

// Parse incoming JSON bodies (limit size to prevent payload attacks)
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Global rate limiter — broad protection against brute-force/DDoS
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,                  // max 200 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please slow down." },
});
app.use(globalLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check — used by Render/Railway to confirm the app is alive
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "development",
  });
});

// Appointments API
app.use("/api/appointments", appointmentRoutes);

// 404 handler — catches any request that didn't match a route above
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found.`,
  });
});

// Centralised error handler (must be last middleware, with 4 args)
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  logger.info(`Appointments API: http://localhost:${PORT}/api/appointments`);

  // Start the cron-based reminder scheduler only after the server is up
  startReminderScheduler();
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// When the process receives SIGTERM (e.g., Render stopping the dyno) or SIGINT
// (Ctrl+C in dev), we close the HTTP server gracefully — allowing in-flight
// requests to complete before exiting. This prevents abrupt connection resets.

const shutdown = (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    logger.info("HTTP server closed. Exiting.");
    process.exit(0);
  });

  // Force exit if server hasn't closed after 10 seconds
  setTimeout(() => {
    logger.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10_000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

// Catch unhandled promise rejections so the process doesn't silently die
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Promise Rejection:", reason);
  // In production you might want to exit here and let the process manager restart:
  // process.exit(1);
});

module.exports = app; // Export for testing
