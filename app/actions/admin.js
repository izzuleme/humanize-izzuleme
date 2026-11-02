"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabaseAdmin";
import { requireRole, hashPassword, tempPassword, validatePassword, revokeAccountSessions, escapeLike } from "@/lib/auth";
import { parseWorkerSettings, isUuid } from "@/lib/validate";

const done = (extra = {}) => { revalidatePath("/", "layout"); return { ok: true, ...extra }; };

async function targetWorkerAccount(id) {
  const { data } = await db.from("worker_accounts").select("*").eq("id", id).maybeSingle();
  return data && data.role === "worker" ? data : null; // admins can't be edited through these actions
}

export async function createWorkerAction(_prev, fd) {
  const s = await requireRole(["admin"]);
  const username = String(fd.get("username") || "").trim();
  const displayName = String(fd.get("display_name") || "").trim().slice(0, 80);
  const phone = String(fd.get("phone") || "").replace(/[^\d]/g, "");
  let pw = String(fd.get("password") || "");
  if (!/^[A-Za-z0-9._-]{3,30}$/.test(username)) return { error: "Username: 3–30 letters, numbers, . _ -" };
  if (phone.length < 8 || phone.length > 15) return { error: "Enter a valid WhatsApp number with country code (digits only), e.g. 60123456789." };
  if (pw) { const e = validatePassword(pw); if (e) return { error: e }; } else pw = tempPassword();
  const st = parseWorkerSettings(fd, { withRate: true });
  if (st.error) return { error: st.error };

  const { data: dup } = await db.from("worker_accounts").select("id").ilike("username", escapeLike(username)).maybeSingle();
  if (dup) return { error: "That username is already taken." };

  const { data: w, error: e1 } = await db.from("workers").insert({ phone, orders: 0, is_available: true, ...st.values }).select("id").single();
  if (e1) return { error: "Could not create the worker record." };
  const { error: e2 } = await db.from("worker_accounts").insert({
    username, display_name: displayName || username, password_hash: await hashPassword(pw),
    role: "worker", worker_id: w.id, status: "active", must_change_password: true,
  });
  if (e2) { await db.from("workers").delete().eq("id", w.id); return { error: "Could not create the login account." }; }
  await db.rpc("assign_pending_orders");
  return done({ message: `Worker created. Give them this temporary password (shown once): ${pw}` });
}

export async function setWorkerStatusAction(_prev, fd) {
  await requireRole(["admin"]);
  const status = String(fd.get("status"));
  if (!["active", "inactive", "suspended"].includes(status)) return { error: "Invalid status." };
  const a = await targetWorkerAccount(String(fd.get("accountId")));
  if (!a) return { error: "Worker not found." };
  await db.from("worker_accounts").update({ status }).eq("id", a.id);
  if (status !== "active") await revokeAccountSessions("staff", a.id); // kicked out immediately
  else await db.rpc("assign_pending_orders");
  return done({ message: `Account is now ${status}.` });
}

export async function resetWorkerPasswordAction(_prev, fd) {
  await requireRole(["admin"]);
  const a = await targetWorkerAccount(String(fd.get("accountId")));
  if (!a) return { error: "Worker not found." };
  const pw = tempPassword();
  await db.from("worker_accounts").update({
    password_hash: await hashPassword(pw), password: null, must_change_password: true,
    failed_attempts: 0, locked_until: null, password_changed_at: new Date().toISOString(),
  }).eq("id", a.id);
  await revokeAccountSessions("staff", a.id);
  return done({ message: `Temporary password (shown once): ${pw}` });
}

export async function adminUpdateWorkerAction(_prev, fd) {
  await requireRole(["admin"]);
  const a = await targetWorkerAccount(String(fd.get("accountId")));
  if (!a) return { error: "Worker not found." };
  const st = parseWorkerSettings(fd, { withRate: true });
  if (st.error) return { error: st.error };
  const available = String(fd.get("is_available")) === "true";
  await db.from("workers").update({ ...st.values, is_available: available }).eq("id", a.worker_id);
  const dn = String(fd.get("display_name") || "").trim().slice(0, 80);
  if (dn) await db.from("worker_accounts").update({ display_name: dn }).eq("id", a.id);
  await db.rpc("assign_pending_orders");
  return done({ message: "Worker updated." });
}

export async function approveOrderAction(_prev, fd) {
  const s = await requireRole(["admin"]);
  const id = String(fd.get("orderId"));
  if (!isUuid(id)) return { error: "Invalid order." };
  const { data: ok } = await db.rpc("approve_order", { p_order: id, p_admin: `admin:${s.accountId}` });
  if (!ok) return { error: "Only delivered orders with no open revision can be approved." };
  return done({ message: "Approved. Payroll recorded." });
}

export async function assignOrderAction(_prev, fd) {
  const s = await requireRole(["admin"]);
  const id = String(fd.get("orderId"));
  const workerId = Number(fd.get("workerId"));
  if (!isUuid(id) || !Number.isInteger(workerId)) return { error: "Invalid request." };
  const { data: acct } = await db.from("worker_accounts").select("id").eq("worker_id", workerId).eq("role", "worker").eq("status", "active").maybeSingle();
  if (!acct) return { error: "That worker has no active account." };
  const { data: o } = await db.from("orders").select("id,status").eq("id", id).maybeSingle();
  if (!o || !["pending_assignment", "assigned", "in_progress", "revision_requested"].includes(o.status)) return { error: "This order cannot be (re)assigned." };
  const { data: paid } = await db.from("payments").select("id").eq("order_id", id).eq("status", "paid").maybeSingle();
  if (!paid) return { error: "Payment has not been verified for this order." };
  await db.from("orders").update({
    worker_id: workerId, assigned_at: new Date().toISOString(),
    status: o.status === "pending_assignment" ? "assigned" : o.status,
  }).eq("id", id);
  await db.from("workers").update({ last_assigned_at: new Date().toISOString() }).eq("id", workerId);
  await db.from("order_events").insert({ order_id: id, actor: `admin:${s.accountId}`, event: "manually_assigned", detail: `worker ${workerId}` });
  return done({ message: "Assigned." });
}

export async function autoReassignAction(_prev, fd) {
  const s = await requireRole(["admin"]);
  const id = String(fd.get("orderId"));
  if (!isUuid(id)) return { error: "Invalid order." };
  const { data: o } = await db.from("orders").select("id,status,worker_id").eq("id", id).maybeSingle();
  if (!o || !["assigned", "in_progress", "pending_assignment"].includes(o.status)) return { error: "This order cannot be reassigned." };
  await db.from("orders").update({ worker_id: null, status: "pending_assignment", assigned_at: null }).eq("id", id);
  const { data: w } = await db.rpc("assign_order", { p_order: id, p_exclude: o.worker_id });
  await db.from("order_events").insert({ order_id: id, actor: `admin:${s.accountId}`, event: "reassign_requested" });
  return done({ message: w ? "Reassigned automatically." : "No eligible worker right now — order is queued." });
}

export async function cancelOrderAction(_prev, fd) {
  const s = await requireRole(["admin"]);
  const id = String(fd.get("orderId"));
  if (!isUuid(id)) return { error: "Invalid order." };
  const { data } = await db.from("orders").update({ status: "cancelled" }).eq("id", id).not("status", "in", "(approved,cancelled)").select("id");
  if (!data?.length) return { error: "This order cannot be cancelled." };
  await db.from("order_events").insert({ order_id: id, actor: `admin:${s.accountId}`, event: "cancelled" });
  return done({ message: "Order cancelled." });
}

export async function markPaidAction(_prev, fd) {
  await requireRole(["admin"]);
  const now = new Date().toISOString();
  const entryId = String(fd.get("entryId") || "");
  const workerId = Number(fd.get("workerId"));
  let q = db.from("payroll_entries").update({ status: "paid", paid_at: now }).eq("status", "pending");
  if (isUuid(entryId)) q = q.eq("id", entryId);
  else if (Number.isInteger(workerId)) q = q.eq("worker_id", workerId);
  else return { error: "Invalid request." };
  await q;
  return done({ message: "Marked as paid." });
}
