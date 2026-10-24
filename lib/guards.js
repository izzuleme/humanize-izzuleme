import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

// ---- Pages (server components) -------------------------------------------
// Call at the top of every protected page. Layout-only checks are not enough
// in the App Router, so each page checks for itself.
export async function requirePageRole(role) {
  let session = null;
  try {
    session = await getSession();
  } catch (err) {
    console.error("session check failed:", err?.message);
  }

  if (!session) redirect("/login");

  if (session.role !== role) {
    redirect(session.role === "admin" ? "/admin/dashboard" : "/worker/dashboard");
  }

  return session;
}

// ---- API routes ------------------------------------------------------------
export function jsonError(message, status, extraHeaders = {}) {
  return NextResponse.json(
    { success: false, message },
    { status, headers: { "Cache-Control": "no-store", ...extraHeaders } }
  );
}

// Basic CSRF defence on top of SameSite=Lax cookies: if the browser sent an
// Origin header, it must match this site.
export function sameOriginOk(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// Returns { session } on success or { response } to return immediately.
export async function requireApiRole(request, role, { mutating = false } = {}) {
  if (mutating && !sameOriginOk(request)) {
    return { response: jsonError("Request ditolak.", 403) };
  }

  let session = null;
  try {
    session = await getSession();
  } catch (err) {
    console.error("session check failed:", err?.message);
    return { response: jsonError("Server error.", 500) };
  }

  if (!session) return { response: jsonError("Sila log masuk.", 401) };
  if (session.role !== role) return { response: jsonError("Tiada kebenaran.", 403) };

  return { session };
}
