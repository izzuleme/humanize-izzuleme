"use client";
import ActionForm, { input } from "./ActionForm";
import { registerAction } from "@/app/actions/auth";

export default function RegisterForm() {
  return (
    <ActionForm action={registerAction} label="Create account">
      <input name="name" placeholder="Full name" required className={input} />
      <input name="email" type="email" placeholder="Email" required autoComplete="email" className={input} />
      <input name="phone" placeholder="WhatsApp number (optional)" className={input} />
      <input name="password" type="password" placeholder="Password (10+ chars, letters and numbers)" required autoComplete="new-password" className={input} />
    </ActionForm>
  );
}
