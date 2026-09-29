"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, MessageCircle } from "lucide-react";
import { toast } from "sonner";

const toastClass =
  "!bg-neutral-900 !text-white !border-neutral-700 [&_[data-description]]:!text-neutral-300";

export function ShipmentShareActions({
  trackUrl,
  trackPath,
  whatsappUrl,
  compact = false,
}: {
  trackUrl: string;
  trackPath: string;
  whatsappUrl: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(trackUrl);
      setCopied(true);
      toast.success("Link track disalin", { className: toastClass });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Gagal menyalin link", { className: toastClass });
    }
  }

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={copyLink}
          title="Salin link track"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Kirim via WhatsApp"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
        >
          <MessageCircle className="h-3.5 w-3.5" />
        </a>
        <a
          href={trackPath}
          target="_blank"
          rel="noopener noreferrer"
          title="Buka public track"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={copyLink}
        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
      >
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        {copied ? "Tersalin" : "Salin link track"}
      </button>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
      >
        <MessageCircle className="h-4 w-4" />
        Kirim WhatsApp
      </a>
      <a
        href={trackPath}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
      >
        <ExternalLink className="h-4 w-4" />
        Buka public
      </a>
    </div>
  );
}
