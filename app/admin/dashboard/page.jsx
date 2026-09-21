export default function Dashboard() {
  return (
    <main className="min-h-screen bg-slate-100 p-8">

      <h1 className="text-4xl font-black mb-8">
        Humanize Izzuleme Dashboard
      </h1>

      <div className="grid md:grid-cols-4 gap-6">

        <div className="bg-white rounded-2xl p-6 shadow">
          <h2 className="text-gray-500">Orders Today</h2>
          <p className="text-4xl font-bold mt-3">0</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow">
          <h2 className="text-gray-500">Pending</h2>
          <p className="text-4xl font-bold mt-3">0</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow">
          <h2 className="text-gray-500">Completed</h2>
          <p className="text-4xl font-bold mt-3">0</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow">
          <h2 className="text-gray-500">Revenue</h2>
          <p className="text-4xl font-bold mt-3">RM0</p>
        </div>

      </div>

    </main>
  );
}