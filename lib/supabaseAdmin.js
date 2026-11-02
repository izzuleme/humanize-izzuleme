import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client. This module can only be imported by server code
// ("server-only" makes the build fail if a client component imports it).
export const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export const BUCKET = "order-files";
