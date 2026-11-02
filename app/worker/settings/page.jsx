import { db } from "@/lib/supabaseAdmin";
import { requireRole } from "@/lib/auth";
import { Shell, Card } from "@/app/components/portal/ui";
import { AvailabilityToggle, MySettingsForm } from "@/app/components/portal/WorkerForms";
import { workerNav } from "../nav";

export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await requireRole(["worker"]);
  const { data: w } = await db.from("workers").select("*").eq("id", s.workerId).single();
  return (
    <Shell session={s} title="Worker Portal" nav={workerNav}>
      <Card title="Availability">
        <p className="mb-3 text-sm text-slate-600">New orders are only auto-assigned to you while you are <b>Available</b>, inside your working hours, and under your daily limits.</p>
        <p className="mb-3 text-sm">Currently: <b>{w.is_available ? "Available" : "Unavailable"}</b></p>
        <AvailabilityToggle available={w.is_available} />
      </Card>
      <Card title="Daily limits & working hours (Malaysia time)"><MySettingsForm w={w} /></Card>
    </Shell>
  );
}
