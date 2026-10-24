"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();

  const [mode, setMode] = useState("admin"); // "admin" | "worker"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/${mode}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        // non-JSON response, handled below
      }

      if (res.ok && data?.success) {
        router.replace(data.redirectTo);
        router.refresh();
        return;
      }

      setError(
        data?.message ||
          (res.status === 429
            ? "Terlalu banyak percubaan. Sila cuba lagi sebentar."
            : "Log masuk gagal. Sila cuba lagi.")
      );
    } catch {
      setError("Tidak dapat menghubungi server. Semak sambungan internet anda.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setError("");
  }

  const tabClass = (active) =>
    `flex-1 rounded-xl py-2 font-bold transition ${
      active
        ? "bg-blue-600 text-white"
        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    }`;

  return (
    <main className="min-h-screen flex justify-center items-center bg-slate-100 px-4">
      <form
        onSubmit={handleLogin}
        className="bg-white rounded-3xl shadow-xl p-10 w-full max-w-[420px]"
      >
        <h1 className="text-3xl font-black text-slate-900 mb-6 text-center">
          Humanize {mode === "admin" ? "Admin" : "Worker"} Login
        </h1>

        <div className="flex gap-2 mb-6">
          <button
            type="button"
            className={tabClass(mode === "admin")}
            onClick={() => switchMode("admin")}
          >
            Admin
          </button>
          <button
            type="button"
            className={tabClass(mode === "worker")}
            onClick={() => switchMode("worker")}
          >
            Worker
          </button>
        </div>

        <input
          type="text"
          placeholder="Username"
          autoComplete="username"
          className="w-full border border-gray-300 rounded-xl p-4 mb-5 text-slate-900 placeholder:text-gray-400"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          className="w-full border border-gray-300 rounded-xl p-4 mb-6 text-slate-900 placeholder:text-gray-400"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <p
            role="alert"
            className="mb-6 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold rounded-xl w-full p-4"
        >
          {loading ? "Sila tunggu..." : "LOGIN"}
        </button>
      </form>
    </main>
  );
}
