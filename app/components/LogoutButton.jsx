"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="bg-slate-900 hover:bg-slate-700 disabled:opacity-60 text-white font-bold rounded-xl px-5 py-2"
    >
      {loading ? "..." : "Logout"}
    </button>
  );
}
