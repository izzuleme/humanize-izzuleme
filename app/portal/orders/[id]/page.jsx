import { notFound } from "next/navigation";
import { db } from "@/lib/supabaseAdmin";
import { requireRole } from "@/lib/auth";
import { isUuid } from "@/lib/validate";
import { Shell, Card, Badge, PaymentBadge, FileList } from "@/app/components/portal/ui";
import RevisionForm from "@/app/components/portal/RevisionForm";
import ReceiptForm from "@/app/components/portal/ReceiptForm";
import { fmtDateTime } from "@/lib/time";
import { customerNav } from "@/app/portal/nav";

export const dynamic = "force-dynamic";

export default async function Page({ params }) {
  const s = await requireRole(["customer"]);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  // ownership is part of the query: another customer's id simply returns nothing
  const { data: o } = await db.from("orders").select("*").eq("id", id).eq("customer_id", s.accountId).maybeSingle();
  if (!o) notFound();
  const [{ data: files }, { data: revs }, { data: payment }, { data: receipts }, { data: settings }] = await Promise.all([
    db.from("order_files").select("*").eq("order_id", id).order("created_at"),
    db.from("revisions").select("*").eq("order_id", id).order("revision_no"),
    db.from("payments").select("*").eq("order_id", id).maybeSingle(),
    db.from("payment_receipts").select("id,filename,status,customer_message,created_at").eq("order_id", id).order("created_at", { ascending: false }),
    db.from("payment_settings").select("bank_name,account_holder,account_number,payment_methods,instructions").eq("id", 1).single(),
  ]);
  const needsReceipt = ["rejected", "awaiting_payment"].includes(payment?.status);
  const lastMsg = receipts.find((r) => r.customer_message)?.customer_message;
  const mine = files.filter((f) => f.kind === "customer_upload");
  const done = files.filter((f) => f.kind === "deliverable");
  const canRevise = ["delivered", "approved"].includes(o.status) && !revs.some((r) => r.status === "open");
  return (
    <Shell session={s} title="Customer Portal" nav={customerNav}>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black">#{o.order_no} · {o.title}</h1><Badge status={o.status} />
        </div>
        <p className="mt-2 text-sm text-slate-500">Pages {o.from_page}–{o.to_page} ({o.pages} pages) · {o.style} · deadline {fmtDateTime(o.deadline)}</p>
        <p className="mt-4 whitespace-pre-wrap text-sm">{o.requirements}</p>
      </Card>
      <Card title="Payment">
        <div className="flex flex-wrap items-center gap-3"><PaymentBadge status={payment?.status} />
          <span className="text-sm text-slate-600">Amount RM{Number(payment?.amount || 0).toFixed(2)} · Ref {o.reference_code}</span></div>
        {payment?.status === "paid" && <p className="mt-2 text-sm text-emerald-700">Your payment has been verified.</p>}
        {["receipt_submitted", "under_verification"].includes(payment?.status) && <p className="mt-2 text-sm text-slate-600">We are verifying your payment. Your order goes to a worker once it is approved.</p>}
        {needsReceipt && (
          <div className="mt-3 space-y-3">
            {lastMsg && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{lastMsg}</p>}
            <p className="text-sm">{payment.status === "rejected" ? "Your receipt could not be verified." : "The admin asked for another receipt."} Please upload a valid receipt.</p>
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              {settings.bank_name && <p>Bank: {settings.bank_name}</p>}{settings.account_holder && <p>Account name: {settings.account_holder}</p>}
              {settings.account_number && <p>Account number: <b>{settings.account_number}</b></p>}{settings.payment_methods && <p>Accepted: {settings.payment_methods}</p>}
              {settings.instructions && <p className="mt-1 whitespace-pre-wrap">{settings.instructions}</p>}
            </div>
            <ReceiptForm orderId={o.id} />
          </div>
        )}
        {receipts.length > 0 && (
          <ul className="mt-4 divide-y text-sm">{receipts.map((r) => (
            <li key={r.id} className="flex justify-between py-2"><span>{r.filename} <em className="text-xs text-slate-500">({r.status})</em></span>
              <a className="font-semibold text-blue-700 hover:underline" href={`/api/receipts/${r.id}`} target="_blank">View</a></li>))}</ul>
        )}
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Your uploads"><FileList files={mine} /></Card>
        <Card title="Completed documents"><FileList files={done} empty="Nothing delivered yet." /></Card>
      </div>
      {revs.length > 0 && (
        <Card title="Revisions">
          <ul className="space-y-2 text-sm">{revs.map((r) => (
            <li key={r.id}><b>#{r.revision_no}</b> ({r.status}): {r.note}</li>))}</ul>
        </Card>
      )}
      {canRevise && <Card title="Need changes?"><RevisionForm orderId={o.id} /></Card>}
    </Shell>
  );
}
