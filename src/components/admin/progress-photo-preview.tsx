"use client";

import { useState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { AdminDeleteButton } from "@/components/admin/admin-forms";

export function ProgressPhotoPreview({
  url,
  caption,
  deleteAction,
}: {
  url: string;
  caption?: string | null;
  deleteAction: () => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="overflow-hidden rounded-lg border border-neutral-200"
          title={caption ?? "Preview foto"}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={caption ?? "Dokumentasi"} className="h-20 w-20 object-cover" />
        </button>
        <div className="absolute -right-1.5 -top-1.5">
          <AdminDeleteButton action={deleteAction} iconOnly label="Hapus foto" />
        </div>
      </div>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4"
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={caption ?? "Dokumentasi"}
            className="max-h-[90vh] max-w-full rounded-lg shadow-2xl"
          />
        </button>
      ) : null}
    </>
  );
}
