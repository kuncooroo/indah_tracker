import { getAdminSession } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  return (
    <div className="flex min-h-dvh items-stretch bg-neutral-50 font-sans text-neutral-900 antialiased">
      <AdminSidebar
        userName={session?.user?.name ?? "Admin"}
        userEmail={session?.user?.email ?? "admin@tracker.local"}
        userRole={session?.user?.role}
      />
      <main className="min-w-0 flex-1 p-8 print:p-0">{children}</main>
    </div>
  );
}
