import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/admin/admin-login-form";

export const metadata: Metadata = {
  title: "Login Admin",
};

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
            Indah Tracker
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
            Admin
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Masuk ke dashboard tracking operasional.
          </p>
        </div>
        <div className="mt-6">
          <AdminLoginForm />
        </div>
      </div>
    </div>
  );
}
