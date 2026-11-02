import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/lib/auth";
import LoginForm from "@/app/components/portal/LoginForm";
import { AuthPage } from "@/app/components/portal/ui";

export const metadata = { title: "Customer login" };

export default async function Page() {
  const s = await getSession();
  if (s) redirect(homeFor(s.role));
  return (
    <AuthPage title="Customer login" subtitle="Track your orders and download your documents.">
      <LoginForm kind="customer" />
      <p className="mt-4 text-center text-sm text-slate-500">No account? <Link className="font-semibold text-slate-900" href="/register">Register</Link></p>
    </AuthPage>
  );
}
