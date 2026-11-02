import Link from "next/link";
import { db } from "@/lib/supabaseAdmin";
import { requireRole } from "@/lib/auth";
import { Shell, Card, Table, Th, Td } from "@/app/components/portal/ui";
import { MarkPaidButton } from "@/app/components/portal/AdminForms";
import { adminNav } from "../nav";
import { money, fmtDateTime, groupPayroll, dayKey, weekKey, monthKey } from "@/lib/time";

export const dynamic = "force-dynamic";

function Summary({ title, rows }) {
  return (
    <Card title={title}>
      <Table><thead><tr><Th>Period</Th><Th>Orders</Th><Th>Total</Th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.key}><Td>{r.key}</Td><Td>{r.count}</Td><Td className="font-semibold">{money(r.total)}</Td></tr>)}</tbody></Table>
    </Card>
  );
}

export default async function Page() {
  const s = await requireRole(["admin"]);
  const [{ data: pay }, { data: accts }] = await Promise.all([
    db.from("payroll_entries").select("id,worker_id,order_id,pages,rate,amount,earned_at,status,orders(order_no,title)").order("earned_at", { ascending: false }).limit(3000),
    db.from("worker_accounts").select("worker_id,username,display_name").eq("role", "worker"),
  ]);
  const name = new Map(accts.map((a) => [a.worker_id, a.display_name || a.username]));
  const perWorker = [...new Set(pay.map((p) => p.worker_id))].map((id) => {
    const mine = pay.filter((p) => p.worker_id === id);
    const t = (st) => mine.filter((p) => p.status === st).reduce((a, p) => a + Number(p.amount), 0);
    return { id, pending: t("pending"), paid: t("paid") };
  });
  return (
    <Shell session={s} title="Admin Portal" nav={adminNav}>
      <div className="grid gap-6 md:grid-cols-3">
        <Summary title="Daily" rows={groupPayroll(pay, dayKey, 10)} />
        <Summary title="Weekly (Mon start)" rows={groupPayroll(pay, weekKey, 8)} />
        <Summary title="Monthly" rows={groupPayroll(pay, monthKey, 12)} />
      </div>
      <Card title="Per worker">
        <Table><thead><tr><Th>Worker</Th><Th>Unpaid</Th><Th>Paid</Th><Th></Th></tr></thead>
          <tbody>{perWorker.map((w) => (
            <tr key={w.id}><Td>{name.get(w.id) || `Worker ${w.id}`}</Td><Td className="font-semibold">{money(w.pending)}</Td><Td>{money(w.paid)}</Td>
              <Td>{w.pending > 0 && <MarkPaidButton workerId={w.id} label="Mark all paid" />}</Td></tr>))}</tbody></Table>
      </Card>
      <Card title="Entries (one per approved order)">
        <Table><thead><tr><Th>Order</Th><Th>Worker</Th><Th>Pages × rate</Th><Th>Amount</Th><Th>Earned</Th><Th>Status</Th></tr></thead>
          <tbody>{pay.slice(0, 200).map((p) => (
            <tr key={p.id}><Td><Link className="text-blue-700 hover:underline" href={`/admin/orders/${p.order_id}`}>#{p.orders?.order_no} {p.orders?.title}</Link></Td>
              <Td>{name.get(p.worker_id)}</Td><Td>{p.pages} × {money(p.rate)}</Td><Td className="font-semibold">{money(p.amount)}</Td>
              <Td>{fmtDateTime(p.earned_at)}</Td><Td>{p.status === "pending" ? <MarkPaidButton entryId={p.id} /> : "Paid"}</Td></tr>))}</tbody></Table>
      </Card>
    </Shell>
  );
}
