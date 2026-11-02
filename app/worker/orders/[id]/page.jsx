import { notFound } from "next/navigation";
import { db } from "@/lib/supabaseAdmin";
import { requireRole } from "@/lib/auth";
import { isUuid } from "@/lib/validate";
import { Shell, Card, Badge, FileList } from "@/app/components/portal/ui";
import { DeliverForm, StartButton } from "@/app/components/portal/WorkerForms";
import { workerNav } from "@/app/worker/nav";
import { fmtDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function Page({ params }) {
  const s = await requireRole(["worker"]);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  // Another worker's order id returns nothing: worker_id must match the session.
  const { data: o } = await db.from("orders")
    .select("id,order_no,title,requirements,pages,from_page,to_page,style,deadline,status,delivered_at")
    .eq("id", id).eq("worker_id", s.workerId).maybeSingle();
  if (!o) notFound();
  const [{ data: files }, { data: revs }] = await Promise.all([
    db.from("order_files").select("*").eq("order_id", id).order("created_at"),
    db.from("revisions").select("*").eq("order_id", id).order("revision_no"),
  ]);
  const openRev = revs.find((r) => r.status === "open");
  const canDeliver = ["assigned", "in_progress", "revision_requested"].includes(o.status);
  return (
    <Shell session={s} title="Worker Portal" nav={workerNav}>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black">#{o.order_no} · {o.title}</h1><Badge status={o.status} />
        </div>
        <p className="mt-2 text-sm text-slate-500">{o.from_page ? `Pages ${o.from_page}–${o.to_page} (${o.pages} pages) · ${o.style} style` : `${o.pages} pages`} · deadline {fmtDateTime(o.deadline)}</p>
        <h3 className="mt-4 text-sm font-bold">Customer requirements</h3>
        <p className="mt-1 whitespace-pre-wrap text-sm">{o.requirements}</p>
        {o.status === "assigned" && <div className="mt-4"><StartButton orderId={o.id} /></div>}
      </Card>
      {openRev && (
        <Card title={`Revision #${openRev.revision_no} requested`} className="border-l-4 border-orange-400">
          <p className="whitespace-pre-wrap text-sm">{openRev.note}</p>
        </Card>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Customer documents"><FileList files={files.filter((f) => f.kind === "customer_upload")} /></Card>
        <Card title="Your completed documents"><FileList files={files.filter((f) => f.kind === "deliverable")} empty="Nothing uploaded yet." /></Card>
      </div>
      {canDeliver && <Card title={openRev ? "Deliver revision" : "Deliver work"}><DeliverForm orderId={o.id} revision={!!openRev} /></Card>}
    </Shell>
  );
}
