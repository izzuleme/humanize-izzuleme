import Link from "next/link";
import { db } from "@/lib/supabaseAdmin";
import { requireRole } from "@/lib/auth";
import { Shell, Card, Badge, PaymentBadge, Table, Th, Td } from "@/app/components/portal/ui";
import { fmtDateTime } from "@/lib/time";
import { customerNav } from "./nav";
import { pay } from "@/lib/payment";

export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await requireRole(["customer"]);
  const { data: orders } = await db.from("orders").select("id,order_no,title,pages,deadline,status,created_at,payments(status)")
    .eq("customer_id", s.accountId).order("created_at", { ascending: false });
  return (
    <Shell session={s} title="Customer Portal" nav={customerNav}>
      {orders?.some((o) => ["rejected", "awaiting_payment"].includes(pay(o)?.status)) && (
        <div className="rounded-2xl border-l-4 border-red-500 bg-white p-4 text-sm shadow">
          <b>Action needed:</b> a payment receipt for one of your orders needs to be re-uploaded. Open the order marked "Payment Rejected" or "Awaiting Payment".
        </div>
      )}
      <Card title="My orders">
        {!orders?.length ? <p className="text-slate-500">No orders yet. <Link className="font-semibold underline" href="/portal/orders/new">Place your first order</Link>.</p> : (
          <Table>
            <thead><tr><Th>#</Th><Th>Title</Th><Th>Pages</Th><Th>Deadline</Th><Th>Payment</Th><Th>Status</Th></tr></thead>
            <tbody>{orders.map((o) => (
              <tr key={o.id}><Td>{o.order_no}</Td><Td><Link className="font-semibold text-blue-700 hover:underline" href={`/portal/orders/${o.id}`}>{o.title}</Link></Td>
                <Td>{o.pages}</Td><Td>{fmtDateTime(o.deadline)}</Td><Td><PaymentBadge status={pay(o)?.status} /></Td><Td><Badge status={o.status} /></Td></tr>
            ))}</tbody>
          </Table>
        )}
      </Card>
    </Shell>
  );
}
