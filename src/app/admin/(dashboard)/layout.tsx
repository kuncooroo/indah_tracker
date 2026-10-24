import { redirectUnlessAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await redirectUnlessAdmin();

  return <AdminShell>{children}</AdminShell>;
}
