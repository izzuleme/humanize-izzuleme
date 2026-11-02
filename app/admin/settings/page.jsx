import { db } from "@/lib/supabaseAdmin";
import { requireRole } from "@/lib/auth";
import { Shell, Card } from "@/app/components/portal/ui";
import { PaymentSettingsForm } from "@/app/components/portal/AdminForms";
import { adminNav } from "../nav";

export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await requireRole(["admin"]);
  const { data } = await db.from("payment_settings").select("*").eq("id", 1).single();
  return (
    <Shell session={s} title="Admin Portal" nav={adminNav}>
      <Card title="Payment settings">
        <p className="mb-4 text-sm text-slate-600">Customers only see the bank details after they log in and click "Pay via WhatsApp", or on their own order when a receipt is needed. Nothing here is hardcoded in the app.</p>
        <PaymentSettingsForm s={data || {}} />
      </Card>
    </Shell>
  );
}
