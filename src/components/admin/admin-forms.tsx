"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Pencil, Plus, LayoutTemplate, X } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

const toastClass =
  "!bg-neutral-900 !text-white !border-neutral-700 [&_[data-description]]:!text-neutral-300";

export const adminFormGridClass = "grid gap-3 md:grid-cols-2";

export function AdminActionForm({
  action,
  children,
  className,
  resetOnSuccess = true,
}: {
  action: (formData: FormData) => Promise<ActionResult | void>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        startTransition(async () => {
          const result = await action(fd);
          if (!result || result.success) {
            toast.success(result?.message ?? "Berhasil", { className: toastClass });
            if (resetOnSuccess) form.reset();
          } else {
            toast.error(result.message, { className: toastClass });
          }
        });
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}

export function AdminDeleteButton({
  action,
  label = "Hapus",
}: {
  action: () => Promise<ActionResult>;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Yakin ${label.toLowerCase()}?`)) return;
        startTransition(async () => {
          const result = await action();
          if (result.success) toast.success(result.message, { className: toastClass });
          else toast.error(result.message, { className: toastClass });
        });
      }}
      className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
    >
      {pending ? "…" : label}
    </button>
  );
}

export function AdminCrudDialog({
  title,
  triggerLabel,
  children,
  variant = "primary",
  triggerMode = "text",
}: {
  title: string;
  triggerLabel: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
  triggerMode?: "text" | "icon-add" | "icon-edit" | "icon-template";
}) {
  const [open, setOpen] = useState(false);
  const icons = {
    "icon-add": Plus,
    "icon-edit": Pencil,
    "icon-template": LayoutTemplate,
  } as const;
  const isIcon = triggerMode !== "text";
  const Icon = isIcon ? icons[triggerMode] : null;

  return (
    <>
      <button
        type="button"
        title={isIcon ? triggerLabel : undefined}
        aria-label={isIcon ? triggerLabel : undefined}
        onClick={() => setOpen(true)}
        className={
          isIcon
            ? "inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
            : variant === "primary"
              ? "rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
              : "rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        }
      >
        {Icon ? <Icon className="h-4 w-4" strokeWidth={1.75} /> : triggerLabel}
      </button>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Tutup"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-neutral-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div
              onSubmitCapture={() => {
                // close after successful submit via slight delay
                setTimeout(() => setOpen(false), 400);
              }}
            >
              {children}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function AdminFormField({
  label,
  name,
  defaultValue,
  required,
  type = "text",
  as,
  options,
  min,
  max,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
  as?: "textarea" | "select";
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  const cls =
    "mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10";
  return (
    <label className="block text-sm">
      <span className="font-medium text-neutral-700">
        {label}
        {required ? " *" : ""}
      </span>
      {as === "textarea" ? (
        <textarea name={name} defaultValue={defaultValue} required={required} rows={3} className={cls} />
      ) : as === "select" ? (
        <select name={name} defaultValue={defaultValue} required={required} className={cls}>
          {options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={defaultValue}
          required={required}
          min={min}
          max={max}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </label>
  );
}

export function AdminCheckboxField({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-neutral-700">
      <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} className="rounded" />
      {label}
    </label>
  );
}

export function AdminSubmitButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className={cn(
        "rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 md:col-span-2"
      )}
    >
      {label}
    </button>
  );
}

export function AdminFileField({
  label,
  name,
  defaultUrl,
  accept = "image/jpeg,image/png,image/webp,image/gif,image/svg+xml",
}: {
  label: string;
  name: string;
  defaultUrl?: string;
  accept?: string;
}) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [uploading, setUploading] = useState(false);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Upload gagal", { className: toastClass });
        return;
      }
      setUrl(data.url);
      toast.success("Gambar terunggah", { className: toastClass });
    } catch {
      toast.error("Upload gagal", { className: toastClass });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="block text-sm md:col-span-2">
      <span className="font-medium text-neutral-700">{label}</span>
      <input type="hidden" name={name} value={url} />
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept={accept}
          onChange={onFileChange}
          disabled={uploading}
          className="block w-full text-xs text-neutral-600 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
        />
        {uploading ? <span className="text-xs text-neutral-500">Mengunggah…</span> : null}
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Preview" className="h-16 w-16 rounded-lg object-cover" />
        ) : null}
      </div>
    </div>
  );
}
