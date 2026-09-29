"use client";

import { useState } from "react";
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
import { previewTemplateWeights } from "@/lib/wbs-weights";

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
    hasChildren?: boolean;
  };
  updateAction: (formData: FormData) => Promise<ActionResult | void>;
}) {
  const isChild = Boolean(row.parentId);
  const isParentLeaf = !isChild && !row.hasChildren;
  const canEditStatus = isChild || isParentLeaf;

  return (
    <AdminCrudDialog
      title={`Update: ${row.title}`}
      triggerLabel="Update progress"
      variant="ghost"
      triggerMode="icon-edit"
    >
      <AdminActionForm action={updateAction} className={adminFormGridClass} resetOnSuccess={false}>
        <input type="hidden" name="id" value={row.id} />
        {canEditStatus ? (
          <>
            <AdminFormField
              label="Status"
              name="status"
              as="select"
              defaultValue={row.status}
              options={progressStatusOptions}
            />
            {isChild ? (
              <>
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
            ) : null}
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
  templates: {
    id: string;
    name: string;
    estimatedDays: number;
    items: {
      title: string;
      children: { title: string; estimatedHours: number | null }[];
    }[];
  }[];
  applyAction: (formData: FormData) => Promise<ActionResult | void>;
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const selected = templates.find((t) => t.id === templateId) ?? templates[0];
  const preview = selected
    ? previewTemplateWeights(selected.items)
    : null;

  return (
    <AdminCrudDialog title="Apply Template WBS" triggerLabel="Apply template WBS" triggerMode="icon-template">
      <AdminActionForm action={applyAction} className={adminFormGridClass}>
        <input type="hidden" name="shipmentId" value={shipmentId} />
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Template <span className="text-red-500">*</span>
          </label>
          <select
            name="templateId"
            required
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.estimatedDays} hari · {t.items.length} fase)
              </option>
            ))}
          </select>
        </div>

        {preview && selected ? (
          <div className="md:col-span-2 max-h-56 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Preview · estimasi {selected.estimatedDays} hari · Σ bobot{" "}
              {preview.weightCheck.sum}%
              {preview.weightCheck.ok ? "" : " ⚠"}
            </p>
            {selected.items.length === 0 ? (
              <p className="mt-2 text-sm text-amber-700">Template kosong — tambah fase dulu.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {preview.parents.map((p, i) => (
                  <li key={`${p.title}-${i}`} className="text-sm">
                    <p className="font-medium text-neutral-900">
                      {p.title}{" "}
                      <span className="font-normal text-neutral-500">({p.weightPercent}%)</span>
                    </p>
                    {p.children.length > 0 ? (
                      <ul className="mt-1 space-y-0.5 border-l border-neutral-200 pl-3 text-xs text-neutral-600">
                        {p.children.map((c, j) => (
                          <li key={`${c.title}-${j}`}>
                            {c.title} · {c.weightPercent}% · ~{c.estimatedHours ?? 8} jam
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-0.5 text-xs text-neutral-400">Tanpa sub-tugas (fase leaf)</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <p className="md:col-span-2 text-xs text-neutral-500">
          Bobot parent/child dihitung merata otomatis. Sub-tugas memakai jam (maks 8).
        </p>
        <AdminSubmitButton label="Terapkan" />
      </AdminActionForm>
    </AdminCrudDialog>
  );
}

export function ManualProgressParentDialog({
  shipmentId,
  createAction,
}: {
  shipmentId: string;
  createAction: (formData: FormData) => Promise<ActionResult | void>;
}) {
  return (
    <AdminCrudDialog title="Tambah fase (manual)" triggerLabel="Tambah fase" triggerMode="icon-add">
      <AdminActionForm action={createAction} className={adminFormGridClass}>
        <input type="hidden" name="shipmentId" value={shipmentId} />
        <AdminFormField
          label="Judul fase"
          name="title"
          required
          placeholder="Mengerjakan Boiler"
        />
        <AdminFormField label="Urutan (opsional)" name="sortOrder" type="number" placeholder="Otomatis" />
        <p className="md:col-span-2 text-xs text-neutral-500">
          Bobot semua fase akan dihitung ulang secara merata setelah ditambahkan.
        </p>
        <AdminSubmitButton label="Tambah fase" />
      </AdminActionForm>
    </AdminCrudDialog>
  );
}

export function ManualProgressChildDialog({
  shipmentId,
  parentId,
  parentTitle,
  createAction,
}: {
  shipmentId: string;
  parentId: string;
  parentTitle: string;
  createAction: (formData: FormData) => Promise<ActionResult | void>;
}) {
  return (
    <AdminCrudDialog
      title={`Sub-tugas: ${parentTitle}`}
      triggerLabel="Tambah sub-tugas"
      triggerMode="icon-add"
      variant="ghost"
    >
      <AdminActionForm action={createAction} className={adminFormGridClass}>
        <input type="hidden" name="shipmentId" value={shipmentId} />
        <input type="hidden" name="parentId" value={parentId} />
        <AdminFormField
          label="Judul sub-tugas"
          name="title"
          required
          placeholder="Cover boiler"
        />
        <AdminFormField
          label="Estimasi jam (maks 8)"
          name="estimatedHours"
          type="number"
          defaultValue="8"
          min={1}
          max={8}
          required
        />
        <AdminFormField label="Urutan (opsional)" name="sortOrder" type="number" placeholder="Otomatis" />
        <AdminSubmitButton label="Tambah sub-tugas" />
      </AdminActionForm>
    </AdminCrudDialog>
  );
}
