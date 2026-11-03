"use server";
import { sendEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabaseAdmin";
import { requireRole } from "@/lib/auth";
import { storeFiles } from "@/lib/files";
import { parseWorkerSettings, isUuid } from "@/lib/validate";

// The ownership check lives IN the query: worker_id must equal the logged-in worker.
async function myOrder(s, orderId) {
  if (!isUuid(orderId)) return null;
  const { data } = await db.from("orders").select("*").eq("id", orderId).eq("worker_id", s.workerId).maybeSingle();
  return data;
}

export async function startOrderAction(_prev, fd) {
  const s = await requireRole(["worker"]);
  const o = await myOrder(s, String(fd.get("orderId")));
  if (!o) return { error: "Order not found." };
  if (o.status !== "assigned") return { error: "This order cannot be started." };
  await db.from("orders").update({ status: "in_progress" }).eq("id", o.id).eq("worker_id", s.workerId).eq("status", "assigned");
  await db.from("order_events").insert({ order_id: o.id, actor: `worker:${s.workerId}`, event: "started" });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deliverAction(_prev, fd) {
  const s = await requireRole(["worker"]);
  const o = await myOrder(s, String(fd.get("orderId")));
  if (!o) return { error: "Order not found." };
  if (!["assigned", "in_progress", "revision_requested"].includes(o.status)) return { error: "This order is not open for delivery." };
  const files = fd.getAll("files").filter((f) => f && f.size > 0);
  if (!files.length) return { error: "Choose at least one completed document." };

  const { data: rev } = await db.from("revisions").select("id,revision_no").eq("order_id", o.id).eq("status", "open").maybeSingle();
  const up = await storeFiles({ orderId: o.id, kind: "deliverable", files, actor: `worker:${s.workerId}`, revisionNo: rev?.revision_no || 0 });
  if (up.error) return { error: up.error };

  const now = new Date().toISOString();
  await db.from("orders").update({ status: "delivered", delivered_at: now })
    .eq("id", o.id).eq("worker_id", s.workerId).in("status", ["assigned", "in_progress", "revision_requested"]);
  if (rev) await db.from("revisions").update({ status: "resolved", resolved_at: now }).eq("id", rev.id);
  await db.from("order_events").insert({ order_id: o.id, actor: `worker:${s.workerId}`, event: rev ? "revision_delivered" : "delivered" });
// Email customer after the completed order has been delivered.
try {
  const { data: customer } = await db
    .from("customers")
    .select("email,name")
    .eq("id", o.customer_id)
    .maybeSingle();

  if (customer?.email) {
    await sendEmail({
      to: customer.email,
      subject: `Your Humanize Izzuleme order #${o.order_no} is ready`,
      text:
        `Hi ${customer.name || "there"},\n\n` +
        `Good news! Your order #${o.order_no} (${o.title}) has been completed and delivered.\n\n` +
        `You can log in to your Humanize Izzuleme customer portal to view and download your completed files.\n\n` +
        `Thank you for using Humanize Izzuleme!`,
    });
  }
} catch (emailError) {
  console.error("Customer delivery email failed:", emailError);
}
  revalidatePath("/", "layout");
  return { ok: true, message: "Delivered. The customer and admin can now see your files." };
}

export async function setAvailabilityAction(_prev, fd) {
  const s = await requireRole(["worker"]);
  const available = String(fd.get("available")) === "true";
  await db.from("workers").update({ is_available: available }).eq("id", s.workerId);
  if (available) await db.rpc("assign_pending_orders"); // new capacity -> drain the queue
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateMySettingsAction(_prev, fd) {
  const s = await requireRole(["worker"]);
  const r = parseWorkerSettings(fd); // no pay rate here: workers cannot set their own rate
  if (r.error) return { error: r.error };
  await db.from("workers").update(r.values).eq("id", s.workerId);
  await db.rpc("assign_pending_orders");
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}

export async function updateOrderMinutesAction(_prev, fd) {
  const s = await requireRole(["worker"]);

  const orderId = String(fd.get("orderId") || "");
  const minutes = Number(fd.get("minutes"));

  if (!isUuid(orderId)) {
    return { error: "Invalid order." };
  }

  if (
    !Number.isInteger(minutes) ||
    minutes < 5 ||
    minutes > 1440
  ) {
    return {
      error: "Estimated time must be between 5 and 1440 minutes.",
    };
  }

  // Ownership is also checked inside the database function
  // using the logged-in worker ID.
  const { data, error } = await db.rpc("worker_set_order_minutes", {
    p_order: orderId,
    p_worker: s.workerId,
    p_minutes: minutes,
  });

  if (error) {
    console.error("Could not update estimated time:", error);

    return {
      error: "Could not update estimated time. Please try again.",
    };
  }

  if (!data) {
    return {
      error:
        "This time overlaps with another order assigned to you, or this order can no longer be changed.",
    };
  }

  revalidatePath(`/worker/orders/${orderId}`);
  revalidatePath("/worker/dashboard");

  return {
    ok: true,
    message: `Estimated time updated to ${minutes} minutes.`,
  };
}
