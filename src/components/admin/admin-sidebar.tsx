"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, LogOut, ListTree } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/wbs-templates", label: "Template WBS", icon: ListTree, matchPrefix: true },
  { href: "/admin/shipments", label: "Shipments", icon: Package, matchPrefix: true },
];

type Props = {
  userName: string;
  userEmail: string;
};

export function AdminSidebar({ userName, userEmail }: Props) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-5 py-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
          Indah Tracker
        </p>
        <p className="mt-1 text-lg font-bold text-neutral-900">Admin Panel</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {nav.map(({ href, label, icon: Icon, matchPrefix }) => {
          const active =
            pathname === href || (matchPrefix && pathname.startsWith(`${href}/`));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-neutral-100 p-4">
        <p className="truncate text-sm font-medium text-neutral-900">{userName}</p>
        <p className="truncate text-xs text-neutral-500">{userEmail}</p>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
