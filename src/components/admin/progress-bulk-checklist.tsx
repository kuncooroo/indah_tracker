"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckSquare, Save } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

export type BulkChecklistItem = {
  id: string;
  title: string;
  status: string;
  parentTitle: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  isChild: boolean;
};

const STATUSES = [
  { value: "NOT_STARTED", short: "Belum" },
  { value: "IN_PROGRESS", short: "Kerja" },
  { value: "COMPLETED", short: "OK" },
] as const;

function statusTone(status: string) {
  if (status === "COMPLETED") return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (status === "IN_PROGRESS") return "border-amber-300 bg-amber-50 text-amber-900";
  return "border-neutral-200 bg-white text-neutral-600";
}

export function ProgressBulkChecklist({
  shipmentId,
  items,
  bulkAction,
  defaultOpen = false,
}: {
  shipmentId: string;
  items: BulkChecklistItem[];
  bulkAction: (formData: FormData) => Promise<ActionResult | void>;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.status]))
  );
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setDraft(Object.fromEntries(items.map((i) => [i.id, i.status])));
  }, [items]);

  const dirty = useMemo(() => {
    return items.filter((i) => draft[i.id] && draft[i.id] !== i.status);
  }, [draft, items]);

  if (items.length === 0) return null;

  function setStatus(id: string, status: string) {
    setDraft((prev) => ({ ...prev, [id]: status }));
  }

  function markSelectedComplete() {
    setDraft((prev) => {
      const next = { ...prev };
      for (const item of items) {
        if (next[item.id] !== "COMPLETED") next[item.id] = "COMPLETED";
      }
      return next;
    });
  }

  function submit() {
    if (dirty.length === 0) {
      toast.message("Tidak ada perubahan status.");
      return;
    }
    const updates = dirty.map((item) => {
      const status = draft[item.id] ?? item.status;
      const hours =
        status === "COMPLETED"
          ? item.actualHours ?? item.estimatedHours ?? 8
          : item.actualHours;
      return {
        id: item.id,
        status,
        actualHours: item.isChild ? hours : null,
      };
    });

    const fd = new FormData();
    fd.set("shipmentId", shipmentId);
    fd.set("updates", JSON.stringify(updates));

    startTransition(async () => {
      const result = await bulkAction(fd);
      if (!result || result.success) {
        toast.success(result?.message ?? "Tersimpan");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <CheckSquare className="h-4 w-4 text-neutral-500" />
          Checklist cepat (HP)
        </span>
        <span className="text-xs text-neutral-500">
          {open ? "Tutup" : `${items.length} tahap`}
          {dirty.length > 0 ? ` · ${dirty.length} diubah` : ""}
        </span>
      </button>

      {open ? (
        <div className="border-t border-neutral-100 px-3 pb-4 pt-2 sm:px-4">
          <p className="mb-3 px-1 text-xs text-neutral-500">
            Tap status per tahap. Saat selesai, jam aktual memakai estimasi (bisa diedit di Update
            detail).
          </p>
          <div className="mb-3 flex flex-wrap gap-2 px-1">
            <button
              type="button"
              onClick={markSelectedComplete}
              className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800"
            >
              Tandai semua selesai
            </button>
            <button
              type="button"
              onClick={() =>
                setDraft(Object.fromEntries(items.map((i) => [i.id, i.status])))
              }
              className="rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700"
            >
              Reset draft
            </button>
          </div>

          <ul className="max-h-[60vh] space-y-2 overflow-y-auto overscroll-contain">
            {items.map((item) => {
              const value = draft[item.id] ?? item.status;
              const changed = value !== item.status;
              return (
                <li
                  key={item.id}
                  className={cn(
                    "rounded-lg border p-3",
                    changed ? "border-sky-200 bg-sky-50/40" : "border-neutral-200"
                  )}
                >
                  <div className="min-w-0">
                    {item.parentTitle ? (
                      <p className="truncate text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                        {item.parentTitle}
                      </p>
                    ) : null}
                    <p className="text-sm font-medium text-neutral-900">{item.title}</p>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {STATUSES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setStatus(item.id, s.value)}
                        className={cn(
                          "min-h-11 rounded-md border text-xs font-semibold transition-colors",
                          value === s.value
                            ? cn(statusTone(s.value), "ring-1 ring-neutral-900/10")
                            : "border-neutral-200 bg-white text-neutral-500"
                        )}
                      >
                        {s.short}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="sticky bottom-0 mt-3 border-t border-neutral-100 bg-white pt-3">
            <button
              type="button"
              disabled={pending || dirty.length === 0}
              onClick={submit}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {pending
                ? "Menyimpan…"
                : dirty.length > 0
                  ? `Simpan ${dirty.length} perubahan`
                  : "Tidak ada perubahan"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
