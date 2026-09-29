import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SHIPMENT_STATUS_LABEL } from "@/lib/tracking";
import { resolveEndDate } from "@/lib/shipment-links";
import {
  ANALYTICS_PERIODS,
  buildDailyBuckets,
  computeLeadSamples,
  parseAnalyticsPeriod,
  pct,
  periodDays,
  periodSince,
  summarizeLeadTimes,
  type AnalyticsPeriod,
} from "@/lib/analytics";
import { Download, FileSpreadsheet } from "lucide-react";

type PageProps = {
  searchParams: Promise<{ period?: string; trend?: string }>;
};

function TrendBars({
  buckets,
  accentClass = "bg-brand-blue/85",
}: {
  buckets: { key: string; label: string; count: number }[];
  accentClass?: string;
}) {
  const max = Math.max(1, ...buckets.map((d) => d.count));
  const sparse = buckets.length > 20;
  return (
    <div className="mt-6 flex h-40 items-end gap-1 sm:gap-1.5">
      {buckets.map((d, i) => (
        <div key={d.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span className="text-[10px] tabular-nums text-neutral-500">
            {d.count || ""}
          </span>
          <div
            className={`w-full rounded-t ${accentClass}`}
            style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
            title={`${d.label}: ${d.count}`}
          />
          <span className="truncate text-[9px] text-neutral-400">
            {sparse ? (i % 3 === 0 || i === buckets.length - 1 ? d.label : "") : d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default async function AdminAnalyticsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const period = parseAnalyticsPeriod(sp.period);
  const trendDaysRaw = sp.trend === "7" || sp.trend === "30" ? sp.trend : period === "7" ? "7" : "30";
  const trendDays = Number(trendDaysRaw) as 7 | 30;
  const since = periodSince(period);
  const trendSince = periodSince(String(trendDays) as AnalyticsPeriod)!;

  const createdWhere = since
    ? { createdAt: { gte: since }, deletedAt: null }
    : { deletedAt: null };
  const deliveredWhere = since
    ? { status: "DELIVERED" as const, deliveredAt: { gte: since }, deletedAt: null }
    : { status: "DELIVERED" as const, deletedAt: null };

  const [
    totalShipments,
    byStatus,
    avgProgressAgg,
    delivered,
    cancelled,
    withTemplate,
    withoutTasks,
    createdInPeriod,
    deliveredInPeriod,
    recentCompleted,
    templates,
    taskStats,
    photoCount,
    slowShipments,
    trendCreatedRows,
    trendDeliveredRows,
  ] = await Promise.all([
    prisma.shipment.count({ where: createdWhere }),
    prisma.shipment.groupBy({
      by: ["status"],
      where: createdWhere,
      _count: { _all: true },
    }),
    prisma.shipment.aggregate({
      where: createdWhere,
      _avg: { progressPercent: true },
    }),
    prisma.shipment.count({
      where: { ...createdWhere, status: "DELIVERED" },
    }),
    prisma.shipment.count({
      where: { ...createdWhere, status: "CANCELLED" },
    }),
    prisma.shipment.count({
      where: { ...createdWhere, wbsTemplateId: { not: null } },
    }),
    prisma.shipment.count({
      where: { ...createdWhere, progressTasks: { none: {} } },
    }),
    prisma.shipment.count({ where: createdWhere }),
    prisma.shipment.count({ where: deliveredWhere }),
    prisma.shipment.findMany({
      where: {
        status: "DELIVERED",
        deliveredAt: { not: null },
        deletedAt: null,
        ...(since ? { deliveredAt: { gte: since } } : {}),
      },
      orderBy: { deliveredAt: "desc" },
      take: 200,
      select: {
        createdAt: true,
        deliveredAt: true,
        estimatedDays: true,
        trackingNumber: true,
        customerName: true,
        companyName: true,
      },
    }),
    prisma.wbsTemplate.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        active: true,
        estimatedDays: true,
        _count: { select: { shipments: true, items: true } },
      },
    }),
    prisma.progressTask.groupBy({
      by: ["status"],
      where: {
        parentId: { not: null },
        shipment: {
          deletedAt: null,
          ...(since ? { createdAt: { gte: since } } : {}),
        },
      },
      _count: { _all: true },
    }),
    prisma.progressPhoto.count({
      where: {
        task: {
          shipment: {
            deletedAt: null,
            ...(since ? { createdAt: { gte: since } } : {}),
          },
        },
      },
    }),
    prisma.shipment.findMany({
      where: {
        status: {
          in: ["CREATED", "IN_PROGRESS", "QUALITY_CHECK", "READY_TO_SHIP", "IN_TRANSIT"],
        },
        progressPercent: { lt: 100 },
        deletedAt: null,
      },
      orderBy: { createdAt: "asc" },
      take: 8,
      select: {
        id: true,
        trackingNumber: true,
        customerName: true,
        companyName: true,
        status: true,
        progressPercent: true,
        createdAt: true,
        estimatedDays: true,
        estimatedEndDate: true,
      },
    }),
    prisma.shipment.findMany({
      where: { createdAt: { gte: trendSince }, deletedAt: null },
      select: { createdAt: true },
    }),
    prisma.shipment.findMany({
      where: {
        status: "DELIVERED",
        deliveredAt: { gte: trendSince },
        deletedAt: null,
      },
      select: { deliveredAt: true },
    }),
  ]);

  const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all]));
  const avgProgress = Number(avgProgressAgg._avg.progressPercent ?? 0);
  const completionRate = pct(delivered, totalShipments);

  const leadSamples = computeLeadSamples(recentCompleted);
  const lead = summarizeLeadTimes(leadSamples);

  const childTaskTotal = taskStats.reduce((a, t) => a + t._count._all, 0);
  const childDone = taskStats.find((t) => t.status === "COMPLETED")?._count._all ?? 0;
  const childInProgress = taskStats.find((t) => t.status === "IN_PROGRESS")?._count._all ?? 0;
  const childPending = taskStats.find((t) => t.status === "NOT_STARTED")?._count._all ?? 0;

  const createdBuckets = buildDailyBuckets(
    trendDays,
    trendCreatedRows.map((r) => ({ at: r.createdAt }))
  );
  const deliveredBuckets = buildDailyBuckets(
    trendDays,
    trendDeliveredRows
      .filter((r) => r.deliveredAt)
      .map((r) => ({ at: r.deliveredAt! }))
  );

  const statusOrder = [
    "CREATED",
    "IN_PROGRESS",
    "QUALITY_CHECK",
    "READY_TO_SHIP",
    "IN_TRANSIT",
    "DELIVERED",
    "CANCELLED",
  ] as const;

  const periodLabel =
    ANALYTICS_PERIODS.find((p) => p.value === period)?.label ?? period;
  const exportHref = `/api/admin/export/shipments?period=${period}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Analytics</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Tren, lead time, dan laporan — periode {periodLabel.toLowerCase()}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-neutral-200 bg-white p-0.5">
            {ANALYTICS_PERIODS.map((p) => {
              const href = `/admin/analytics?period=${p.value}&trend=${
                p.value === "7" ? "7" : trendDays
              }`;
              const active = period === p.value;
              return (
                <Link
                  key={p.value}
                  href={href}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                    active
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  {p.label}
                </Link>
              );
            })}
          </div>
          <a
            href={exportHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export CSV
          </a>
          <a
            href={`${exportHref}&format=tsv`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800"
          >
            <Download className="h-3.5 w-3.5" />
            Excel
          </a>
        </div>
      </div>

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Shipment (periode)",
            value: createdInPeriod,
            hint: `${totalShipments} dalam filter status`,
          },
          {
            label: "Completion rate",
            value: `${completionRate}%`,
            hint: `${delivered} terkirim · ${deliveredInPeriod} selesai di periode`,
          },
          {
            label: "Avg progress",
            value: `${Math.round(avgProgress * 10) / 10}%`,
            hint: `${withoutTasks} tanpa WBS`,
          },
          {
            label: "Avg lead time aktual",
            value: lead.count ? `${lead.avgActual} hari` : "—",
            hint: lead.count
              ? `estimasi avg ${lead.avgEstimated || "—"} · n=${lead.count}`
              : "Belum ada delivery",
          },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-neutral-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {card.label}
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-neutral-900">{card.value}</p>
            <p className="mt-1 text-xs text-neutral-500">{card.hint}</p>
          </div>
        ))}
      </div>

      {/* Lead time vs estimate */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">
              Lead time aktual vs estimasi
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              Dari shipment terkirim
              {since ? ` (delivered dalam ${periodLabel.toLowerCase()})` : ""}. Delta = aktual −
              estimasi.
            </p>
          </div>
        </div>
        {lead.count === 0 ? (
          <p className="mt-6 text-sm text-neutral-500">Belum ada data delivery untuk periode ini.</p>
        ) : (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { label: "Avg aktual", value: `${lead.avgActual} hari` },
                {
                  label: "Avg estimasi",
                  value: lead.withEstimateCount ? `${lead.avgEstimated} hari` : "—",
                },
                {
                  label: "Avg delta",
                  value:
                    lead.withEstimateCount > 0
                      ? `${lead.avgDelta > 0 ? "+" : ""}${lead.avgDelta} hari`
                      : "—",
                },
                {
                  label: "On-time rate",
                  value: lead.onTimeRate != null ? `${lead.onTimeRate}%` : "—",
                },
                {
                  label: "Rentang aktual",
                  value:
                    lead.minActual != null
                      ? `${lead.minActual}–${lead.maxActual} hari`
                      : "—",
                },
              ].map((m) => (
                <div key={m.label} className="rounded-lg bg-neutral-50 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                    {m.label}
                  </p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-neutral-900">{m.value}</p>
                </div>
              ))}
            </div>
            {lead.withEstimateCount > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800">
                  Lebih cepat: {lead.fasterCount}
                </span>
                <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-medium text-neutral-700">
                  Tepat: {lead.onTimeExact}
                </span>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-900">
                  Lebih lambat: {lead.slowerCount}
                </span>
                <span className="text-neutral-500">
                  · {lead.withEstimateCount}/{lead.count} punya estimasi hari
                </span>
              </div>
            ) : null}
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="border-b border-neutral-100 text-xs text-neutral-500">
                  <tr>
                    <th className="py-2 font-medium">Tracking</th>
                    <th className="py-2 font-medium">Customer</th>
                    <th className="py-2 font-medium">Aktual</th>
                    <th className="py-2 font-medium">Estimasi</th>
                    <th className="py-2 font-medium">Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {leadSamples.slice(0, 10).map((s, i) => {
                    const row = recentCompleted[i];
                    return (
                      <tr key={`${row.trackingNumber}-${i}`}>
                        <td className="py-2 font-mono text-xs">{row.trackingNumber}</td>
                        <td className="py-2 text-neutral-600">
                          {[row.companyName, row.customerName].filter(Boolean).join(" · ") ||
                            "—"}
                        </td>
                        <td className="py-2 tabular-nums">{s.actualDays}</td>
                        <td className="py-2 tabular-nums">
                          {s.estimatedDays != null ? s.estimatedDays : "—"}
                        </td>
                        <td
                          className={`py-2 tabular-nums font-medium ${
                            s.delta == null
                              ? "text-neutral-400"
                              : s.delta <= 0
                                ? "text-emerald-700"
                                : "text-amber-800"
                          }`}
                        >
                          {s.delta == null
                            ? "—"
                            : s.delta === 0
                              ? "0"
                              : s.delta > 0
                                ? `+${s.delta}`
                                : String(s.delta)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Trends */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">
                Tren shipment baru ({trendDays} hari)
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                {createdBuckets.reduce((a, b) => a + b.count, 0)} dibuat
              </p>
            </div>
            <div className="flex rounded-md border border-neutral-200 p-0.5">
              {([7, 30] as const).map((d) => (
                <Link
                  key={d}
                  href={`/admin/analytics?period=${period}&trend=${d}`}
                  className={`rounded px-2.5 py-1 text-[11px] font-medium ${
                    trendDays === d
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  {d}h
                </Link>
              ))}
            </div>
          </div>
          <TrendBars buckets={createdBuckets} />
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">
              Tren selesai / terkirim ({trendDays} hari)
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              {deliveredBuckets.reduce((a, b) => a + b.count, 0)} delivered
            </p>
          </div>
          <TrendBars buckets={deliveredBuckets} accentClass="bg-emerald-500/85" />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900">Distribusi status</h2>
          <ul className="mt-4 space-y-3">
            {statusOrder.map((status) => {
              const count = statusMap[status] ?? 0;
              const width = pct(count, totalShipments);
              return (
                <li key={status}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-neutral-700">
                      {SHIPMENT_STATUS_LABEL[status] ?? status}
                    </span>
                    <span className="tabular-nums text-neutral-500">
                      {count} · {width}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full bg-brand-blue transition-all"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900">Progress sub-tugas</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            {childTaskTotal} sub-tugas · {photoCount} foto
            {periodDays(period) != null ? ` · filter periode` : ""}
          </p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { label: "Selesai", value: childDone, className: "bg-emerald-50 text-emerald-800" },
              {
                label: "Dikerjakan",
                value: childInProgress,
                className: "bg-amber-50 text-amber-800",
              },
              { label: "Belum", value: childPending, className: "bg-neutral-100 text-neutral-700" },
            ].map((item) => (
              <div key={item.label} className={`rounded-lg px-3 py-4 text-center ${item.className}`}>
                <p className="text-2xl font-bold tabular-nums">{item.value}</p>
                <p className="mt-1 text-xs font-medium">{item.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-100">
            <div className="flex h-full">
              <div
                className="bg-emerald-500"
                style={{ width: `${pct(childDone, childTaskTotal)}%` }}
              />
              <div
                className="bg-amber-400"
                style={{ width: `${pct(childInProgress, childTaskTotal)}%` }}
              />
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Penggunaan template WBS</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              {withTemplate} shipment pakai template · {cancelled} dibatalkan (periode)
            </p>
          </div>
          <Link
            href="/admin/wbs-templates"
            className="text-xs font-medium text-neutral-600 hover:text-neutral-900"
          >
            Kelola →
          </Link>
        </div>
        <ul className="mt-4 divide-y divide-neutral-100">
          {templates.length === 0 ? (
            <li className="py-6 text-center text-sm text-neutral-500">Belum ada template.</li>
          ) : (
            templates.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <Link
                    href={`/admin/wbs-templates/${t.id}`}
                    className="font-medium text-neutral-900 hover:underline"
                  >
                    {t.name}
                  </Link>
                  <p className="text-xs text-neutral-500">
                    {t._count.items} item · estimasi {t.estimatedDays} hari
                    {!t.active ? " · nonaktif" : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium tabular-nums text-neutral-700">
                  {t._count.shipments} job
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-neutral-900">Shipment aktif tertua</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Prioritas follow-up — diurutkan dari yang paling lama dibuat.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-100 bg-neutral-50/80 text-neutral-500">
              <tr>
                <th className="px-5 py-3 font-medium">Tracking</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Progress</th>
                <th className="px-5 py-3 font-medium">Umur</th>
                <th className="px-5 py-3 font-medium print:hidden">Laporan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {slowShipments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-neutral-500">
                    Tidak ada shipment aktif.
                  </td>
                </tr>
              ) : (
                slowShipments.map((row) => {
                  const ageDays = Math.floor(
                    (Date.now() - row.createdAt.getTime()) / (1000 * 60 * 60 * 24)
                  );
                  const end = resolveEndDate(row);
                  const overdue = end != null && end.getTime() < Date.now();
                  return (
                    <tr key={row.id} className="hover:bg-neutral-50/50">
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/shipments/${row.id}/progress`}
                          className="font-mono text-xs font-medium text-neutral-900 hover:underline"
                        >
                          {row.trackingNumber}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-neutral-700">
                        {[row.companyName, row.customerName].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="px-5 py-3">
                        {SHIPMENT_STATUS_LABEL[row.status] ?? row.status}
                        {overdue ? (
                          <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                            Overdue
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 tabular-nums">{Number(row.progressPercent)}%</td>
                      <td className="px-5 py-3 tabular-nums text-neutral-600">{ageDays} hari</td>
                      <td className="px-5 py-3 print:hidden">
                        <Link
                          href={`/admin/shipments/${row.id}/report`}
                          className="text-xs font-medium text-neutral-600 hover:text-neutral-900"
                        >
                          PDF →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
