"use server";
import { preparePendingUpload } from "@/lib/pendingUploads";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabaseAdmin";
import { requireRole } from "@/lib/auth";
import { storeFiles, uploadRaw, removeUploaded, checkFile, DOC_TYPES, RECEIPT_TYPES } from "@/lib/files";
import { normalizePhone, validPhone, pageCount } from "@/lib/payment";
import { isUuid } from "@/lib/validate";
import { sendEmail } from "@/lib/email";

const ERR = {
  duplicate_receipt: "This receipt file has already been used. Please upload the receipt for THIS payment.",
  not_found: "Order not found.",
  not_allowed: "A new receipt is not needed for this order right now.",
};

async function loadSettings() {
  const { data } = await db.from("payment_settings").select("*").eq("id", 1).single();
  return data;
}

// Bank details are only ever sent to a logged-in customer, on demand.
export async function getPaymentInstructionsAction() {
  await requireRole(["customer"]);
  const c = await loadSettings();
  return {
    bank_name: c.bank_name, account_holder: c.account_holder, account_number: c.account_number,
    payment_methods: c.payment_methods, instructions: c.instructions,
  };
}
export async function checkSlotAvailabilityAction(deadlineValue, pagesValue) {
  await requireRole(["customer"]);

  const pages = Number(pagesValue);
  const deadline = new Date(String(deadlineValue || "") + "+08:00");

  if (
    !Number.isInteger(pages) ||
    pages <= 0 ||
    pages > 500 ||
    isNaN(deadline.getTime()) ||
    deadline <= new Date()
  ) {
    return {
      available: false,
      message: "Please choose a valid future deadline and page range.",
    };
  }

  const { data, error } = await db.rpc("slot_has_capacity", {
    p_deadline: deadline.toISOString(),
    p_pages: pages,
  });

  if (error) {
    console.error("Slot availability check failed:", error);
    return {
      available: false,
      message: "Could not check availability. Please try again.",
    };
  }

  if (!data) {
    return {
      available: false,
      message: "No worker slot is available for this deadline. Please choose another date or time.",
    };
  }

  return {
    available: true,
    message: "Slot available.",
  };
}

export async function createOrderAction(_prev, fd) {
  const s = await requireRole(["customer"]);
  const key = String(fd.get("submission_key") || "");
  const title = String(fd.get("title") || "").trim();
  const from = Number(fd.get("from_page")), to = Number(fd.get("to_page")), total = Number(fd.get("total_pages"));
  const style = String(fd.get("style") || "");
  const phone = normalizePhone(fd.get("phone"));
  const note = String(fd.get("requirements") || "").trim();
  const deadline = new Date(String(fd.get("deadline") || "") + "+08:00"); // Malaysia time
  const documentUploadId = String(fd.get("document_upload_id") || "");
const receiptUploadId = String(fd.get("receipt_upload_id") || "");

  if (!isUuid(key)) return { error: "Please reload the page and try again." };
  if (title.length < 3 || title.length > 150) return { error: "Please give the order a title (3–150 chars)." };
  if (![from, to, total].every(Number.isInteger) || from < 1 || to < from) return { error: "Enter a valid From page and To page." };
  if (total < to || total > 2000) return { error: "Total pages must be at least the 'To page' number." };
  if (pageCount(from, to) > 500) return { error: "Maximum 500 pages per order." };
  if (!["academic", "standard"].includes(style)) return { error: "Choose a writing style." };
  if (!validPhone(phone)) return { error: "Enter a valid WhatsApp number." };
  if (note.length > 3000) return { error: "Notes are too long." };
  if (isNaN(deadline) || deadline < new Date()) return { error: "Deadline must be in the future." };
const pages = pageCount(from, to);

const { data: slotAvailable, error: slotError } = await db.rpc("slot_has_capacity", {
  p_deadline: deadline.toISOString(),
  p_pages: pages,
});

if (slotError) {
  console.error("Slot availability check failed:", slotError);
  return { error: "Could not check worker availability. Please try again." };
}

if (!slotAvailable) {
  return {
    error: "No worker slot is available for this deadline. Please choose another date or time.",
  };
}
  
  if (!isUuid(documentUploadId) || !isUuid(receiptUploadId)) {
    return { error: "Please upload your document and payment receipt." };
  }

  // A retry with the same submission key must return the existing order.
  const { data: existing, error: existingError } = await db
    .from("orders")
    .select("id")
    .eq("customer_id", s.accountId)
    .eq("submission_key", key)
    .maybeSingle();

  if (existingError) {
    return { error: "Could not check your order. Please try again." };
  }

  if (existing) {
    redirect(`/portal/orders/${existing.id}`);
  }

  let d = null;
  let r = null;

  try {
    d = await preparePendingUpload({
      uploadId: documentUploadId,
      customerId: s.accountId,
      submissionKey: key,
      kind: "document",
    });

    r = await preparePendingUpload({
      uploadId: receiptUploadId,
      customerId: s.accountId,
      submissionKey: key,
      kind: "receipt",
    });
  } catch (uploadError) {
    await removeUploaded(d, r);
    console.error("Preparing order files failed:", uploadError);

    return {
      error: "Could not prepare your uploaded files. Please try again.",
    };
  }


  const { data, error } = await db.rpc("create_verified_order", {
  p_customer: s.accountId,
  p_key: key,
  p_title: title,
  p_from: from,
  p_to: to,
  p_total: total,
  p_style: style,
  p_deadline: deadline.toISOString(),
  p_phone: phone,
  p_requirements: note,

  // Dua parameter baharu
  p_document_upload_id: documentUploadId,
  p_receipt_upload_id: receiptUploadId,

  // Kekalkan dua parameter asal
  p_original: d,
  p_receipt: r,
});

  if (error || !data?.[0]) {
    

    const code = Object.keys(ERR).find((k) =>
      error?.message?.includes(k)
    );

    return {
      error: code
        ? ERR[code]
        : "Could not submit the order. Please try again.",
    };
  }

  if (data[0].duplicate) {
  // Do not delete files here.
  // The database may already reference the finalized uploads.
} else {
    // Notify admin only when a genuinely new order is created.
    try {
      const { data: admins, error: adminError } = await db
        .from("worker_accounts")
        .select("email")
        .eq("role", "admin")
        .eq("status", "active")
        .not("email", "is", null);


    if (adminError) {
      console.error("Could not load admin emails:", adminError);
    } else {
      const adminEmails = [
        ...new Set(
          (admins || [])
            .map((admin) => String(admin.email || "").trim())
            .filter(Boolean)
        ),
      ];

      if (adminEmails.length > 0) {
        await sendEmail({
          to: adminEmails,
          subject: `New Humanize Order - ${title}`,
          html: `
            <h2>New order received</h2>
            <p>A customer has submitted a new Humanize order.</p>

            <p><strong>Title:</strong> ${title}</p>
            <p><strong>Pages:</strong> ${from} - ${to} (${pages} pages)</p>
            <p><strong>Style:</strong> ${style}</p>
            <p><strong>Deadline:</strong> ${deadline.toLocaleString("en-MY", {
              timeZone: "Asia/Kuala_Lumpur",
            })}</p>
            <p><strong>WhatsApp:</strong> ${phone}</p>

            <p>The payment receipt is waiting for verification in the admin dashboard.</p>
          `,
        });
      } else {
        console.warn("Admin email skipped: no active admin email found.");
      }
    }
  } catch (emailError) {
    console.error("Admin order notification failed:", emailError);
  }
}

redirect(`/portal/orders/${data[0].order_id}`);
}

export async function replaceReceiptAction(_prev, fd) {
  const s = await requireRole(["customer"]);
  const orderId = String(fd.get("orderId"));
  const receipt = fd.get("receipt");
  if (!isUuid(orderId)) return { error: "Invalid order." };
  const e = checkFile(receipt, RECEIPT_TYPES, 10 * 1048576, "Payment receipt");
  if (e) return { error: e };
  const r = await uploadRaw({ orderKey: orderId, folder: "receipt", file: receipt });
  if (!r) return { error: "Upload failed. Please try again." };
  const { error } = await db.rpc("payment_submit_replacement", { p_order: orderId, p_customer: s.accountId, p_receipt: r });
  if (error) {
    await removeUploaded(r);
    const code = Object.keys(ERR).find((k) => error.message.includes(k));
    return { error: code ? ERR[code] : "Could not submit the receipt." };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Receipt submitted. The admin will verify your payment." };
}

export async function requestRevisionAction(_prev, fd) {
  const s = await requireRole(["customer"]);
  const orderId = String(fd.get("orderId"));
  const note = String(fd.get("note") || "").trim();
  if (!isUuid(orderId)) return { error: "Invalid order." };
  if (note.length < 10 || note.length > 3000) return { error: "Please describe what needs to change (10–3000 chars)." };

  const { data: o } = await db.from("orders").select("id,status,customer_id")
    .eq("id", orderId).eq("customer_id", s.accountId).maybeSingle(); // ownership enforced in the query
  if (!o) return { error: "Order not found." };
  if (!["delivered", "approved"].includes(o.status)) return { error: "A revision can only be requested after delivery." };
  const { data: open } = await db.from("revisions").select("id").eq("order_id", orderId).eq("status", "open").limit(1);
  if (open?.length) return { error: "A revision is already open for this order." };

  const { count } = await db.from("revisions").select("id", { count: "exact", head: true }).eq("order_id", orderId);
  const revNo = (count || 0) + 1;
  const up = await storeFiles({ orderId, kind: "customer_upload", files: fd.getAll("files"), actor: `customer:${s.accountId}`, revisionNo: revNo });
  if (up.error) return { error: up.error };

  const { error } = await db.from("revisions").insert({ order_id: orderId, revision_no: revNo, note });
  if (error) return { error: "Could not save the revision request." };
  await db.from("orders").update({ status: "revision_requested" }).eq("id", orderId).eq("customer_id", s.accountId);
  await db.from("order_events").insert({ order_id: orderId, actor: `customer:${s.accountId}`, event: "revision_requested", detail: `#${revNo}` });
  revalidatePath("/", "layout");
  return { ok: true, message: "Revision requested. Your worker has been notified." };
}
