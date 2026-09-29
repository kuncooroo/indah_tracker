"use client";

import { Printer } from "lucide-react";

export function PrintReportButton({ label = "Cetak / Simpan PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 print:hidden"
    >
      <Printer className="h-4 w-4" />
      {label}
    </button>
  );
}
