import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { AdminSidebarNav } from "@/components/admin/admin-sidebar-nav";

type Props = {
  userName: string;
  userEmail: string;
  userRole?: string | null;
};

/**
 * Tinggi sidebar mengikuti tinggi konten utama (items-stretch di parent).
 * Logout selalu di bagian bawah sidebar, tidak kepotong.
 */
export function AdminSidebar({ userName, userEmail, userRole }: Props) {
  return (
    <aside className="flex w-60 shrink-0 flex-col self-stretch border-r border-neutral-200 bg-white print:hidden">
      <div className="shrink-0 border-b border-neutral-100 px-5 py-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
          Indah Tracker
        </p>
        <p className="mt-1 text-lg font-bold text-neutral-900">Admin Panel</p>
        {userRole ? (
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
            {userRole}
          </p>
        ) : null}
      </div>

      <AdminSidebarNav userRole={userRole} />

      <div className="mt-auto shrink-0 border-t border-neutral-100 p-4">
        <p className="truncate text-sm font-medium text-neutral-900">{userName}</p>
        <p className="truncate text-xs text-neutral-500">{userEmail}</p>
        <AdminLogoutButton />
      </div>
    </aside>
  );
}
