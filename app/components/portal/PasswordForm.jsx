"use client";
import ActionForm, { input } from "./ActionForm";
import { changePasswordAction } from "@/app/actions/auth";

export default function PasswordForm() {
  return (
    <ActionForm action={changePasswordAction} label="Change password">
      {[["current", "Current password", "current-password"], ["next", "New password (10+ chars, letters and numbers)", "new-password"], ["confirm", "Confirm new password", "new-password"]].map(([n, l, ac]) => (
        <label key={n} className="block text-sm font-medium text-slate-700">{l}
          <input name={n} type="password" autoComplete={ac} required className={input + " mt-1"} />
        </label>
      ))}
    </ActionForm>
  );
}
