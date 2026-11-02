import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "@/app/components/portal/LoginForm";
import { AuthPage } from "@/app/components/portal/ui";

export const metadata = { title: "Admin login" };

export default async function Page() {
  const s = await getSession();

  // Kalau memang dah login sebagai admin, terus ke dashboard admin
  if (s?.role === "admin") {
    redirect("/admin/dashboard");
  }

  // Kalau session sekarang customer/worker,
  // masih benarkan page Admin Login dibuka
  return (
    <AuthPage title="Admin login" subtitle="Authorised staff only.">
      <LoginForm kind="admin" />
    </AuthPage>
  );
}