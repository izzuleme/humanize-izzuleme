"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabaseAdmin";
import { requireRole } from "@/lib/auth";
import { isUuid } from "@/lib/validate";
import { normalizePhone, validPhone } from "@/lib/payment";
import { sendEmail } from "@/lib/email";

const done = (extra = {}) => { revalidatePath("/", "layout"); return { ok: true, ...extra }; };
const actorOf = (s) => `admin:${s.accountId}`;
const txt = (fd, k, max) => String(fd.get(k) || "").trim().slice(0, max);

export async function startReviewAction(_prev, fd) {
  const s = await requireRole(["admin"]);
  const id = String(fd.get("orderId"));
  if (!isUuid(id)) return { error: "Invalid order." };
  const { data } = await db.rpc("payment_start_review", { p_order: id, p_admin: actorOf(s) });
  return data ? done() : { error: "This payment is not waiting for review." };
}

export async function approvePaymentAction(_prev, fd) {
  const s = await requireRole(["admin"]);
  const id = String(fd.get("orderId"));
  if (!isUuid(id)) return { error: "Invalid order." };
  const { data, error } = await db.rpc("payment_approve", { p_order: id, p_admin: actorOf(s), p_note: txt(fd, "note", 1000) });
 const r = data?.[0];

if (error || !r?.ok) {
  return {
    error: "This payment cannot be approved (already processed?).",
  };
}

// If a worker was assigned, send the worker an email notification.
// Email failure will NOT affect payment approval or order assignment.
if (r.worker_id) {
  try {
    const { data: workerAccount } = await db
      .from("worker_accounts")
      .select("email, display_name")
      .eq("worker_id", r.worker_id)
      .eq("role", "worker")
      .eq("status", "active")
      .maybeSingle();

    const { data: order } = await db
      .from("orders")
      .select("order_no, title, pages, deadline")
      .eq("id", id)
      .maybeSingle();

    if (workerAccount?.email) {
      await sendEmail({
        to: workerAccount.email,
        subject: `New Order Assigned - #${order?.order_no ?? ""}`,
        text: [
          `Hi ${workerAccount.display_name || "Worker"},`,
          "",
          "A new order has been assigned to you.",
          "",
          `Order: #${order?.order_no ?? "-"}`,
          `Title: ${order?.title ?? "-"}`,
          `Pages: ${order?.pages ?? "-"}`,
          `Deadline: ${order?.deadline ? new Date(order.deadline).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" }) : "-"}`,
          "",
          "Please log in to your Humanize Izzuleme worker dashboard to view the order.",
          "",
          "Humanize Izzuleme",
        ].join("\n"),
      });
    } else {
      console.warn(`Worker ${r.worker_id} has no email address. Email skipped.`);
    }
  } catch (emailError) {
    console.error("Worker assignment email failed:", emailError);
  }
}

return done({
  message: r.worker_id
    ? "Payment approved and the order was assigned to a worker."
    : "Payment approved. No eligible worker right now; the order is queued and will be assigned automatically.",
});
}

export async function rejectPaymentAction(_prev, fd) {
  const s = await requireRole(["admin"]);
  const id = String(fd.get("orderId"));
  if (!isUuid(id)) return { error: "Invalid order." };
  const internal = txt(fd, "internal_note", 1000);
  if (!internal) return { error: "Add an internal note explaining the rejection." };
  const { data, error } = await db.rpc("payment_reject", { p_order: id, p_admin: actorOf(s), p_internal: internal, p_customer_msg: txt(fd, "customer_message", 500) });
  return !error && data ? done({ message: "Payment rejected. The customer can upload a new receipt." }) : { error: "This payment cannot be rejected." };
}

export async function requestReceiptAction(_prev, fd) {
  const s = await requireRole(["admin"]);
  const id = String(fd.get("orderId"));
  if (!isUuid(id)) return { error: "Invalid order." };
  const { data, error } = await db.rpc("payment_request_receipt", { p_order: id, p_admin: actorOf(s), p_internal: txt(fd, "internal_note", 1000), p_customer_msg: txt(fd, "customer_message", 500) });
  return !error && data ? done({ message: "Another receipt has been requested." }) : { error: "Cannot request a receipt for this payment." };
}

export async function savePaymentSettingsAction(_prev, fd) {
  const s = await requireRole(["admin"]);
  const wa = normalizePhone(fd.get("whatsapp_number"));
  const acct = txt(fd, "account_number", 40);
  const std = Number(fd.get("price_standard")), aca = Number(fd.get("price_academic"));
  if (!validPhone(wa)) return { error: "Enter the WhatsApp business number with country code, e.g. 60123456789." };
  if (acct && !/^[0-9 \-]{5,40}$/.test(acct)) return { error: "Account number may only contain digits, spaces and dashes." };
  if (![std, aca].every((n) => Number.isFinite(n) && n >= 0 && n <= 1000)) return { error: "Enter valid prices per page." };
  const { error } = await db.from("payment_settings").update({
    whatsapp_number: wa, bank_name: txt(fd, "bank_name", 80), account_holder: txt(fd, "account_holder", 120), account_number: acct,
    payment_methods: txt(fd, "payment_methods", 300), instructions: txt(fd, "instructions", 2000),
    price_standard: Math.round(std * 100) / 100, price_academic: Math.round(aca * 100) / 100,
    updated_at: new Date().toISOString(), updated_by: actorOf(s),
  }).eq("id", 1);
  if (error) return { error: "Could not save settings." };
  await db.from("admin_audit").insert({ actor: actorOf(s), action: "payment_settings_updated" }); // values deliberately not logged
  return done({ message: "Payment settings saved." });
}
