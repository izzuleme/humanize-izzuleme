import Link from "next/link";
import { db } from "@/lib/supabaseAdmin";
import { requireRole } from "@/lib/auth";
import { Shell, Card, Table, Th, Td } from "@/app/components/portal/ui";
import { CreateWorkerForm } from "@/app/components/portal/AdminForms";
import { adminNav } from "../nav";
import { fmtDateTime, startOfTodayISO } from "@/lib/time";

export const dynamic = "force-dynamic";
const chip = { active: "bg-emerald-100 text-emerald-800", inactive: "bg-slate-200 text-slate-700", suspended: "bg-red-100 text-red-800" };

export default async function Page() {
  const s = await requireRole(["admin"]);
  const today = startOfTodayISO();
  const [{ data: accts }, { data: workers }, { data: orders }] = await Promise.all([
    db.from("worker_accounts").select("id,username,display_name,status,worker_id,last_login_at").eq("role", "worker").order("username"),
    db.from("workers").select("*"),
    db.from("orders").select("worker_id,pages,status,assigned_at").not("worker_id", "is", null),
  ]);
  const wMap = new Map(workers.map((w) => [w.id, w]));
  return (
    <Shell session={s} title="Admin Portal" nav={adminNav}>
      <Card title="Workers">
        <Table>
          <thead><tr><Th>Worker</Th><Th>Account</Th><Th>Availability</Th><Th>Today (orders / pages)</Th><Th>Open orders</Th><Th>Last login</Th></tr></thead>
          <tbody>{accts.map((a) => {
            const w = wMap.get(a.worker_id) || {};
            const mine = orders.filter((o) => o.worker_id === a.worker_id);
            const td = mine.filter((o) => o.assigned_at >= today && o.status !== "cancelled");
            return (
              <tr key={a.id}>
                <Td><Link className="font-semibold text-blue-700 hover:underline" href={`/admin/workers/${a.id}`}>{a.display_name || a.username}</Link><div className="text-xs text-slate-500">{a.username}</div></Td>
                <Td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${chip[a.status]}`}>{a.status}</span></Td>
                <Td>{w.is_available ? "Available" : "Unavailable"}</Td>
                <Td>{td.length}/{w.max_orders_per_day} · {td.reduce((x, o) => x + o.pages, 0)}/{w.max_pages_per_day}</Td>
                <Td>{mine.filter((o) => ["assigned", "in_progress", "revision_requested"].includes(o.status)).length}</Td>
                <Td>{fmtDateTime(a.last_login_at)}</Td>
              </tr>);
          })}</tbody>
        </Table>
      </Card>
      <Card title="Add worker"><CreateWorkerForm /></Card>
    </Shell>
  );
}
