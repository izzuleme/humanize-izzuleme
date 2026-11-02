import { notFound } from "next/navigation";
import { db } from "@/lib/supabaseAdmin";
import { requireRole } from "@/lib/auth";
import { isUuid } from "@/lib/validate";
import Link from "next/link";
import { Shell, Card, Badge, PaymentBadge, FileList } from "@/app/components/portal/ui";
import { ApproveButton, AssignForm, ReassignButton, CancelButton } from "@/app/components/portal/AdminForms";
import { adminNav } from "../../nav";
import { fmtDateTime, money } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function Page({ params }) {
  const s = await requireRole(["admin"]);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { data: o } = await db.from("orders").select("*, customers(name,email,phone)").eq("id", id).maybeSingle();
  if (!o) notFound();
  const [{ data: files }, { data: revs }, { data: events }, { data: accts }, { data: pay }, { data: payment }] = await Promise.all([
    db.from("order_files").select("*").eq("order_id", id).order("created_at"),
    db.from("revisions").select("*").eq("order_id", id).order("revision_no"),
    db.from("order_events").select("*").eq("order_id", id).order("created_at", { ascending: false }).limit(30),
    db.from("worker_accounts").select("worker_id,username,display_name,status").eq("role", "worker"),
    db.from("payroll_entries").select("*").eq("order_id", id).maybeSingle(),
    db.from("payments").select("status,amount").eq("order_id", id).maybeSingle(),
  ]);
  const cur = accts.find((a) => a.worker_id === o.worker_id);
  const options = accts.filter((a) => a.status === "active").map((a) => ({ worker_id: a.worker_id, name: a.display_name || a.username }));
  const open = !["approved", "cancelled"].includes(o.status);
  return (
    <Shell session={s} title="Admin Portal" nav={adminNav}>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black">#{o.order_no} · {o.title}</h1><Badge status={o.status} />
        </div>
        <p className="mt-2 text-sm text-slate-500">{o.pages} pages · deadline {fmtDateTime(o.deadline)} · price {o.price == null ? "not set" : money(o.price)}</p>
        <p className="text-sm text-slate-500">Customer: {o.customers?.name} · {o.customers?.email}{o.customers?.phone ? ` · ${o.customers.phone}` : ""}</p>
        <p className="text-sm text-slate-500">Worker: {cur ? `${cur.display_name || cur.username} (${cur.status})` : "unassigned"}</p>
        <p className="mt-2 text-sm">Payment: <PaymentBadge status={payment?.status} /> <Link className="ml-2 text-blue-700 hover:underline" href={`/admin/payments/${o.id}`}>payment details</Link></p>
        <p className="mt-4 whitespace-pre-wrap text-sm">{o.requirements}</p>
        {pay && <p className="mt-3 text-sm font-semibold text-emerald-700">Payroll recorded: {money(pay.amount)} ({pay.pages} pages × {money(pay.rate)}), {pay.status}</p>}
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Customer documents"><FileList files={files.filter((f) => f.kind === "customer_upload")} /></Card>
        <Card title="Completed documents"><FileList files={files.filter((f) => f.kind === "deliverable")} empty="Nothing delivered." /></Card>
      </div>
      {revs.length > 0 && <Card title="Revisions"><ul className="space-y-1 text-sm">{revs.map((r) => <li key={r.id}><b>#{r.revision_no}</b> ({r.status}): {r.note}</li>)}</ul></Card>}
      <Card title="Actions">
        <div className="flex flex-wrap items-start gap-6">
          {o.status === "delivered" && <ApproveButton orderId={o.id} />}
          {open && <AssignForm orderId={o.id} workers={options} />}
          {["assigned", "in_progress", "pending_assignment"].includes(o.status) && <ReassignButton orderId={o.id} />}
          {open && <CancelButton orderId={o.id} />}
        </div>
      </Card>
      <Card title="History">
        <ul className="space-y-1 text-xs text-slate-600">{events.map((e) => <li key={e.id}>{fmtDateTime(e.created_at)} · {e.actor} · {e.event} {e.detail || ""}</li>)}</ul>
      </Card>
    </Shell>
  );
}
