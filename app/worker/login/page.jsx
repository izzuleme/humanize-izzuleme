import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/lib/auth";
import LoginForm from "@/app/components/portal/LoginForm";
import { AuthPage } from "@/app/components/portal/ui";

export const metadata = { title: "Worker login" };

export default async function Page() {
  const s = await getSession();
  if (s) redirect(homeFor(s.role));
  return (
    <AuthPage title="Worker login" subtitle="Authorised staff only.">
      <LoginForm kind="worker" />
    </AuthPage>
  );
}
