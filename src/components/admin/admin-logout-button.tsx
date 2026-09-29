"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function AdminLogoutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/admin/login" })}
      className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100"
    >
      <LogOut className="h-4 w-4" />
      Logout
    </button>
  );
}
