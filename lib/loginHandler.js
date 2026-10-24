import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { applySessionCookie, signSessionToken } from "@/lib/session";
import { checkLimit, clearKey, clientIp, recordFailure } from "@/lib/rateLimit";
import { jsonError, sameOriginOk } from "@/lib/guards";

const BAD_CREDENTIALS = "Username atau password salah.";
const MAX_PER_ACCOUNT = 5;
const MAX_PER_IP = 20;

// Shared by /api/admin/login and /api/worker/login. `role` is fixed by the
// route, never read from the request body.
export async function handleLogin(request, role) {
  if (!sameOriginOk(request)) return jsonError("Request ditolak.", 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("Permintaan tidak sah.", 400);
  }

  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || !password) {
    return jsonError("Sila isi username dan password.", 400);
  }
  if (username.length > 64 || password.length > 200) {
    return jsonError(BAD_CREDENTIALS, 401);
  }

  const ip = clientIp(request);
  const accountKey = `${role}:${ip}:${username.toLowerCase()}`;
  const ipKey = `${role}:ip:${ip}`;

  const a = checkLimit(accountKey, MAX_PER_ACCOUNT);
  const b = checkLimit(ipKey, MAX_PER_IP);
  if (!a.allowed || !b.allowed) {
    const retryAfter = Math.max(a.retryAfter, b.retryAfter);
    return jsonError(
      "Terlalu banyak percubaan. Sila cuba lagi sebentar.",
      429,
      { "Retry-After": String(retryAfter) }
    );
  }

  let account;
  try {
    account = await authenticate(username, password, role);
  } catch (err) {
    console.error("login error:", err?.message);
    return jsonError("Server error. Sila cuba lagi.", 500);
  }

  if (!account) {
    recordFailure(accountKey);
    recordFailure(ipKey);
    return jsonError(BAD_CREDENTIALS, 401);
  }

  clearKey(accountKey);

  let token;
  try {
    token = signSessionToken(account.id);
  } catch (err) {
    console.error("session signing error:", err?.message);
    return jsonError("Server error. Sila cuba lagi.", 500);
  }

  const response = NextResponse.json(
    {
      success: true,
      role: account.role,
      redirectTo: role === "admin" ? "/admin/dashboard" : "/worker/dashboard",
    },
    { headers: { "Cache-Control": "no-store" } }
  );

  return applySessionCookie(response, token);
}
