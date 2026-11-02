import Link from "next/link";
import { db } from "@/lib/supabaseAdmin";
import { requireRole } from "@/lib/auth";
import { Shell, Card, Stat, Badge, Table, Th, Td } from "@/app/components/portal/ui";
import { adminNav } from "../nav";
import { fmtDateTime, startOfTodayISO, money } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const s = await requireRole(["admin"]);
  const today = startOfTodayISO();
  const [{ data: orders }, { data: workers }, { data: accts }, { data: pay }, { data: toVerify }] = await Promise.all([
    db.from("orders").select("id,order_no,title,status,price,created_at,deadline").order("created_at", { ascending: false }).limit(5000),
    db.from("workers").select("id,is_available"),
    db.from("worker_accounts").select("worker_id,status").eq("role", "worker"),
    db.from("payroll_entries").select("amount,status"),
    db.from("payments").select("id").in("status", ["receipt_submitted", "under_verification"]),
  ]);
  const n = (st) => orders.filter((o) => o.status === st).length;
  const activeIds = new Set(accts.filter((a) => a.status === "active").map((a) => a.worker_id));
  const live = workers.filter((w) => w.is_available && activeIds.has(w.id)).length;
  const revenue = orders.filter((o) => o.status === "approved").reduce((a, o) => a + Number(o.price || 0), 0);
  const unpaid = pay.filter((p) => p.status === "pending").reduce((a, p) => a + Number(p.amount), 0);
  const attention = orders.filter((o) => ["pending_payment_verification", "pending_assignment", "delivered"].includes(o.status)).slice(0, 10);

  return (
    <Shell session={s} title="Humanize Izzuleme Admin" nav={adminNav}>
      <h1 className="text-4xl font-black">Humanize Izzuleme Dashboard</h1>
      <div className="grid gap-6 md:grid-cols-4">
        <Stat label="Orders Today" value={orders.filter((o) => o.created_at >= today).length} />
        <Stat label="Payments to verify" value={toVerify.length} />
        <Stat label="Waiting for worker" value={n("pending_assignment")} />
        <Stat label="In progress" value={n("assigned") + n("in_progress") + n("revision_requested")} />
        <Stat label="Awaiting approval" value={n("delivered")} />
        <Stat label="Completed" value={n("approved")} />
        <Stat label="Revenue (approved)" value={money(revenue)} />
        <Stat label="Workers ready now" value={`${live} / ${workers.length}`} sub="active + available" />
        <Stat label="Payroll unpaid" value={money(unpaid)} />
      </div>
      <Card title="Needs attention">
        {!attention.length ? <p className="text-slate-500">Nothing waiting.</p> : (
          <Table><thead><tr><Th>#</Th><Th>Title</Th><Th>Deadline</Th><Th>Status</Th></tr></thead>
            <tbody>{attention.map((o) => (
              <tr key={o.id}><Td>{o.order_no}</Td><Td><Link className="font-semibold text-blue-700 hover:underline" href={`/admin/orders/${o.id}`}>{o.title}</Link></Td>
                <Td>{fmtDateTime(o.deadline)}</Td><Td><Badge status={o.status} /></Td></tr>))}</tbody></Table>
        )}
      </Card>
    </Shell>
  );
}
