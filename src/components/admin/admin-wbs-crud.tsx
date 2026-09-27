"use client";

import {
  AdminCrudDialog,
  AdminFormField,
  AdminCheckboxField,
  AdminFileField,
  AdminSubmitButton,
  AdminActionForm,
  adminFormGridClass,
} from "@/components/admin/admin-forms";
import type { ActionResult } from "@/lib/action-result";

export function WbsTemplateCreateDialog({
  createAction,
}: {
  createAction: (formData: FormData) => Promise<ActionResult | void>;
}) {
  return (
    <AdminCrudDialog title="Tambah Template WBS" triggerLabel="Tambah template WBS" triggerMode="icon-add">
      <AdminActionForm action={createAction} className={adminFormGridClass}>
        <AdminFormField label="Nama" name="name" required />
        <AdminFormField label="Estimasi hari" name="estimatedDays" type="number" defaultValue="30" min={1} required />
        <AdminFormField label="Deskripsi" name="description" as="textarea" />
        <AdminCheckboxField label="Aktif" name="active" defaultChecked />
        <AdminSubmitButton label="Simpan" />
      </AdminActionForm>
    </AdminCrudDialog>
  );
}

export function WbsTemplateEditDialog({
  row,
  updateAction,
}: {
  row: {
    id: string;
    name: string;
    description: string | null;
    estimatedDays: number;
    active: boolean;
  };
  updateAction: (formData: FormData) => Promise<ActionResult | void>;
}) {
  return (
    <AdminCrudDialog title="Edit Template" triggerLabel="Edit" variant="ghost" triggerMode="icon-edit">
      <AdminActionForm action={updateAction} className={adminFormGridClass} resetOnSuccess={false}>
        <input type="hidden" name="id" value={row.id} />
        <AdminFormField label="Nama" name="name" defaultValue={row.name} required />
        <AdminFormField
          label="Estimasi hari"
          name="estimatedDays"
          type="number"
          defaultValue={String(row.estimatedDays)}
          min={1}
          required
        />
        <AdminFormField label="Deskripsi" name="description" as="textarea" defaultValue={row.description ?? ""} />
        <AdminCheckboxField label="Aktif" name="active" defaultChecked={row.active} />
        <AdminSubmitButton label="Update" />
      </AdminActionForm>
    </AdminCrudDialog>
  );
}

export function WbsTemplateItemCreateDialog({
  templateId,
  parentId,
  parentTitle,
  createAction,
}: {
  templateId: string;
  parentId?: string;
  parentTitle?: string;
  createAction: (formData: FormData) => Promise<ActionResult | void>;
}) {
  const isChild = Boolean(parentId);
  return (
    <AdminCrudDialog
      title={isChild ? `Sub-tugas: ${parentTitle ?? ""}` : "Tambah fase (parent)"}
      triggerLabel={isChild ? "Tambah sub-tugas" : "Tambah fase"}
      triggerMode="icon-add"
      variant={isChild ? "ghost" : "primary"}
    >
      <AdminActionForm action={createAction} className={adminFormGridClass}>
        <input type="hidden" name="templateId" value={templateId} />
        {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
        <AdminFormField
          label={isChild ? "Judul sub-tugas" : "Judul fase"}
          name="title"
          required
          placeholder={isChild ? "Cover boiler" : "Mengerjakan Boiler"}
        />
        <AdminFormField label="Urutan" name="sortOrder" type="number" defaultValue="0" />
        {isChild ? (
          <AdminFormField
            label="Estimasi jam (maks 8)"
            name="estimatedHours"
            type="number"
            defaultValue="8"
            min={1}
            max={8}
            required
          />
        ) : null}
        <AdminSubmitButton label="Tambah" />
      </AdminActionForm>
    </AdminCrudDialog>
  );
}

export function WbsTemplateItemEditDialog({
  row,
  updateAction,
}: {
  row: {
    id: string;
    title: string;
    sortOrder: number;
    estimatedHours: number | null;
    parentId: string | null;
  };
  updateAction: (formData: FormData) => Promise<ActionResult | void>;
}) {
  return (
    <AdminCrudDialog title="Edit item" triggerLabel="Edit" variant="ghost" triggerMode="icon-edit">
      <AdminActionForm action={updateAction} className={adminFormGridClass} resetOnSuccess={false}>
        <input type="hidden" name="id" value={row.id} />
        <AdminFormField label="Judul" name="title" defaultValue={row.title} required />
        <AdminFormField label="Urutan" name="sortOrder" type="number" defaultValue={String(row.sortOrder)} />
        {row.parentId ? (
          <AdminFormField
            label="Estimasi jam (maks 8)"
            name="estimatedHours"
            type="number"
            defaultValue={String(row.estimatedHours ?? 8)}
            min={1}
            max={8}
          />
        ) : null}
        <AdminSubmitButton label="Update" />
      </AdminActionForm>
    </AdminCrudDialog>
  );
}

const progressStatusOptions = [
  { value: "NOT_STARTED", label: "Belum mulai" },
  { value: "IN_PROGRESS", label: "Dikerjakan" },
  { value: "COMPLETED", label: "Selesai" },
];

export function ProgressTaskUpdateDialog({
  row,
  updateAction,
}: {
  row: {
    id: string;
    title: string;
    status: string;
    actualHours: number | null;
    estimatedHours: number | null;
    note: string | null;
    parentId: string | null;
  };
  updateAction: (formData: FormData) => Promise<ActionResult | void>;
}) {
  const isChild = Boolean(row.parentId);
  return (
    <AdminCrudDialog
      title={`Update: ${row.title}`}
      triggerLabel="Update progress"
      variant="ghost"
      triggerMode="icon-edit"
    >
      <AdminActionForm action={updateAction} className={adminFormGridClass} resetOnSuccess={false}>
        <input type="hidden" name="id" value={row.id} />
        {isChild ? (
          <>
            <AdminFormField
              label="Status"
              name="status"
              as="select"
              defaultValue={row.status}
              options={progressStatusOptions}
            />
            <AdminFormField
              label="Jam kerja aktual (maks 8)"
              name="actualHours"
              type="number"
              defaultValue={row.actualHours != null ? String(row.actualHours) : ""}
              min={1}
              max={8}
            />
            <AdminFileField label="Foto dokumentasi (opsional)" name="photoUrl" />
            <AdminFormField label="Caption foto" name="photoCaption" />
          </>
        ) : (
          <p className="md:col-span-2 text-sm text-neutral-500">
            Status fase parent mengikuti sub-tugas. Anda bisa menambah catatan di bawah.
          </p>
        )}
        <AdminFormField label="Catatan" name="note" as="textarea" defaultValue={row.note ?? ""} />
        <AdminSubmitButton label="Simpan" />
      </AdminActionForm>
    </AdminCrudDialog>
  );
}

export function ApplyWbsTemplateDialog({
  shipmentId,
  templates,
  applyAction,
}: {
  shipmentId: string;
  templates: { id: string; name: string; estimatedDays: number }[];
  applyAction: (formData: FormData) => Promise<ActionResult | void>;
}) {
  return (
    <AdminCrudDialog title="Apply Template WBS" triggerLabel="Apply template WBS" triggerMode="icon-template">
      <AdminActionForm action={applyAction} className={adminFormGridClass}>
        <input type="hidden" name="shipmentId" value={shipmentId} />
        <AdminFormField
          label="Template"
          name="templateId"
          as="select"
          required
          options={templates.map((t) => ({
            value: t.id,
            label: `${t.name} (${t.estimatedDays} hari)`,
          }))}
        />
        <p className="md:col-span-2 text-xs text-neutral-500">
          Bobot parent/child dihitung merata otomatis. Sub-tugas memakai jam (maks 8).
        </p>
        <AdminSubmitButton label="Terapkan" />
      </AdminActionForm>
    </AdminCrudDialog>
  );
}
