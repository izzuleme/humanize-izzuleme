"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin(e) {
    e.preventDefault();

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    const data = await res.json();

    if (data.success) {
      router.push("/admin/dashboard");
    } else {
      alert("Username atau password salah.");
    }
  }

  return (
    <main className="min-h-screen flex justify-center items-center bg-slate-100">
      <form
        onSubmit={handleLogin}
        className="bg-white rounded-3xl shadow-xl p-10 w-[420px]"
      >
        <h1 className="text-3xl font-black text-slate-900 mb-8 text-center">
          Humanize Admin Login
        </h1>

        <input
          type="text"
          placeholder="Username"
          className="w-full border border-gray-300 rounded-xl p-4 mb-5 text-slate-900 placeholder:text-gray-400"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full border border-gray-300 rounded-xl p-4 mb-8 text-slate-900 placeholder:text-gray-400"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl w-full p-4"
        >
          LOGIN
        </button>
      </form>
    </main>
  );
}