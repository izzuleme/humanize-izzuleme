import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db } from "./supabaseAdmin";

const COOKIE = "session";
const TTL_HOURS = { customer: 24 * 7, worker: 12, admin: 8 };
const HOME = { customer: "/portal", worker: "/worker/dashboard", admin: "/admin/dashboard" };
const LOGIN = { customer: "/login", worker: "/worker/login", admin: "/admin/login" };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(s);
}

export const homeFor = (role) => HOME[role] || "/login";
export const loginFor = (role) => LOGIN[role] || "/login";

// ---------- passwords ----------
export const hashPassword = (pw) => bcrypt.hash(pw, 12);
export const verifyHash = (pw, hash) => bcrypt.compare(pw, hash);
// dummy compare so "unknown user" costs the same as "wrong password"
const DUMMY = bcrypt.hashSync("not-a-real-password", 12);
export const burnTime = (pw) => bcrypt.compare(pw, DUMMY);

export function validatePassword(pw) {
  if (typeof pw !== "string" || pw.length < 10) return "Password must be at least 10 characters.";
  if (pw.length > 200) return "Password is too long.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Use letters and at least one number.";
  return null;
}
export function tempPassword() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) out += a[crypto.randomInt(a.length)];
  return out + "7";
}
export function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ---------- sessions ----------
export async function createSession({ kind, accountId, role }) {
  const hours = TTL_HOURS[role];
  const expires = new Date(Date.now() + hours * 3600_000);
  const { data, error } = await db
    .from("sessions")
    .insert({ account_kind: kind, account_id: String(accountId), role, expires_at: expires.toISOString() })
    .select("id")
    .single();
  if (error) throw new Error("Could not create session");
  const token = await new SignJWT({ role, kind })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(data.id)
    .setSubject(String(accountId))
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function revokeAccountSessions(kind, accountId, exceptSessionId = null) {
  let q = db.from("sessions").update({ revoked_at: new Date().toISOString() })
    .eq("account_kind", kind).eq("account_id", String(accountId)).is("revoked_at", null);
  if (exceptSessionId) q = q.neq("id", exceptSessionId);
  await q;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret());
      await db.from("sessions").update({ revoked_at: new Date().toISOString() }).eq("id", payload.jti);
    } catch {}
  }
  jar.delete(COOKIE);
}

// Verifies signature + server-side session row + that the account is STILL active.
// Suspending a worker therefore takes effect on their very next request.
export const getSession = cache(async () => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  let payload;
  try {
    ({ payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] }));
  } catch {
    return null;
  }
  const { data: s } = await db.from("sessions").select("*").eq("id", payload.jti).maybeSingle();
  if (!s || s.revoked_at || new Date(s.expires_at) < new Date()) return null;
  if (s.account_id !== payload.sub || s.role !== payload.role) return null;

  if (s.account_kind === "customer") {
    const { data: c } = await db.from("customers").select("*").eq("id", s.account_id).maybeSingle();
    if (!c || c.status !== "active") return null;
    return { sessionId: s.id, role: "customer", kind: "customer", accountId: c.id, name: c.name, mustChange: false };
  }
  const { data: a } = await db.from("worker_accounts").select("*").eq("id", s.account_id).maybeSingle();
  if (!a || a.status !== "active" || a.role !== s.role) return null;
  return {
    sessionId: s.id, role: a.role, kind: "staff", accountId: a.id, workerId: a.worker_id ?? null,
    name: a.display_name || a.username, username: a.username, mustChange: !!a.must_change_password,
  };
});

// Call at the top of EVERY page and server action. UI hiding is never the control.
export async function requireRole(roles, { allowMustChange = false } = {}) {
  const s = await getSession();
  const first = roles[0];
  if (!s) redirect(loginFor(first));
  if (!roles.includes(s.role)) redirect(homeFor(s.role)); // customers/workers bounced to their own portal
  if (s.mustChange && !allowMustChange) redirect("/account/password");
  if (s.role === "worker" && s.workerId == null) redirect("/worker/login");
  return s;
}

// Basic anti-brute-force shared by all login flows.
export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export function escapeLike(s) {
  return s.replace(/[\\%_]/g, (c) => "\\" + c);
}
