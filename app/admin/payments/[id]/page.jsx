import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/supabaseAdmin";
import { requireRole } from "@/lib/auth";
import { isUuid } from "@/lib/validate";
import { Shell, Card, PaymentBadge, Badge } from "@/app/components/portal/ui";
import { StartReviewButton, ApprovePaymentForm, RejectPaymentForm, RequestReceiptForm } from "@/app/components/portal/AdminForms";
import { adminNav } from "../../nav";
import { fmtDateTime, money } from "@/lib/time";
import { whatsappLink } from "@/lib/payment";

export const dynamic = "force-dynamic";

export default async function Page({ params }) {
  const s = await requireRole(["admin"]);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { data: o } = await db.from("orders").select("*, customers(name,email,phone)").eq("id", id).maybeSingle();
  if (!o) notFound();
  const [{ data: payment }, { data: receipts }, { data: events }] = await Promise.all([
    db.from("payments").select("*").eq("order_id", id).maybeSingle(),
    db.from("payment_receipts").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    db.from("payment_events").select("*").eq("order_id", id).order("created_at", { ascending: false }),
  ]);
  const reviewable = ["receipt_submitted", "under_verification"].includes(payment?.status);
  const latest = receipts[0];
  const phone = o.customer_phone || o.customers?.phone;
  const notify = phone && ["rejected", "awaiting_payment"].includes(payment?.status)
    ? whatsappLink(phone, `Hi ${o.customers?.name}, regarding your order ${o.reference_code}: we could not verify your payment receipt. Please upload a valid receipt in your account.${latest?.customer_message ? "\n" + latest.customer_message : ""}`) : null;

  return (
    <Shell session={s} title="Admin Portal" nav={adminNav}>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black">#{o.order_no} · {o.title} <span className="font-mono text-sm text-slate-500">{o.reference_code}</span></h1>
          <div className="flex gap-2"><PaymentBadge status={payment?.status} /><Badge status={o.status} /></div>
        </div>
        <p className="mt-2 text-sm text-slate-600">Amount to receive: <b>{money(payment?.amount)}</b> · pages {o.from_page}–{o.to_page} ({o.pages}) of {o.total_pages} · {o.style} · deadline {fmtDateTime(o.deadline)}</p>
        <p className="text-sm text-slate-600">Customer: {o.customers?.name} · {o.customers?.email} · WhatsApp {phone}</p>
        <p className="mt-1 text-sm"><Link className="text-blue-700 hover:underline" href={`/admin/orders/${o.id}`}>Open order</Link></p>
        {notify && <p className="mt-2 text-sm"><a className="font-semibold text-emerald-700 hover:underline" href={notify} target="_blank">Notify customer on WhatsApp</a></p>}
      </Card>

      <Card title="Receipts">
        {!receipts.length ? <p className="text-slate-500">No receipts.</p> : (
          <ul className="divide-y text-sm">{receipts.map((r) => (
            <li key={r.id} className="py-3">
              <div className="flex flex-wrap justify-between gap-2">
                <span><b>{r.filename}</b> · {r.status} · uploaded {fmtDateTime(r.created_at)} · {(r.size_bytes / 1024).toFixed(0)} KB</span>
                <a className="font-semibold text-blue-700 hover:underline" href={`/api/receipts/${r.id}`} target="_blank">View receipt</a>
              </div>
              {r.internal_note && <p className="mt-1 text-xs text-slate-600">Internal note: {r.internal_note}</p>}
              {r.customer_message && <p className="mt-1 text-xs text-slate-600">Customer was told: {r.customer_message}</p>}
            </li>))}</ul>
        )}
      </Card>

      {reviewable && (
        <Card title="Verify payment">
          <p className="mb-4 text-sm text-slate-600">Only approve after you have checked that the money is in the account and matches the amount and reference. An uploaded receipt alone does not make an order paid.</p>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-3">{payment.status === "receipt_submitted" && <StartReviewButton orderId={o.id} />}<ApprovePaymentForm orderId={o.id} /></div>
            <RejectPaymentForm orderId={o.id} />
            <RequestReceiptForm orderId={o.id} />
          </div>
        </Card>
      )}

      <Card title="Verification history">
        {!events.length ? <p className="text-slate-500">No actions yet.</p> : (
          <ul className="space-y-1 text-sm">{events.map((e) => (
            <li key={e.id}>{fmtDateTime(e.created_at)} · <b>{e.action}</b> · {e.actor}{e.internal_note ? ` · note: ${e.internal_note}` : ""}{e.customer_message ? ` · to customer: ${e.customer_message}` : ""}</li>))}</ul>
        )}
      </Card>
    </Shell>
  );
}
