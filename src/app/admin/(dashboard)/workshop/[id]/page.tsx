import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { bulkUpdateProgressTasks } from "@/lib/admin-wbs-actions";
import { ProgressBulkChecklist } from "@/components/admin/progress-bulk-checklist";
import { SHIPMENT_STATUS_LABEL } from "@/lib/tracking";
import { applySuggestedShipmentStatus } from "@/lib/admin-wbs-actions";
import { suggestShipmentStatusFromProgress } from "@/lib/shipment-progress";
import { ProgressStatusSuggestBanner } from "@/components/admin/progress-wbs-banners";

type PageProps = { params: Promise<{ id: string }> };

export default async function WorkshopShipmentPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;

  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      progressTasks: {
        where: { parentId: null },
        orderBy: { sortOrder: "asc" },
        include: {
          children: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  if (!shipment || shipment.deletedAt) notFound();

  const progress = Number(shipment.progressPercent);
  const suggest = suggestShipmentStatusFromProgress({
    progressPercent: progress,
    currentStatus: shipment.status,
  });

  const checklistItems = shipment.progressTasks.flatMap((parent) => {
    if (parent.children.length === 0) {
      return [
        {
          id: parent.id,
          title: parent.title,
          status: parent.status,
          parentTitle: null as string | null,
          estimatedHours: parent.estimatedHours,
          actualHours: parent.actualHours,
          isChild: false,
        },
      ];
    }
    return parent.children.map((child) => ({
      id: child.id,
      title: child.title,
      status: child.status,
      parentTitle: parent.title,
      estimatedHours: child.estimatedHours,
      actualHours: child.actualHours,
      isChild: true,
    }));
  });

  const who =
    [shipment.companyName, shipment.customerName].filter(Boolean).join(" · ") || "—";

  return (
    <div className="space-y-6 pb-16">
      <div>
        <Link
          href="/admin/workshop"
          className="text-sm text-neutral-500 hover:text-neutral-800"
        >
          ← Workshop
        </Link>
        <h1 className="mt-2 font-mono text-xl font-bold text-neutral-900 sm:text-2xl">
          {shipment.trackingNumber}
        </h1>
        <p className="mt-0.5 text-sm text-neutral-600">{who}</p>
        <p className="mt-1 text-xs text-neutral-500">
          {SHIPMENT_STATUS_LABEL[shipment.status] ?? shipment.status} · {progress}%
          {shipment.externalOrderId ? ` · ERP ${shipment.externalOrderId}` : ""}
        </p>
        <div className="mt-3 h-2 max-w-xl overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-brand-blue"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      </div>

      {suggest.suggested && suggest.reason ? (
        <ProgressStatusSuggestBanner
          shipmentId={shipment.id}
          currentLabel={SHIPMENT_STATUS_LABEL[shipment.status] ?? shipment.status}
          suggestedLabel={
            SHIPMENT_STATUS_LABEL[suggest.suggested] ?? suggest.suggested
          }
          reason={suggest.reason}
          applyAction={applySuggestedShipmentStatus}
        />
      ) : null}

      {checklistItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-500">
          Belum ada tahapan WBS.{" "}
          <Link
            href={`/admin/shipments/${shipment.id}/progress`}
            className="font-medium text-neutral-900 underline"
          >
            Apply template di progress
          </Link>
        </div>
      ) : (
        <ProgressBulkChecklist
          shipmentId={shipment.id}
          items={checklistItems}
          bulkAction={bulkUpdateProgressTasks}
          defaultOpen
        />
      )}

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/admin/shipments/${shipment.id}/progress`}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-800"
        >
          Detail progress
        </Link>
        <Link
          href={`/admin/shipments/${shipment.id}`}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-800"
        >
          Data shipment
        </Link>
      </div>
    </div>
  );
}
