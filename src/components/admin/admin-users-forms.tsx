"use client";

import {
  AdminActionForm,
  AdminCrudDialog,
  AdminDeleteButton,
  AdminFormField,
  AdminSubmitButton,
  adminFormGridClass,
} from "@/components/admin/admin-forms";
import type { ActionResult } from "@/lib/action-result";
import { useTransition } from "react";
import { toast } from "sonner";

export function AdminUserCreateDialog({
  createAction,
}: {
  createAction: (formData: FormData) => Promise<ActionResult | void>;
}) {
  return (
    <AdminCrudDialog title="Tambah admin" triggerLabel="Tambah admin" triggerMode="icon-add">
      <AdminActionForm action={createAction} className={adminFormGridClass}>
        <AdminFormField label="Nama" name="name" required />
        <AdminFormField label="Email" name="email" type="email" required />
        <AdminFormField
          label="Password"
          name="password"
          type="password"
          required
          placeholder="Min. 8 karakter"
        />
        <AdminFormField
          label="Role"
          name="role"
          as="select"
          defaultValue="ADMIN"
          options={[
            { value: "ADMIN", label: "ADMIN" },
            { value: "SUPERADMIN", label: "SUPERADMIN" },
          ]}
        />
        <AdminSubmitButton label="Buat" />
      </AdminActionForm>
    </AdminCrudDialog>
  );
}

export function AdminUserEditDialog({
  row,
  updateAction,
}: {
  row: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  updateAction: (formData: FormData) => Promise<ActionResult | void>;
}) {
  return (
    <AdminCrudDialog title="Edit admin" triggerLabel="Edit" variant="ghost" triggerMode="icon-edit">
      <AdminActionForm action={updateAction} className={adminFormGridClass} resetOnSuccess={false}>
        <input type="hidden" name="id" value={row.id} />
        <AdminFormField label="Nama" name="name" defaultValue={row.name} required />
        <AdminFormField label="Email" name="email" type="email" defaultValue={row.email} required />
        <AdminFormField
          label="Password baru (opsional)"
          name="password"
          type="password"
          placeholder="Kosongkan jika tidak diganti"
        />
        <AdminFormField
          label="Role"
          name="role"
          as="select"
          defaultValue={row.role}
          options={[
            { value: "ADMIN", label: "ADMIN" },
            { value: "SUPERADMIN", label: "SUPERADMIN" },
          ]}
        />
        <AdminSubmitButton label="Simpan" />
      </AdminActionForm>
    </AdminCrudDialog>
  );
}

export function AdminUserToggleActiveButton({
  id,
  active,
  toggleAction,
}: {
  id: string;
  active: boolean;
  toggleAction: (id: string, active: boolean) => Promise<ActionResult>;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await toggleAction(id, !active);
          if (result.success) toast.success(result.message);
          else toast.error(result.message);
        });
      }}
      className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
    >
      {pending ? "…" : active ? "Nonaktifkan" : "Aktifkan"}
    </button>
  );
}

export function ChangeOwnPasswordForm({
  action,
}: {
  action: (formData: FormData) => Promise<ActionResult | void>;
}) {
  return (
    <AdminActionForm action={action} className={`${adminFormGridClass} max-w-md`}>
      <AdminFormField label="Password saat ini" name="currentPassword" type="password" required />
      <AdminFormField
        label="Password baru"
        name="newPassword"
        type="password"
        required
        placeholder="Min. 8 karakter"
      />
      <AdminSubmitButton label="Ganti password" />
    </AdminActionForm>
  );
}

export { AdminDeleteButton };
