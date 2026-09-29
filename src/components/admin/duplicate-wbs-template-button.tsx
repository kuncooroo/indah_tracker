"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";

export function DuplicateWbsTemplateButton({
  templateId,
  duplicateAction,
  redirectToCopy = false,
}: {
  templateId: string;
  duplicateAction: (id: string) => Promise<ActionResult>;
  redirectToCopy?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      title="Duplikat template"
      aria-label="Duplikat template"
      onClick={() => {
        startTransition(async () => {
          const result = await duplicateAction(templateId);
          if (result.success) {
            toast.success(result.message);
            if (redirectToCopy && result.id) {
              router.push(`/admin/wbs-templates/${result.id}`);
            } else {
              router.refresh();
            }
          } else {
            toast.error(result.message);
          }
        });
      }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
    >
      {pending ? "…" : <Copy className="h-3.5 w-3.5" strokeWidth={2} />}
    </button>
  );
}
