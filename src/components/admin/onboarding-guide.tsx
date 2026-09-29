import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Package,
  ListTree,
  Share2,
  Wrench,
} from "lucide-react";

export type OnboardingStats = {
  templates: number;
  shipments: number;
  withProgress: number;
};

export function AdminOnboardingGuide({ stats }: { stats: OnboardingStats }) {
  const steps = [
    {
      done: stats.templates > 0,
      title: "Buat / aktifkan template WBS",
      body: "Definisikan fase produksi yang dipakai berulang.",
      href: "/admin/wbs-templates",
      cta: "Template WBS",
      icon: ListTree,
    },
    {
      done: stats.shipments > 0,
      title: "Generate tracking shipment",
      body: "Buat nomor tracking untuk customer / dari API ERP.",
      href: "/admin/shipments/new",
      cta: "Generate tracking",
      icon: Package,
    },
    {
      done: stats.withProgress > 0,
      title: "Apply WBS & update progress",
      body: "Pasang template, lalu update tahap di progress atau Workshop HP.",
      href: "/admin/workshop",
      cta: "Buka Workshop",
      icon: Wrench,
    },
    {
      done: stats.shipments > 0,
      title: "Bagikan link ke customer",
      body: "Salin track URL / WhatsApp dari detail shipment.",
      href: "/admin/shipments",
      cta: "Lihat shipments",
      icon: Share2,
    },
  ];

  const allDone = steps.every((s) => s.done);
  if (allDone) return null;

  return (
    <section className="rounded-xl border border-brand-blue/25 bg-brand-blue-soft p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-blue">
            First-run guide
          </p>
          <h2 className="mt-1 text-base font-bold text-neutral-900">
            Mulai pakai Indah Tracker
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Alur singkat: template → tracking → update progress → kirim link customer.
          </p>
        </div>
        <Link
          href="/admin/help"
          className="text-xs font-medium text-brand-blue hover:underline"
        >
          Baca dokumentasi →
        </Link>
      </div>
      <ol className="mt-4 space-y-3">
        {steps.map((step, i) => (
          <li
            key={step.title}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-white/80 bg-white px-3 py-3"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center">
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <Circle className="h-5 w-5 text-neutral-300" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-neutral-900">
                {i + 1}. {step.title}
              </p>
              <p className="text-xs text-neutral-500">{step.body}</p>
            </div>
            {!step.done ? (
              <Link
                href={step.href}
                className="inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800"
              >
                <step.icon className="h-3.5 w-3.5" />
                {step.cta}
              </Link>
            ) : (
              <span className="text-xs font-medium text-emerald-700">Selesai</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
