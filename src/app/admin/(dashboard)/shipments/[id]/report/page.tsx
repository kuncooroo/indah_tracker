import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { SHIPMENT_STATUS_LABEL } from "@/lib/tracking";
import { resolveEndDate } from "@/lib/shipment-links";
import { formatDateId, formatDateLongId } from "@/lib/utils";
import { PrintReportButton } from "@/components/admin/print-report-button";

type PageProps = { params: Promise<{ id: string }> };

function taskStatusLabel(status: string) {
  if (status === "COMPLETED") return "Selesai";
  if (status === "IN_PROGRESS") return "Dikerjakan";
  return "Belum mulai";
}

export default async function ShipmentProgressReportPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;

  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      wbsTemplate: { select: { name: true, estimatedDays: true } },
      progressTasks: {
        where: { parentId: null },
        orderBy: { sortOrder: "asc" },
        include: {
          children: {
            orderBy: { sortOrder: "asc" },
            include: {
              photos: { orderBy: { createdAt: "desc" }, take: 4 },
            },
          },
        },
      },
    },
  });
  if (!shipment) notFound();

  const progress = Number(shipment.progressPercent);
  const endDate = resolveEndDate(shipment);
  const actualLead =
    shipment.deliveredAt != null
      ? Math.max(
          0,
          Math.round(
            (shipment.deliveredAt.getTime() - shipment.createdAt.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : null;

  const customer =
    [shipment.companyName, shipment.customerName].filter(Boolean).join(" · ") || "—";

  return (
    <div className="mx-auto max-w-3xl space-y-6 print:max-w-none print:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/shipments/${shipment.id}`}
            className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            ← Detail
          </Link>
          <Link
            href={`/admin/shipments/${shipment.id}/progress`}
            className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Progress
          </Link>
        </div>
        <PrintReportButton />
      </div>

      <article className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="border-b border-neutral-200 pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
            Indah Mesin · Progress Report
          </p>
          <h1 className="mt-2 font-mono text-2xl font-bold text-neutral-900">
            {shipment.trackingNumber}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">{customer}</p>
          <p className="mt-3 text-xs text-neutral-500">
            Dicetak {formatDateLongId(new Date())}
            {shipment.orderNumber ? ` · PO ${shipment.orderNumber}` : ""}
          </p>
        </header>

        <section className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-neutral-50 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              Status
            </p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">
              {SHIPMENT_STATUS_LABEL[shipment.status] ?? shipment.status}
            </p>
          </div>
          <div className="rounded-lg bg-neutral-50 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              Progress
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-neutral-900">
              {progress}%
            </p>
          </div>
          <div className="rounded-lg bg-neutral-50 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              Estimasi
            </p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">
              {shipment.estimatedDays != null ? `${shipment.estimatedDays} hari` : "—"}
              {endDate ? ` · target ${formatDateId(endDate)}` : ""}
            </p>
          </div>
          <div className="rounded-lg bg-neutral-50 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              Lead time
            </p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">
              {actualLead != null
                ? `${actualLead} hari aktual`
                : `Dibuat ${formatDateId(shipment.createdAt)}`}
              {actualLead != null &&
              shipment.estimatedDays != null &&
              shipment.estimatedDays > 0
                ? actualLead <= shipment.estimatedDays
                  ? " · on time"
                  : ` · +${actualLead - shipment.estimatedDays} hari`
                : ""}
            </p>
          </div>
        </section>

        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-brand-blue"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>

        {shipment.note ? (
          <p className="mt-4 rounded-lg border border-neutral-100 bg-white px-3 py-2 text-sm text-neutral-700">
            <span className="font-medium text-neutral-900">Catatan: </span>
            {shipment.note}
          </p>
        ) : null}

        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Rincian pengerjaan
            {shipment.wbsTemplate ? ` · ${shipment.wbsTemplate.name}` : ""}
          </h2>

          {shipment.progressTasks.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">
              Belum ada tahapan WBS pada laporan ini.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {shipment.progressTasks.map((parent, idx) => {
                const childDone = parent.children.filter((c) => c.status === "COMPLETED").length;
                const childTotal = parent.children.length;
                return (
                  <div
                    key={parent.id}
                    className="break-inside-avoid rounded-lg border border-neutral-200"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 bg-neutral-50 px-4 py-2.5">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                          Fase {idx + 1} · bobot {Number(parent.weightPercent)}%
                        </p>
                        <p className="font-semibold text-neutral-900">{parent.title}</p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-neutral-700 ring-1 ring-neutral-200">
                        {childTotal > 0
                          ? `${childDone}/${childTotal} sub`
                          : taskStatusLabel(parent.status)}
                      </span>
                    </div>
                    {parent.children.length > 0 ? (
                      <ul className="divide-y divide-neutral-100">
                        {parent.children.map((child) => (
                          <li key={child.id} className="px-4 py-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium text-neutral-800">
                                  {child.title}
                                </p>
                                <p className="mt-0.5 text-xs text-neutral-500">
                                  {child.estimatedHours != null
                                    ? `Estimasi ${child.estimatedHours} jam`
                                    : null}
                                  {child.actualHours != null
                                    ? ` · aktual ${child.actualHours} jam`
                                    : ""}
                                  {child.completedAt
                                    ? ` · selesai ${formatDateId(child.completedAt)}`
                                    : ""}
                                </p>
                                {child.note ? (
                                  <p className="mt-1 text-xs text-neutral-600">{child.note}</p>
                                ) : null}
                              </div>
                              <span className="text-xs font-medium text-neutral-600">
                                {taskStatusLabel(child.status)}
                              </span>
                            </div>
                            {child.photos.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {child.photos.map((ph) => (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    key={ph.id}
                                    src={ph.url}
                                    alt={ph.caption ?? child.title}
                                    className="h-16 w-16 rounded object-cover ring-1 ring-neutral-200"
                                  />
                                ))}
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <footer className="mt-10 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
          Laporan ini dibuat untuk keperluan update customer. Status dapat berubah seiring
          progress produksi Indah Mesin.
        </footer>
      </article>
    </div>
  );
}
