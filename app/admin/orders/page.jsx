import Link from "next/link";
import { db } from "@/lib/supabaseAdmin";
import { requireRole } from "@/lib/auth";
import { Shell, Card, Badge, STATUS, Table, Th, Td } from "@/app/components/portal/ui";
import { adminNav } from "../nav";
import { fmtDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }) {
  const s = await requireRole(["admin"]);
  const { status } = await searchParams;
  let q = db.from("orders").select("id,order_no,title,pages,deadline,status,worker_id,customers(name)").order("created_at", { ascending: false }).limit(300);
  if (status && STATUS[status]) q = q.eq("status", status);
  const [{ data: orders }, { data: accts }] = await Promise.all([q, db.from("worker_accounts").select("worker_id,username,display_name,status").eq("role", "worker")]);
  const byW = new Map(accts.map((a) => [a.worker_id, a]));
  return (
    <Shell session={s} title="Admin Portal" nav={adminNav}>
      <Card title="Orders">
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <Link href="/admin/orders" className="rounded-full border px-3 py-1">All</Link>
          {Object.entries(STATUS).map(([k, [l]]) => <Link key={k} href={`/admin/orders?status=${k}`} className="rounded-full border px-3 py-1">{l}</Link>)}
        </div>
        <Table><thead><tr><Th>#</Th><Th>Title</Th><Th>Customer</Th><Th>Worker</Th><Th>Deadline</Th><Th>Status</Th></tr></thead>
          <tbody>{orders.map((o) => {
            const a = byW.get(o.worker_id);
            return (
              <tr key={o.id}><Td>{o.order_no}</Td><Td><Link className="font-semibold text-blue-700 hover:underline" href={`/admin/orders/${o.id}`}>{o.title}</Link></Td>
                <Td>{o.customers?.name}</Td>
                <Td>{a ? (a.display_name || a.username) : "-"}{a && a.status !== "active" && <span className="ml-1 text-xs font-semibold text-red-600">({a.status})</span>}</Td>
                <Td>{fmtDateTime(o.deadline)}</Td><Td><Badge status={o.status} /></Td></tr>);
          })}</tbody></Table>
      </Card>
    </Shell>
  );
}
