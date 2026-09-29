"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Scale } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

export function ProgressStatusSuggestBanner({
  shipmentId,
  currentLabel,
  suggestedLabel,
  reason,
  applyAction,
}: {
  shipmentId: string;
  currentLabel: string;
  suggestedLabel: string;
  reason: string;
  applyAction: (shipmentId: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
      <div className="flex min-w-0 items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
        <div>
          <p className="text-sm font-semibold text-sky-950">
            Saran status: {suggestedLabel}
          </p>
          <p className="mt-0.5 text-xs text-sky-800/90">
            Sekarang: {currentLabel}. {reason} Tidak diterapkan otomatis — Anda yang putuskan.
          </p>
        </div>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await applyAction(shipmentId);
            if (result.success) {
              toast.success(result.message);
              router.refresh();
            } else toast.error(result.message);
          });
        }}
        className="rounded-lg bg-sky-900 px-3 py-2 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-60"
      >
        {pending ? "…" : "Terapkan saran"}
      </button>
    </div>
  );
}

export function ProgressWeightBanner({
  sum,
  ok,
  shipmentId,
  rebalanceAction,
}: {
  sum: number;
  ok: boolean;
  shipmentId: string;
  rebalanceAction: (shipmentId: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3",
        ok ? "border-neutral-200 bg-white" : "border-amber-200 bg-amber-50"
      )}
    >
      <div className="flex items-start gap-2">
        <Scale
          className={cn("mt-0.5 h-4 w-4 shrink-0", ok ? "text-neutral-500" : "text-amber-700")}
        />
        <div>
          <p
            className={cn(
              "text-sm font-semibold",
              ok ? "text-neutral-900" : "text-amber-950"
            )}
          >
            Σ bobot parent: {sum}%
            {ok ? " · OK" : " · tidak ≈ 100%"}
          </p>
          <p className={cn("mt-0.5 text-xs", ok ? "text-neutral-500" : "text-amber-800/90")}>
            {ok
              ? "Bobot fase merata dan valid untuk perhitungan progress."
              : "Progress % bisa miring. Seimbangkan ulang agar total parent ≈ 100%."}
          </p>
        </div>
      </div>
      {!ok ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await rebalanceAction(shipmentId);
              if (result.success) {
                toast.success(result.message);
                router.refresh();
              } else toast.error(result.message);
            });
          }}
          className="rounded-lg bg-amber-900 px-3 py-2 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-60"
        >
          {pending ? "…" : "Seimbangkan ulang"}
        </button>
      ) : null}
    </div>
  );
}
