"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "border border-gray-300 rounded-xl px-3 py-2 text-slate-900 placeholder:text-gray-400";

async function callApi(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Sesi tamat. Sila log masuk semula.");
  }
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Permintaan gagal.");
  }
  return data;
}

function WorkerRow({ worker, onChanged, onError }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(worker.name || "");
  const [phone, setPhone] = useState(worker.phone || "");
  const [loginOpen, setLoginOpen] = useState(false);
  const [username, setUsername] = useState(worker.loginUsername || "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn) {
    setBusy(true);
    onError("");
    try {
      await fn();
      onChanged();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const toggleActive = () =>
    run(() => callApi(`/api/admin/workers/${worker.id}`, "PATCH", { active: !worker.active }));

  const saveDetails = () =>
    run(async () => {
      await callApi(`/api/admin/workers/${worker.id}`, "PATCH", { name, phone });
      setEditing(false);
    });

  const saveLogin = () =>
    run(async () => {
      await callApi(`/api/admin/workers/${worker.id}/account`, "PUT", { username, password });
      setPassword("");
      setLoginOpen(false);
    });

  return (
    <tr className="border-b last:border-0 align-top text-slate-900">
      <td className="py-3 pr-4">{worker.id}</td>

      <td className="py-3 pr-4">
        {editing ? (
          <div className="flex flex-col gap-2">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="60123456789" />
            <div className="flex gap-2">
              <button disabled={busy} onClick={saveDetails} className="bg-blue-600 text-white rounded-lg px-3 py-1 font-semibold disabled:opacity-60">Save</button>
              <button disabled={busy} onClick={() => setEditing(false)} className="bg-slate-200 rounded-lg px-3 py-1 font-semibold">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div className="font-semibold">{worker.name}</div>
            <div className="text-gray-500">{worker.phone}</div>
          </>
        )}
      </td>

      <td className="py-3 pr-4">
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
            worker.active ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
          }`}
        >
          {worker.active ? "Active" : "Inactive"}
        </span>
      </td>

      <td className="py-3 pr-4">{worker.orders}</td>
      <td className="py-3 pr-4">{worker.openOrders}</td>

      <td className="py-3 pr-4">
        {loginOpen ? (
          <div className="flex flex-col gap-2">
            <input
              className={inputClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoComplete="off"
            />
            <input
              className={inputClass}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (min 8)"
              autoComplete="new-password"
            />
            <div className="flex gap-2">
              <button disabled={busy} onClick={saveLogin} className="bg-blue-600 text-white rounded-lg px-3 py-1 font-semibold disabled:opacity-60">Save</button>
              <button disabled={busy} onClick={() => { setLoginOpen(false); setPassword(""); }} className="bg-slate-200 rounded-lg px-3 py-1 font-semibold">Cancel</button>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-gray-500 mb-1">{worker.loginUsername || "No login"}</div>
            <button onClick={() => setLoginOpen(true)} className="text-blue-600 font-semibold hover:underline">
              {worker.loginUsername ? "Reset password" : "Create login"}
            </button>
          </div>
        )}
      </td>

      <td className="py-3">
        <div className="flex flex-col gap-2 items-start">
          <button
            disabled={busy}
            onClick={toggleActive}
            className="bg-slate-900 hover:bg-slate-700 text-white rounded-lg px-3 py-1 font-semibold disabled:opacity-60"
          >
            {worker.active ? "Set inactive" : "Set active"}
          </button>
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-blue-600 font-semibold hover:underline">
              Edit details
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function WorkerManager({ workers }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [adding, setAdding] = useState(false);

  const refresh = () => router.refresh();

  async function addWorker(e) {
    e.preventDefault();
    setError("");
    setAdding(true);
    try {
      await callApi("/api/admin/workers", "POST", { name: newName, phone: newPhone });
      setNewName("");
      setNewPhone("");
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl p-6 shadow mt-8">
      <h2 className="text-2xl font-black mb-1">Workers</h2>
      <p className="text-gray-500 mb-4">
        Only active workers receive customers from the WhatsApp rotation.
      </p>

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3">
          {error}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-gray-500 border-b">
              <th className="py-2 pr-4">ID</th>
              <th className="py-2 pr-4">Worker</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4" title="Customers sent to this worker by the rotation">Leads</th>
              <th className="py-2 pr-4">Open orders</th>
              <th className="py-2 pr-4">Login</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((w) => (
              <WorkerRow key={w.id} worker={w} onChanged={refresh} onError={setError} />
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={addWorker} className="flex flex-wrap gap-3 mt-6 items-center">
        <input className={inputClass} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New worker name" />
        <input className={inputClass} value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Phone e.g. 60123456789" />
        <button
          type="submit"
          disabled={adding}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl px-5 py-2 disabled:opacity-60"
        >
          {adding ? "Adding..." : "Add worker"}
        </button>
      </form>
    </section>
  );
}
