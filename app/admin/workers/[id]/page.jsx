import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/supabaseAdmin";
import { requireRole } from "@/lib/auth";
import { Shell, Card, Stat, Badge, Table, Th, Td } from "@/app/components/portal/ui";
import { WorkerEditForm, StatusButtons, ResetPasswordButton } from "@/app/components/portal/AdminForms";
import { adminNav } from "../../nav";
import { fmtDateTime, money } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function Page({ params }) {
  const s = await requireRole(["admin"]);
  const { id } = await params;
  const { data: a } = await db.from("worker_accounts")
    .select("id,username,display_name,status,worker_id,last_login_at,created_at,must_change_password,locked_until,role").eq("id", id).maybeSingle();
  if (!a || a.role !== "worker") notFound();
  const [{ data: w }, { data: orders }, { data: pay }] = await Promise.all([
    db.from("workers").select("*").eq("id", a.worker_id).single(),
    db.from("orders").select("id,order_no,title,pages,status,deadline").eq("worker_id", a.worker_id).order("deadline", { ascending: false }).limit(50),
    db.from("payroll_entries").select("amount,status").eq("worker_id", a.worker_id),
  ]);
  const sum = (st) => pay.filter((p) => p.status === st).reduce((x, p) => x + Number(p.amount), 0);
  return (
    <Shell session={s} title="Admin Portal" nav={adminNav}>
      <Card>
        <h1 className="text-2xl font-black">{a.display_name || a.username} <span className="text-base font-normal text-slate-500">@{a.username}</span></h1>
        <p className="mt-1 text-sm text-slate-500">
          Status: <b>{a.status}</b> · Last login {fmtDateTime(a.last_login_at)} · Created {fmtDateTime(a.created_at)}
          {a.must_change_password && " · must change password"}{a.locked_until && new Date(a.locked_until) > new Date() && " · locked after failed attempts"}
        </p>
        <p className="mt-1 text-sm text-slate-500">WhatsApp: {w.phone}</p>
        <div className="mt-4 flex flex-wrap items-start gap-4"><StatusButtons accountId={a.id} status={a.status} /><ResetPasswordButton accountId={a.id} /></div>
      </Card>
      <div className="grid gap-6 md:grid-cols-3">
        <Stat label="Unpaid" value={money(sum("pending"))} /><Stat label="Paid" value={money(sum("paid"))} /><Stat label="Pay rate / page" value={money(w.pay_rate_per_page)} />
      </div>
      <Card title="Availability, workload and pay"><WorkerEditForm accountId={a.id} displayName={a.display_name || ""} w={w} /></Card>
      <Card title="Orders">
        <Table><thead><tr><Th>#</Th><Th>Title</Th><Th>Pages</Th><Th>Deadline</Th><Th>Status</Th></tr></thead>
          <tbody>{orders.map((o) => (
            <tr key={o.id}><Td>{o.order_no}</Td><Td><Link className="text-blue-700 hover:underline" href={`/admin/orders/${o.id}`}>{o.title}</Link></Td>
              <Td>{o.pages}</Td><Td>{fmtDateTime(o.deadline)}</Td><Td><Badge status={o.status} /></Td></tr>))}</tbody></Table>
      </Card>
    </Shell>
  );
}
