"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ListTree,
  ChartColumn,
  Settings,
  Users,
  Wrench,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
  matchPrefix?: boolean;
  superAdminOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/admin/workshop", label: "Workshop", Icon: Wrench, matchPrefix: true },
  { href: "/admin/analytics", label: "Analytics", Icon: ChartColumn },
  {
    href: "/admin/wbs-templates",
    label: "Template WBS",
    Icon: ListTree,
    matchPrefix: true,
  },
  { href: "/admin/shipments", label: "Shipments", Icon: Package, matchPrefix: true },
  { href: "/admin/settings", label: "Settings", Icon: Settings },
  { href: "/admin/users", label: "Admin users", Icon: Users, superAdminOnly: true },
  { href: "/admin/help", label: "Alur kerja", Icon: HelpCircle },
];

export function AdminSidebarNav({ userRole }: { userRole?: string | null }) {
  const pathname = usePathname();
  const isSuper = userRole === "SUPERADMIN";

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {NAV.filter((item) => !item.superAdminOnly || isSuper).map(
        ({ href, label, Icon, matchPrefix }) => {
          const active =
            pathname === href ||
            (Boolean(matchPrefix) && pathname.startsWith(`${href}/`));
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
        }
      )}
    </nav>
  );
}
