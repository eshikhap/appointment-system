/**
 * supabaseClient.js
 *
 * Creates and exports a single Supabase client instance using the
 * SERVICE ROLE key (not the anon key).
 *
 * Why the service role key on the backend?
 *   - The service role key bypasses Row Level Security (RLS), which is what
 *     we want for a trusted server process — we do our own authorisation.
 *   - The anon key is for browser clients; it respects RLS policies.
 *   - NEVER expose the service role key in the frontend.
 *
 * Why a singleton?
 *   - Creating a new client per request wastes memory and connection pool
 *     resources. A module-level singleton is created once and reused.
 */

const { createClient } = require("@supabase/supabase-js");
const logger = require("../middleware/logger");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  // Fail fast at startup — a missing credential is a configuration error,
  // not something we can recover from at runtime.
  logger.error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Disable automatic token refresh — we're a server process, not a browser
    persistSession: false,
    autoRefreshToken: false,
  },
});

module.exports = supabase;
