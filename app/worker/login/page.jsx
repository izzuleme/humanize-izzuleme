import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "@/app/components/portal/LoginForm";
import { AuthPage } from "@/app/components/portal/ui";

export const metadata = { title: "Worker login" };

export default async function Page() {
  const s = await getSession();

  // Kalau memang dah login sebagai worker, terus ke dashboard worker
  if (s?.role === "worker") {
    redirect("/worker/dashboard");
  }

  // Kalau session sekarang customer/admin,
  // masih benarkan page Worker Login dibuka
  return (
    <AuthPage title="Worker login" subtitle="Authorised staff only.">
      <LoginForm kind="worker" />
    </AuthPage>
  );
}