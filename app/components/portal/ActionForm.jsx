"use client";
import { useActionState } from "react";

export const btn = "rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50";

export const btnDanger = "rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50";

export const btnGhost = "rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50";

export const input = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100 disabled:text-slate-500";
// Generic <form> bound to a server action. All authorization happens inside the action.
export default function ActionForm({ action, fields = {}, label, confirm, tone = "dark", inline = false, children }) {
  const [state, formAction, pending] = useActionState(action, null);
  const cls = tone === "danger" ? btnDanger : tone === "ghost" ? btnGhost : btn;
  return (
    <form
      action={formAction}
      className={inline ? "inline-block align-top" : "space-y-3"}
      onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}
    >
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v ?? ""} />)}
      {children}
      <button type="submit" disabled={pending} className={cls}>{pending ? "Please wait…" : label}</button>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state?.message && <p className="text-sm font-medium text-emerald-700 break-all">{state.message}</p>}
    </form>
  );
}
