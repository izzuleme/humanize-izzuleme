import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePageRole } from "@/lib/guards";
import { isCompleted } from "@/lib/orderConfig";
import LogoutButton from "@/app/components/LogoutButton";

export const dynamic = "force-dynamic";

// Price is intentionally not selected: workers do not need revenue data.
const WORKER_ORDER_COLUMNS =
  "id, order_number, customer_phone, customer_country, pages, status, payment_status, file_url, result_url, created_at, assigned_at, completed_at";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function WorkerDashboard() {
  // Server-side guard: only a valid WORKER session gets in. The worker id comes
  // from the database-verified session, never from the browser.
  const session = await requirePageRole("worker");

  const supabase = getSupabaseAdmin();

  const [workerRes, ordersRes] = await Promise.all([
    supabase
      .from("workers")
      .select("id, name, active, orders")
      .eq("id", session.workerId)
      .maybeSingle(),
    supabase
      .from("orders")
      .select(WORKER_ORDER_COLUMNS)
      .eq("worker_id", session.workerId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  for (const r of [workerRes, ordersRes]) {
    if (r.error) console.error("worker dashboard query failed:", r.error.code);
  }

  const worker = workerRes.data;
  const orders = ordersRes.data || [];
  const completed = orders.filter(isCompleted).length;
  const pending = orders.length - completed;

  return (
    <main className="min-h-screen bg-slate-100 p-8">

      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <h1 className="text-4xl font-black">
          {worker?.name ? `${worker.name} Dashboard` : "Worker Dashboard"}
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-500">{session.username}</span>
          <LogoutButton />
        </div>
      </div>

      {(workerRes.error || ordersRes.error) && (
        <p className="mb-6 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 p-3">
          Sebahagian data gagal dimuat. Sila cuba lagi.
        </p>
      )}

      <div className="grid md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow">
          <h2 className="text-gray-500">My Orders</h2>
          <p className="text-4xl font-bold mt-3">{orders.length}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow">
          <h2 className="text-gray-500">Pending</h2>
          <p className="text-4xl font-bold mt-3">{pending}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow">
          <h2 className="text-gray-500">Completed</h2>
          <p className="text-4xl font-bold mt-3">{completed}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow">
          <h2 className="text-gray-500">WhatsApp Leads</h2>
          <p className="text-4xl font-bold mt-3">{worker?.orders ?? 0}</p>
          <p className="text-sm text-gray-500 mt-1">
            {worker?.active ? "You are receiving customers" : "Currently not receiving customers"}
          </p>
        </div>
      </div>

      <section className="bg-white rounded-2xl p-6 shadow mt-8">
        <h2 className="text-2xl font-black mb-4">My Orders</h2>

        {orders.length === 0 ? (
          <p className="text-gray-500">Belum ada order untuk anda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-gray-500 border-b">
                  <th className="py-2 pr-4">Order</th>
                  <th className="py-2 pr-4">Customer</th>
                  <th className="py-2 pr-4">Pages</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Payment</th>
                  <th className="py-2 pr-4">Files</th>
                  <th className="py-2 pr-4">Assigned</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b last:border-0 text-slate-900">
                    <td className="py-2 pr-4 font-semibold">{o.order_number || `#${o.id}`}</td>
                    <td className="py-2 pr-4">
                      {o.customer_phone || "-"}
                      {o.customer_country ? ` (${o.customer_country})` : ""}
                    </td>
                    <td className="py-2 pr-4">{o.pages ?? "-"}</td>
                    <td className="py-2 pr-4">{o.status || (o.completed_at ? "completed" : "-")}</td>
                    <td className="py-2 pr-4">{o.payment_status || "-"}</td>
                    <td className="py-2 pr-4">
                      {o.file_url && /^https?:\/\//i.test(o.file_url) ? (
                        <a href={o.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline mr-3">
                          Upload
                        </a>
                      ) : null}
                      {o.result_url && /^https?:\/\//i.test(o.result_url) ? (
                        <a href={o.result_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          Result
                        </a>
                      ) : null}
                      {!o.file_url && !o.result_url ? "-" : null}
                    </td>
                    <td className="py-2 pr-4">{formatDate(o.assigned_at || o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </main>
  );
}
