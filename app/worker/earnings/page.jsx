import Link from "next/link";
import { db } from "@/lib/supabaseAdmin";
import { requireRole } from "@/lib/auth";
import { Shell, Card, Table, Th, Td } from "@/app/components/portal/ui";
import { workerNav } from "../nav";
import { money, fmtDateTime, groupPayroll, dayKey, weekKey, monthKey } from "@/lib/time";

export const dynamic = "force-dynamic";

function Summary({ title, rows }) {
  return (
    <Card title={title}>
      {!rows.length ? <p className="text-sm text-slate-500">No earnings yet.</p> : (
        <Table><thead><tr><Th>Period</Th><Th>Orders</Th><Th>Total</Th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.key}><Td>{r.key}</Td><Td>{r.count}</Td><Td className="font-semibold">{money(r.total)}</Td></tr>)}</tbody></Table>
      )}
    </Card>
  );
}

export default async function Page() {
  const s = await requireRole(["worker"]);
  const { data: pay } = await db.from("payroll_entries")
    .select("id,order_id,pages,rate,amount,earned_at,status,paid_at, orders(order_no,title)")
    .eq("worker_id", s.workerId).order("earned_at", { ascending: false }).limit(2000);
  const pending = pay.filter((p) => p.status === "pending").reduce((a, p) => a + Number(p.amount), 0);
  const paid = pay.filter((p) => p.status === "paid").reduce((a, p) => a + Number(p.amount), 0);
  return (
    <Shell session={s} title="Worker Portal" nav={workerNav}>
      <div className="grid gap-6 md:grid-cols-3">
        <Card title="Unpaid"><p className="text-3xl font-bold">{money(pending)}</p></Card>
        <Card title="Paid"><p className="text-3xl font-bold">{money(paid)}</p></Card>
        <Card title="Lifetime"><p className="text-3xl font-bold">{money(pending + paid)}</p></Card>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Summary title="Daily" rows={groupPayroll(pay, dayKey, 14)} />
        <Summary title="Weekly (Mon start)" rows={groupPayroll(pay, weekKey, 8)} />
        <Summary title="Monthly" rows={groupPayroll(pay, monthKey, 12)} />
      </div>
      <Card title="Completed & approved orders">
        {!pay.length ? <p className="text-sm text-slate-500">Nothing yet. Orders appear here once the admin approves them.</p> : (
          <Table><thead><tr><Th>Order</Th><Th>Pages</Th><Th>Rate</Th><Th>Amount</Th><Th>Earned</Th><Th>Status</Th></tr></thead>
            <tbody>{pay.map((p) => (
              <tr key={p.id}><Td><Link className="text-blue-700 hover:underline" href={`/worker/orders/${p.order_id}`}>#{p.orders?.order_no} {p.orders?.title}</Link></Td>
                <Td>{p.pages}</Td><Td>{money(p.rate)}</Td><Td className="font-semibold">{money(p.amount)}</Td>
                <Td>{fmtDateTime(p.earned_at)}</Td><Td>{p.status === "paid" ? `Paid ${fmtDateTime(p.paid_at)}` : "Pending"}</Td></tr>))}</tbody></Table>
        )}
      </Card>
    </Shell>
  );
}
