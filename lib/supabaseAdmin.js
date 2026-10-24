import { createClient } from "@supabase/supabase-js";

// SERVER ONLY. This client uses the service role key and bypasses Row Level
// Security. Never import this file from a "use client" component, and never
// give the key a NEXT_PUBLIC_ prefix.

let client = null;

export function getSupabaseAdmin() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return client;
}
