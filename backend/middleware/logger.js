/**
 * logger.js
 *
 * Centralised Winston logger used throughout the application.
 * Using a dedicated logger (rather than console.log) gives us:
 *   - Timestamped, levelled output in development
 *   - JSON-structured output in production (easy to pipe into log aggregators)
 *   - A single place to adjust verbosity without hunting down console.logs
 */

const { createLogger, format, transports } = require("winston");

const { combine, timestamp, printf, colorize, errors } = format;

// Human-readable format for local development
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack }) => {
    return stack
      ? `[${timestamp}] ${level}: ${message}\n${stack}`
      : `[${timestamp}] ${level}: ${message}`;
  })
);

// JSON format for production (structured logs play nicely with Render/Railway)
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  format.json()
);

const logger = createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: process.env.NODE_ENV === "production" ? prodFormat : devFormat,
  transports: [new transports.Console()],
});

module.exports = logger;
