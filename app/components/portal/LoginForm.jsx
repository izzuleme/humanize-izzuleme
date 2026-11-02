"use client";
import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { btn, input } from "./ActionForm";

export default function LoginForm({ kind }) {
  const [state, action, pending] = useActionState(loginAction, null);
  const isCustomer = kind === "customer";
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="kind" value={kind} />
      <label className="block text-sm font-medium text-slate-700">
        {isCustomer ? "Email" : "Username"}
        <input name="identifier" type={isCustomer ? "email" : "text"} autoComplete="username" required className={input + " mt-1"} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Password
        <input name="password" type="password" autoComplete="current-password" required className={input + " mt-1"} />
      </label>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className={btn + " w-full"}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
