import { requireRole } from "@/lib/auth";
import PasswordForm from "@/app/components/portal/PasswordForm";
import { AuthPage } from "@/app/components/portal/ui";

export default async function Page() {
  const s = await requireRole(["customer", "worker", "admin"], { allowMustChange: true });
  return (
    <AuthPage title="Change password" subtitle={s.mustChange ? "You must choose a new password before continuing." : "Other devices will be signed out."}>
      <PasswordForm />
    </AuthPage>
  );
}
