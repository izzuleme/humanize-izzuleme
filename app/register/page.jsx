import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/lib/auth";
import RegisterForm from "@/app/components/portal/RegisterForm";
import { AuthPage } from "@/app/components/portal/ui";

export const metadata = { title: "Create account" };

export default async function Page() {
  const s = await getSession();
  if (s) redirect(homeFor(s.role));
  return (
    <AuthPage title="Create account" subtitle="Place and track orders in one place.">
      <RegisterForm />
      <p className="mt-4 text-center text-sm text-slate-500">Already registered? <Link className="font-semibold text-slate-900" href="/login">Log in</Link></p>
    </AuthPage>
  );
}
