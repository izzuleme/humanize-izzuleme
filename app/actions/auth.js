"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabaseAdmin";
import {
  createSession, destroySession, getSession, homeFor, loginFor, hashPassword, verifyHash, burnTime,
  validatePassword, safeEqual, requireRole, revokeAccountSessions, escapeLike, MAX_ATTEMPTS, LOCK_MINUTES,
} from "@/lib/auth";

const GENERIC = "Invalid username or password.";
const LOCKED = "Too many failed attempts. Try again in 15 minutes.";

async function fail(table, row) {
  const attempts = (row.failed_attempts || 0) + 1;
  const patch = attempts >= MAX_ATTEMPTS
    ? { failed_attempts: 0, locked_until: new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() }
    : { failed_attempts: attempts };
  await db.from(table).update(patch).eq("id", row.id);
}

// Existing accounts that still hold a legacy plaintext password are upgraded on first
// successful login (only matters if migration 001 has not hashed them yet).
async function staffPasswordOk(a, pw) {
  if (a.password_hash) return verifyHash(pw, a.password_hash);
  if (a.password && safeEqual(a.password, pw)) {
    await db.from("worker_accounts")
      .update({ password_hash: await hashPassword(pw), password: null, password_changed_at: new Date().toISOString() })
      .eq("id", a.id);
    return true;
  }
  await burnTime(pw);
  return false;
}

export async function loginAction(_prev, formData) {
  const kind = String(formData.get("kind") || "");
  const ident = String(formData.get("identifier") || "").trim();
  const pw = String(formData.get("password") || "");
  if (!["customer", "worker", "admin"].includes(kind) || !ident || !pw || pw.length > 200 || ident.length > 200) {
    return { error: GENERIC };
  }

  const table = kind === "customer" ? "customers" : "worker_accounts";
  const col = kind === "customer" ? "email" : "username";
  let { data: row } = await db.from(table).select("*").ilike(col, escapeLike(ident)).maybeSingle();
  if (row && kind !== "customer" && row.role !== kind) row = null; // worker page never admits admins and vice versa

  if (!row) { await burnTime(pw); return { error: GENERIC }; }
  if (row.locked_until && new Date(row.locked_until) > new Date()) return { error: LOCKED };

  const ok = kind === "customer" ? await verifyHash(pw, row.password_hash) : await staffPasswordOk(row, pw);
  if (!ok) { await fail(table, row); return { error: GENERIC }; }
  if (row.status !== "active") return { error: "This account is not active. Please contact the administrator." };

  await db.from(table).update({ failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() }).eq("id", row.id);
  await createSession({ kind: kind === "customer" ? "customer" : "staff", accountId: row.id, role: kind });
  redirect(row.must_change_password ? "/account/password" : homeFor(kind));
}

export async function registerAction(_prev, formData) {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phone = String(formData.get("phone") || "").trim().slice(0, 30);
  const pw = String(formData.get("password") || "");
  if (name.length < 2 || name.length > 100) return { error: "Please enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return { error: "Please enter a valid email." };
  const pwErr = validatePassword(pw);
  if (pwErr) return { error: pwErr };

  const { data: exists } = await db.from("customers").select("id").ilike("email", escapeLike(email)).maybeSingle();
  if (exists) return { error: "An account with this email already exists." };
  const { data, error } = await db.from("customers")
    .insert({ name, email, phone: phone || null, password_hash: await hashPassword(pw), password_changed_at: new Date().toISOString() })
    .select("id").single();
  if (error) return { error: "Could not create the account." };
  await createSession({ kind: "customer", accountId: data.id, role: "customer" });
  redirect("/portal");
}

export async function logoutAction() {
  const s = await getSession();
  await destroySession();
  redirect(loginFor(s?.role || "customer"));
}

export async function changePasswordAction(_prev, formData) {
  const s = await requireRole(["customer", "worker", "admin"], { allowMustChange: true });
  const current = String(formData.get("current") || "");
  const next = String(formData.get("next") || "");
  const confirm = String(formData.get("confirm") || "");
  if (next !== confirm) return { error: "New passwords do not match." };
  const pwErr = validatePassword(next);
  if (pwErr) return { error: pwErr };
  if (next === current) return { error: "Choose a different password from the current one." };

  const table = s.kind === "customer" ? "customers" : "worker_accounts";
  const { data: row } = await db.from(table).select("*").eq("id", s.accountId).single();
  const ok = s.kind === "customer" ? await verifyHash(current, row.password_hash) : await staffPasswordOk(row, current);
  if (!ok) return { error: "Current password is incorrect." };

  await db.from(table).update({
    password_hash: await hashPassword(next), password_changed_at: new Date().toISOString(),
    ...(s.kind === "staff" ? { must_change_password: false, password: null } : {}),
  }).eq("id", s.accountId);
  await revokeAccountSessions(s.kind, s.accountId, s.sessionId); // sign out every other device
  redirect(homeFor(s.role));
}
