import Link from "next/link";
import { db } from "@/lib/supabaseAdmin";
import { requireRole } from "@/lib/auth";
import { Shell, Card, Stat, Badge, Table, Th, Td } from "@/app/components/portal/ui";
import { AvailabilityToggle } from "@/app/components/portal/WorkerForms";
import { workerNav } from "../nav";
import { fmtDateTime, startOfTodayISO, money, groupPayroll, dayKey, weekKey, monthKey } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await requireRole(["worker"]);
  const [{ data: w }, { data: orders }, { data: pay }] = await Promise.all([
    db.from("workers").select("*").eq("id", s.workerId).single(),
    db.from("orders").select("id,order_no,title,pages,deadline,status,assigned_at,approved_at").eq("worker_id", s.workerId).order("deadline"),
    db.from("payroll_entries").select("earned_at,amount").eq("worker_id", s.workerId).order("earned_at", { ascending: false }).limit(2000),
  ]);
  const today = startOfTodayISO();
  const todays = orders.filter((o) => o.assigned_at && o.assigned_at >= today && o.status !== "cancelled");
  const open = orders.filter((o) => ["assigned", "in_progress", "revision_requested"].includes(o.status));
  const waiting = orders.filter((o) => o.status === "delivered");
  const done = orders.filter((o) => o.status === "approved");
  const now = new Date();
  const sum = (keyFn, k) => groupPayroll(pay, keyFn, 1000).find((g) => g.key === k)?.total || 0;

  return (
    <Shell session={s} title="Worker Portal" nav={workerNav}>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-3xl font-black">Hi, {s.name}</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${w.is_available ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
          {w.is_available ? "Available" : "Unavailable"}
        </span>
        <AvailabilityToggle available={w.is_available} />
      </div>
      <div className="grid gap-6 md:grid-cols-4">
        <Stat label="Orders today" value={`${todays.length} / ${w.max_orders_per_day}`} />
        <Stat label="Pages today" value={`${todays.reduce((a, o) => a + o.pages, 0)} / ${w.max_pages_per_day}`} sub={`Hours ${w.work_start.slice(0, 5)}–${w.work_end.slice(0, 5)}`} />
        <Stat label="Earned today" value={money(sum(dayKey, dayKey(now)))} />
        <Stat label="Earned this month" value={money(sum(monthKey, monthKey(now)))} sub={`This week ${money(sum(weekKey, weekKey(now)))}`} />
      </div>
      <Card title={`Assigned orders (${open.length})`}>
        {!open.length ? <p className="text-slate-500">Nothing assigned right now.</p> : (
          <Table>
            <thead><tr><Th>#</Th><Th>Title</Th><Th>Pages</Th><Th>Deadline</Th><Th>Status</Th></tr></thead>
            <tbody>{open.map((o) => (
              <tr key={o.id}><Td>{o.order_no}</Td><Td><Link className="font-semibold text-blue-700 hover:underline" href={`/worker/orders/${o.id}`}>{o.title}</Link></Td>
                <Td>{o.pages}</Td><Td>{fmtDateTime(o.deadline)}</Td><Td><Badge status={o.status} /></Td></tr>))}</tbody>
          </Table>
        )}
      </Card>
      <Card title={`Delivered, awaiting admin approval (${waiting.length})`}>
        {waiting.length ? <ul className="text-sm">{waiting.map((o) => <li key={o.id}><Link className="text-blue-700 hover:underline" href={`/worker/orders/${o.id}`}>#{o.order_no} {o.title}</Link></li>)}</ul> : <p className="text-slate-500">None.</p>}
      </Card>
      <Card title={`Completed orders (${done.length})`}>
        {done.length ? <ul className="text-sm">{done.slice(0, 20).map((o) => <li key={o.id}>#{o.order_no} {o.title} · {o.pages} pages · approved {fmtDateTime(o.approved_at)}</li>)}</ul> : <p className="text-slate-500">None yet.</p>}
      </Card>
    </Shell>
  );
}
