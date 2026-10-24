// One-off: converts every plaintext password in worker_accounts to a bcrypt
// hash and clears the plaintext column. Never prints any password.
//
//   node --env-file=.env.local scripts/hash-passwords.mjs --dry-run
//   node --env-file=.env.local scripts/hash-passwords.mjs
//
// Requires the SQL migration (supabase/auth_migration.sql) to have been run.

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "node:url";

export async function run({ supabase, dryRun = false, log = console.log }) {
  const { data: rows, error } = await supabase
    .from("worker_accounts")
    .select("id, username, password, password_hash")
    .is("password_hash", null)
    .not("password", "is", null);

  if (error) throw new Error(`Query failed (${error.code}). Did you run the SQL migration?`);

  let migrated = 0;
  for (const row of rows) {
    if (!row.password) continue;
    if (dryRun) {
      log(`[dry-run] would hash account ${row.id} (${row.username})`);
      continue;
    }
    const password_hash = await bcrypt.hash(row.password, 12);
    const { error: upErr } = await supabase
      .from("worker_accounts")
      .update({ password_hash, password: null })
      .eq("id", row.id)
      .is("password_hash", null);
    if (upErr) throw new Error(`Update failed for account ${row.id} (${upErr.code})`);
    log(`hashed account ${row.id} (${row.username})`);
    migrated++;
  }
  log(dryRun ? `Dry run: ${rows.length} account(s) pending.` : `Done: ${migrated} account(s) migrated.`);
  return migrated;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  run({ supabase, dryRun: process.argv.includes("--dry-run") }).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
