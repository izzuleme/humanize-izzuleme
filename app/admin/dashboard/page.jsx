import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePageRole } from "@/lib/guards";
import { isCompleted, isPaid, startOfTodayMY } from "@/lib/orderConfig";
import LogoutButton from "@/app/components/LogoutButton";
import WorkerManager from "./WorkerManager";

export const dynamic = "force-dynamic";

const RECENT_ORDER_COLUMNS =
  "id, order_number, customer_phone, customer_country, pages, price, status, payment_status, created_at, worker_id, completed_at";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function Dashboard() {
  // Server-side guard: redirects to /login unless a valid ADMIN session exists.
  const session = await requirePageRole("admin");

  const supabase = getSupabaseAdmin();

  const [workersRes, accountsRes, statsRes, recentRes] = await Promise.all([
    supabase
      .from("workers")
      .select("id, name, phone, active, orders")
      .order("id", { ascending: true }),
    // never select password / password_hash here
    supabase
      .from("worker_accounts")
      .select("id, username, role, worker_id")
      .eq("role", "worker"),
    supabase
      .from("orders")
      .select("id, price, payment_status, completed_at, created_at, worker_id")
      .order("created_at", { ascending: false })
      .limit(10000),
    supabase
      .from("orders")
      .select(RECENT_ORDER_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const failed = [workersRes, accountsRes, statsRes, recentRes].some((r) => r.error);
  for (const r of [workersRes, accountsRes, statsRes, recentRes]) {
    if (r.error) console.error("admin dashboard query failed:", r.error.code);
  }

  const workers = workersRes.data || [];
  const accounts = accountsRes.data || [];
  const allOrders = statsRes.data || [];
  const recentOrders = recentRes.data || [];

  const todayStart = new Date(startOfTodayMY()).getTime();
  const ordersToday = allOrders.filter(
    (o) => o.created_at && new Date(o.created_at).getTime() >= todayStart
  ).length;
  const completed = allOrders.filter(isCompleted).length;
  const pending = allOrders.length - completed;
  const revenue = allOrders
    .filter(isPaid)
    .reduce((sum, o) => sum + (Number(o.price) || 0), 0);

  const openByWorker = {};
  for (const o of allOrders) {
    if (o.worker_id != null && !isCompleted(o)) {
      openByWorker[o.worker_id] = (openByWorker[o.worker_id] || 0) + 1;
    }
  }

  const usernameByWorker = {};
  for (const a of accounts) {
    if (a.worker_id != null) usernameByWorker[a.worker_id] = a.username;
  }

  const workerRows = workers.map((w) => ({
    id: w.id,
    name: w.name,
    phone: w.phone,
    active: w.active === true,
    orders: w.orders || 0,
    openOrders: openByWorker[w.id] || 0,
    loginUsername: usernameByWorker[w.id] || null,
  }));

  const workerName = Object.fromEntries(workers.map((w) => [w.id, w.name]));

  return (
    <main className="min-h-screen bg-slate-100 p-8">

      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <h1 className="text-4xl font-black">
          Humanize Izzuleme Dashboard
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-500">Admin: {session.username}</span>
          <LogoutButton />
        </div>
      </div>

      {failed && (
        <p className="mb-6 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 p-3">
          Sebahagian data gagal dimuat. Semak log server.
        </p>
      )}

      <div className="grid md:grid-cols-4 gap-6">

        <div className="bg-white rounded-2xl p-6 shadow">
          <h2 className="text-gray-500">Orders Today</h2>
          <p className="text-4xl font-bold mt-3">{ordersToday}</p>
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
          <h2 className="text-gray-500">Revenue</h2>
          <p className="text-4xl font-bold mt-3">
            RM{revenue.toLocaleString("en-MY", { maximumFractionDigits: 2 })}
          </p>
        </div>

      </div>

      <WorkerManager workers={workerRows} />

      <section className="bg-white rounded-2xl p-6 shadow mt-8">
        <h2 className="text-2xl font-black mb-4">Recent Orders</h2>

        {recentOrders.length === 0 ? (
          <p className="text-gray-500">Belum ada order.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-gray-500 border-b">
                  <th className="py-2 pr-4">Order</th>
                  <th className="py-2 pr-4">Customer</th>
                  <th className="py-2 pr-4">Pages</th>
                  <th className="py-2 pr-4">Price</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Payment</th>
                  <th className="py-2 pr-4">Worker</th>
                  <th className="py-2 pr-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} className="border-b last:border-0 text-slate-900">
                    <td className="py-2 pr-4 font-semibold">{o.order_number || `#${o.id}`}</td>
                    <td className="py-2 pr-4">
                      {o.customer_phone || "-"}
                      {o.customer_country ? ` (${o.customer_country})` : ""}
                    </td>
                    <td className="py-2 pr-4">{o.pages ?? "-"}</td>
                    <td className="py-2 pr-4">{o.price != null ? `RM${o.price}` : "-"}</td>
                    <td className="py-2 pr-4">{o.status || (o.completed_at ? "completed" : "-")}</td>
                    <td className="py-2 pr-4">{o.payment_status || "-"}</td>
                    <td className="py-2 pr-4">{workerName[o.worker_id] || "-"}</td>
                    <td className="py-2 pr-4">{formatDate(o.created_at)}</td>
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
