import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  burnDummyCompare,
  hashPassword,
  verifyHash,
  verifyLegacyPlaintext,
} from "@/lib/password";

// Postgres "undefined_column" - happens if the SQL migration that adds
// worker_accounts.password_hash has not been run yet.
function isMissingColumn(error) {
  return error?.code === "42703" || /does not exist/i.test(error?.message || "");
}

async function findAccount(supabase, username) {
  let hashColumnAvailable = true;

  let res = await supabase
    .from("worker_accounts")
    .select("id, username, password, password_hash, role, worker_id")
    .eq("username", username)
    .limit(2);

  if (res.error && isMissingColumn(res.error)) {
    // Migration not run yet: keep legacy logins working instead of locking
    // everyone out.
    hashColumnAvailable = false;
    res = await supabase
      .from("worker_accounts")
      .select("id, username, password, role, worker_id")
      .eq("username", username)
      .limit(2);
  }

  if (res.error) throw new Error("account lookup failed");

  const rows = res.data || [];
  // Duplicate usernames are ambiguous: fail closed.
  if (rows.length !== 1) return { account: null, hashColumnAvailable };

  return { account: rows[0], hashColumnAvailable };
}

// Upgrade a legacy plaintext row to a bcrypt hash after a successful login.
async function migrateToHash(supabase, account, plain) {
  try {
    const password_hash = await hashPassword(plain);

    let { error } = await supabase
      .from("worker_accounts")
      .update({ password_hash, password: null })
      .eq("id", account.id);

    if (error) {
      // password column may still be NOT NULL: store the hash at least.
      ({ error } = await supabase
        .from("worker_accounts")
        .update({ password_hash })
        .eq("id", account.id));
    }

    if (error) console.error("password migration failed for account", account.id);
  } catch {
    console.error("password migration failed for account", account.id);
  }
}

/**
 * Verifies credentials. Returns { id, username, role, workerId } on success,
 * or null for ANY failure (unknown user, wrong password, wrong role) so the
 * caller cannot leak which part failed. Throws only on infrastructure errors.
 */
export async function authenticate(username, password, requiredRole) {
  const supabase = getSupabaseAdmin();
  const { account, hashColumnAvailable } = await findAccount(supabase, username);

  if (!account) {
    await burnDummyCompare(password);
    return null;
  }

  let ok = false;
  let needsMigration = false;

  if (hashColumnAvailable && account.password_hash) {
    // A hash always wins; plaintext is never accepted once a hash exists.
    ok = await verifyHash(password, account.password_hash);
  } else if (account.password) {
    ok = verifyLegacyPlaintext(password, account.password);
    needsMigration = ok && hashColumnAvailable;
  } else {
    await burnDummyCompare(password);
  }

  if (!ok) return null;

  if (account.role !== requiredRole) return null;
  if (account.role === "worker" && account.worker_id == null) return null;
  if (account.role !== "admin" && account.role !== "worker") return null;

  if (needsMigration) await migrateToHash(supabase, account, password);

  return {
    id: account.id,
    username: account.username,
    role: account.role,
    workerId: account.worker_id ?? null,
  };
}
