import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const SESSION_COOKIE = "wr_session";
const SESSION_HOURS = 8;
const ISSUER = "worker-rotation";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET is missing or shorter than 32 characters");
  }
  return secret;
}

// The token only carries the account id. Role and worker_id are ALWAYS
// re-read from the database in getSession(), so a token can never be used to
// claim a role, and demoting/deleting an account takes effect immediately.
export function signSessionToken(accountId) {
  return jwt.sign({ sub: String(accountId) }, getSecret(), {
    algorithm: "HS256",
    issuer: ISSUER,
    expiresIn: `${SESSION_HOURS}h`,
  });
}

export function verifySessionToken(token) {
  try {
    const payload = jwt.verify(token, getSecret(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export function applySessionCookie(response, token) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
  return response;
}

export function clearSessionCookie(response) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

// Returns { accountId, username, role, workerId } or null. Server-verified.
export async function getSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const accountId = verifySessionToken(token);
  if (!accountId) return null;

  const supabase = getSupabaseAdmin();
  const { data: account, error } = await supabase
    .from("worker_accounts")
    .select("id, username, role, worker_id")
    .eq("id", accountId)
    .maybeSingle();

  if (error || !account) return null;

  if (account.role === "admin") {
    return {
      accountId: account.id,
      username: account.username,
      role: "admin",
      workerId: null,
    };
  }

  if (account.role === "worker" && account.worker_id != null) {
    return {
      accountId: account.id,
      username: account.username,
      role: "worker",
      workerId: account.worker_id,
    };
  }

  return null;
}
