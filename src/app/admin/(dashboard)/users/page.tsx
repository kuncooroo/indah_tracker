import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isSuperAdmin, requireAdmin } from "@/lib/auth";
import {
  changeOwnPassword,
  createAdminUser,
  deleteAdminUser,
  setAdminActive,
  updateAdminUser,
} from "@/lib/admin-users-actions";
import {
  AdminUserCreateDialog,
  AdminUserEditDialog,
  AdminUserToggleActiveButton,
  ChangeOwnPasswordForm,
  AdminDeleteButton,
} from "@/components/admin/admin-users-forms";
import { formatDateId } from "@/lib/utils";

export default async function AdminUsersPage() {
  await requireAdmin();
  const session = await getAdminSession();
  if (!isSuperAdmin(session)) {
    redirect("/admin/settings");
  }

  const users = await prisma.admin.findMany({
    orderBy: [{ role: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/settings" className="text-sm text-neutral-500 hover:text-neutral-800">
            ← Settings
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900">
            Kelola admin
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            SUPERADMIN dapat menambah, mengubah role, menonaktifkan, dan menghapus user.
          </p>
        </div>
        <AdminUserCreateDialog createAction={createAdminUser} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-100 bg-neutral-50/80 text-neutral-500">
            <tr>
              <th className="px-5 py-3 font-medium">Nama</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Dibuat</th>
              <th className="px-5 py-3 text-right font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-5 py-3 font-medium text-neutral-900">
                  {u.name}
                  {session?.user?.id === u.id ? (
                    <span className="ml-2 text-[10px] font-normal text-neutral-400">(Anda)</span>
                  ) : null}
                </td>
                <td className="px-5 py-3 text-neutral-600">{u.email}</td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      u.role === "SUPERADMIN"
                        ? "bg-violet-50 text-violet-800"
                        : "bg-neutral-100 text-neutral-700"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      u.active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                    }`}
                  >
                    {u.active ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs text-neutral-500">{formatDateId(u.createdAt)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <AdminUserEditDialog row={u} updateAction={updateAdminUser} />
                    <AdminUserToggleActiveButton
                      id={u.id}
                      active={u.active}
                      toggleAction={setAdminActive}
                    />
                    <AdminDeleteButton
                      action={async () => {
                        "use server";
                        return deleteAdminUser(u.id);
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Ganti password Anda</h2>
        <p className="mt-1 text-xs text-neutral-500">Berlaku untuk akun yang sedang login.</p>
        <div className="mt-4">
          <ChangeOwnPasswordForm action={changeOwnPassword} />
        </div>
      </section>
    </div>
  );
}
