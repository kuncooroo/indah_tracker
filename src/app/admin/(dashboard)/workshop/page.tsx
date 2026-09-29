import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { ACTIVE_SHIPMENT_STATUSES, reminderForShipment } from "@/lib/shipment-links";
import { getSoonDays } from "@/lib/reminder-config";
import { SHIPMENT_STATUS_LABEL } from "@/lib/tracking";
import { cn } from "@/lib/utils";
import { ChevronRight, Wrench } from "lucide-react";

export default async function WorkshopHomePage() {
  await requireAdmin();
  const soonDays = await getSoonDays();

  const rows = await prisma.shipment.findMany({
    where: {
      deletedAt: null,
      status: { in: [...ACTIVE_SHIPMENT_STATUSES] },
    },
    orderBy: [{ estimatedEndDate: "asc" }, { updatedAt: "desc" }],
    take: 40,
    select: {
      id: true,
      trackingNumber: true,
      orderNumber: true,
      customerName: true,
      companyName: true,
      status: true,
      progressPercent: true,
      estimatedDays: true,
      estimatedEndDate: true,
      createdAt: true,
      externalOrderId: true,
      _count: { select: { progressTasks: true } },
    },
  });

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-blue">
            Workshop
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">
            Update progress
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Mode lapangan — tap job, update checklist cepat.
          </p>
        </div>
        <Link
          href="/admin/dashboard"
          className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
        >
          Desktop
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-200 bg-white px-4 py-12 text-center">
          <Wrench className="mx-auto h-8 w-8 text-neutral-300" />
          <p className="mt-3 text-sm font-medium text-neutral-700">Tidak ada job aktif</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const { reminder } = reminderForShipment(row, soonDays);
            const who =
              [row.companyName, row.customerName].filter(Boolean).join(" · ") || "—";
            return (
              <li key={row.id}>
                <Link
                  href={`/admin/workshop/${row.id}`}
                  className="flex min-h-[4.5rem] h-full items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-300 hover:bg-neutral-50 active:bg-neutral-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-neutral-900">
                        {row.trackingNumber}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          reminder.kind === "overdue"
                            ? "bg-red-50 text-red-700"
                            : reminder.kind === "due_soon"
                              ? "bg-amber-50 text-amber-800"
                              : "bg-neutral-100 text-neutral-600"
                        )}
                      >
                        {reminder.shortLabel}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-neutral-600">{who}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {SHIPMENT_STATUS_LABEL[row.status] ?? row.status} ·{" "}
                      {Number(row.progressPercent)}%
                      {row._count.progressTasks
                        ? ` · ${row._count.progressTasks} fase`
                        : " · belum ada WBS"}
                      {row.orderNumber ? ` · ${row.orderNumber}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-neutral-400" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
