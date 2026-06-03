/**
 * errorHandler.js
 *
 * Express error-handling middleware (must have 4 parameters so Express
 * recognises it as an error handler, not a regular middleware).
 *
 * Centralising error handling here means:
 *   - Route controllers only need to call next(err) — no try/catch boilerplate
 *   - We control exactly what information leaks to the client
 *   - In production, internal details stay server-side; the client only sees
 *     a sanitised message
 */

const logger = require("./logger");

const errorHandler = (err, req, res, next) => {
  // Log the full error (stack trace, etc.) server-side
  logger.error(`${req.method} ${req.path} — ${err.message}`, {
    stack: err.stack,
    status: err.statusCode,
  });

  // Use the error's own status code if set, otherwise default to 500
  const status = err.statusCode || err.status || 500;

  // In production we don't expose internal error messages for 5xx errors —
  // that would leak implementation details. For 4xx (client errors) we
  // always surface the message because it is meant to guide the caller.
  const message =
    process.env.NODE_ENV === "production" && status >= 500
      ? "An internal server error occurred. Please try again later."
      : err.message || "Something went wrong";

  return res.status(status).json({
    success: false,
    error: message,
  });
};

module.exports = errorHandler;
