import Link from "next/link";
import { db } from "@/lib/supabaseAdmin";
import { requireRole } from "@/lib/auth";
import { Shell, Card, PaymentBadge, Table, Th, Td } from "@/app/components/portal/ui";
import { adminNav } from "../nav";
import { fmtDateTime, money } from "@/lib/time";

export const dynamic = "force-dynamic";
const TABS = [["queue", "Awaiting verification"], ["rejected", "Rejected"], ["awaiting_payment", "Receipt requested"], ["paid", "Paid"], ["history", "Verification history"]];

export default async function Page({ searchParams }) {
  const s = await requireRole(["admin"]);
  const { view = "queue" } = await searchParams;
  let rows = [], events = [];
  if (view === "history") {
    ({ data: events } = await db.from("payment_events").select("id,actor,action,internal_note,customer_message,created_at,order_id,orders(order_no,title)").order("created_at", { ascending: false }).limit(300));
  } else {
    let q = db.from("payments").select("id,order_id,amount,status,updated_at,orders(order_no,title,reference_code,deadline,customers(name))").order("updated_at", { ascending: true }).limit(300);
    q = view === "queue" ? q.in("status", ["receipt_submitted", "under_verification"]) : q.eq("status", view);
    ({ data: rows } = await q);
  }
  return (
    <Shell session={s} title="Admin Portal" nav={adminNav}>
      <Card title="Payment verification">
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          {TABS.map(([k, l]) => <Link key={k} href={`/admin/payments?view=${k}`} className={`rounded-full border px-3 py-1 ${view === k ? "bg-slate-900 text-white" : ""}`}>{l}</Link>)}
        </div>
        {view === "history" ? (
          <Table><thead><tr><Th>When</Th><Th>Order</Th><Th>Actor</Th><Th>Action</Th><Th>Internal note</Th><Th>Customer message</Th></tr></thead>
            <tbody>{events.map((e) => (
              <tr key={e.id}><Td>{fmtDateTime(e.created_at)}</Td>
                <Td><Link className="text-blue-700 hover:underline" href={`/admin/payments/${e.order_id}`}>#{e.orders?.order_no} {e.orders?.title}</Link></Td>
                <Td>{e.actor}</Td><Td>{e.action}</Td><Td>{e.internal_note || "-"}</Td><Td>{e.customer_message || "-"}</Td></tr>))}</tbody></Table>
        ) : !rows.length ? <p className="text-slate-500">Nothing here.</p> : (
          <Table><thead><tr><Th>Ref</Th><Th>Order</Th><Th>Customer</Th><Th>Amount</Th><Th>Deadline</Th><Th>Status</Th></tr></thead>
            <tbody>{rows.map((p) => (
              <tr key={p.id}><Td className="font-mono">{p.orders?.reference_code}</Td>
                <Td><Link className="font-semibold text-blue-700 hover:underline" href={`/admin/payments/${p.order_id}`}>#{p.orders?.order_no} {p.orders?.title}</Link></Td>
                <Td>{p.orders?.customers?.name}</Td><Td>{money(p.amount)}</Td><Td>{fmtDateTime(p.orders?.deadline)}</Td><Td><PaymentBadge status={p.status} /></Td></tr>))}</tbody></Table>
        )}
      </Card>
    </Shell>
  );
}
