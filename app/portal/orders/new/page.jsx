import { db } from "@/lib/supabaseAdmin";
import { requireRole } from "@/lib/auth";
import { Shell, Card } from "@/app/components/portal/ui";
import NewOrderForm from "@/app/components/portal/NewOrderForm";
import { customerNav } from "@/app/portal/nav";

export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await requireRole(["customer"]);
  const [{ data: c }, { data: cust }] = await Promise.all([
    db.from("payment_settings").select("whatsapp_number,price_standard,price_academic").eq("id", 1).single(),
    db.from("customers").select("phone").eq("id", s.accountId).single(),
  ]);
  return (
    <Shell session={s} title="Customer Portal" nav={customerNav}>
      <Card title="New order">
        {!c?.whatsapp_number ? (
          <p className="text-slate-600">Ordering is not available yet. Please try again later.</p>
        ) : (
          <NewOrderForm customerName={s.name} defaultPhone={cust?.phone || ""} whatsapp={c.whatsapp_number}
            rates={{ standard: Number(c.price_standard), academic: Number(c.price_academic) }} />
        )}
      </Card>
    </Shell>
  );
}
