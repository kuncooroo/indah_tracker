import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Package,
  TrendingUp,
  ListTree,
  ArrowRight,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SHIPMENT_STATUS_LABEL } from "@/lib/tracking";
import {
  ACTIVE_SHIPMENT_STATUSES,
  reminderBadgeClass,
  reminderForShipment,
} from "@/lib/shipment-links";
import { buildShipmentsHref } from "@/lib/shipment-query";
import { getSoonDays } from "@/lib/reminder-config";
import { buildDailyBuckets, periodSince } from "@/lib/analytics";
import { cn, formatDateLongId } from "@/lib/utils";
import { AdminOnboardingGuide } from "@/components/admin/onboarding-guide";

export default async function AdminDashboardPage() {
  const todayLabel = formatDateLongId(new Date());
  const soonDays = await getSoonDays();
  const since7 = periodSince("7")!;

  const [
    total,
    inProgress,
    delivered,
    recent,
    activeJobs,
    templates,
    trendCreated,
    trendDelivered,
    withProgress,
  ] = await Promise.all([
    prisma.shipment.count({ where: { deletedAt: null } }),
    prisma.shipment.count({
      where: { status: { in: [...ACTIVE_SHIPMENT_STATUSES] }, deletedAt: null },
    }),
    prisma.shipment.count({ where: { status: "DELIVERED", deletedAt: null } }),
    prisma.shipment.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        trackingNumber: true,
        orderNumber: true,
        status: true,
        progressPercent: true,
        customerName: true,
        companyName: true,
        estimatedDays: true,
        estimatedEndDate: true,
        createdAt: true,
      },
    }),
    prisma.shipment.findMany({
      where: { status: { in: [...ACTIVE_SHIPMENT_STATUSES] }, deletedAt: null },
      orderBy: [{ estimatedEndDate: "asc" }, { createdAt: "asc" }],
      take: 40,
      select: {
        id: true,
        trackingNumber: true,
        orderNumber: true,
        status: true,
        progressPercent: true,
        customerName: true,
        companyName: true,
        estimatedDays: true,
        estimatedEndDate: true,
        createdAt: true,
      },
    }),
    prisma.wbsTemplate.count({ where: { active: true } }),
    prisma.shipment.findMany({
      where: { createdAt: { gte: since7 }, deletedAt: null },
      select: { createdAt: true },
    }),
    prisma.shipment.findMany({
      where: { status: "DELIVERED", deliveredAt: { gte: since7 }, deletedAt: null },
      select: { deliveredAt: true },
    }),
    prisma.shipment.count({
      where: { deletedAt: null, progressTasks: { some: {} } },
    }),
  ]);

  const createdBuckets = buildDailyBuckets(
    7,
    trendCreated.map((r) => ({ at: r.createdAt }))
  );
  const deliveredBuckets = buildDailyBuckets(
    7,
    trendDelivered.filter((r) => r.deliveredAt).map((r) => ({ at: r.deliveredAt! }))
  );
  const maxTrend = Math.max(
    1,
    ...createdBuckets.map((b) => b.count),
    ...deliveredBuckets.map((b) => b.count)
  );

  const withReminder = activeJobs.map((job) => {
    const { endDate, reminder } = reminderForShipment(job, soonDays);
    return { ...job, endDate, reminder };
  });

  const overdue = withReminder
    .filter((j) => j.reminder.kind === "overdue")
    .sort((a, b) => (a.reminder.days ?? 0) - (b.reminder.days ?? 0));
  const dueSoon = withReminder
    .filter((j) => j.reminder.kind === "due_soon")
    .sort((a, b) => (a.reminder.days ?? 0) - (b.reminder.days ?? 0));
  const onTrack = withReminder.filter((j) => j.reminder.kind === "on_track");
  const noDeadline = withReminder.filter((j) => j.reminder.kind === "no_deadline");

  const overdueTotal = overdue.length;
  const dueSoonTotal = dueSoon.length;

  return (
    <div className="space-y-8">
      <AdminOnboardingGuide
        stats={{ templates, shipments: total, withProgress }}
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Dashboard</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Ringkasan operasional tracking Indah Mesin.
          </p>
        </div>
        <div className="rounded-xl border border-brand-blue/20 bg-brand-blue-soft px-4 py-3 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-blue">
            Hari ini
          </p>
          <p className="mt-0.5 text-sm font-semibold capitalize text-neutral-900">{todayLabel}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href={buildShipmentsHref({ deadline: "overdue" })}
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/80 p-4 transition hover:border-red-300 hover:bg-red-50"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700">
            <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-red-700/80">Sudah telat</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-red-800">{overdueTotal}</p>
            <p className="text-xs text-red-700/70">Lihat daftar →</p>
          </div>
        </Link>
        <Link
          href={buildShipmentsHref({ deadline: "due_soon" })}
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 transition hover:border-amber-300 hover:bg-amber-50"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
            <CalendarClock className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-amber-800/80">
              Reminder ≤{soonDays} hari
            </p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-amber-900">{dueSoonTotal}</p>
            <p className="text-xs text-amber-800/70">Lihat daftar →</p>
          </div>
        </Link>
        <Link
          href={buildShipmentsHref({ deadline: "on_track" })}
          className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 transition hover:border-emerald-300 hover:bg-emerald-50"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700/80">
              On track
            </p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-emerald-800">{onTrack.length}</p>
            <p className="text-xs text-emerald-700/70">Lihat daftar →</p>
          </div>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total shipment",
            value: total,
            icon: Package,
            hint: "Semua waktu",
            href: "/admin/shipments",
          },
          {
            label: "Aktif",
            value: inProgress,
            icon: TrendingUp,
            hint: "Sedang diproses",
            href: buildShipmentsHref({ deadline: "active" }),
          },
          {
            label: "Terkirim",
            value: delivered,
            icon: CheckCircle2,
            hint: "Selesai",
            href: buildShipmentsHref({ status: "DELIVERED" }),
          },
          {
            label: "Template aktif",
            value: templates,
            icon: ListTree,
            hint: "WBS siap pakai",
            href: "/admin/wbs-templates",
          },
        ].map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-300 hover:bg-neutral-50/50"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {card.label}
              </p>
              <card.icon className="h-4 w-4 text-neutral-400" strokeWidth={1.75} />
            </div>
            <p className="mt-2 text-3xl font-bold tabular-nums text-neutral-900">{card.value}</p>
            <p className="mt-1 text-xs text-neutral-500">{card.hint}</p>
          </Link>
        ))}
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Tren 7 hari</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              Biru = baru dibuat · hijau = terkirim
            </p>
          </div>
          <Link
            href="/admin/analytics?period=7&trend=7"
            className="inline-flex items-center gap-1 text-xs font-medium text-neutral-600 hover:text-neutral-900"
          >
            Detail analytics <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-5 flex h-28 items-end gap-2">
          {createdBuckets.map((d, i) => (
            <div key={d.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex h-20 w-full items-end justify-center gap-0.5">
                <div
                  className="w-[45%] rounded-t bg-brand-blue/80"
                  style={{ height: `${Math.max(3, (d.count / maxTrend) * 100)}%` }}
                  title={`Baru ${d.label}: ${d.count}`}
                />
                <div
                  className="w-[45%] rounded-t bg-emerald-500/80"
                  style={{
                    height: `${Math.max(3, ((deliveredBuckets[i]?.count ?? 0) / maxTrend) * 100)}%`,
                  }}
                  title={`Selesai ${d.label}: ${deliveredBuckets[i]?.count ?? 0}`}
                />
              </div>
              <span className="truncate text-[9px] text-neutral-400">{d.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Reminder proses</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              Berdasarkan estimasi hari / target selesai.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={buildShipmentsHref({ deadline: "overdue" })}
              className="text-xs font-medium text-red-700 hover:underline"
            >
              Semua telat
            </Link>
            <Link
              href={buildShipmentsHref({ deadline: "due_soon" })}
              className="text-xs font-medium text-amber-800 hover:underline"
            >
              Semua due soon
            </Link>
            <Link
              href="/admin/analytics"
              className="inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              Analytics <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {overdue.length === 0 && dueSoon.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Clock3 className="mx-auto h-8 w-8 text-neutral-300" strokeWidth={1.5} />
            <p className="mt-3 text-sm font-medium text-neutral-700">Tidak ada reminder mendesak</p>
            <p className="mt-1 text-xs text-neutral-500">
              {noDeadline.length > 0
                ? `${noDeadline.length} job aktif belum punya target selesai.`
                : "Semua job aktif masih aman atau belum ada yang aktif."}
            </p>
            {noDeadline.length > 0 ? (
              <Link
                href={buildShipmentsHref({ deadline: "no_deadline" })}
                className="mt-3 inline-block text-xs font-medium text-neutral-700 underline"
              >
                Lihat tanpa target →
              </Link>
            ) : null}
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {[...overdue, ...dueSoon].slice(0, 12).map((job) => (
              <li
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/shipments/${job.id}/progress`}
                      className="font-mono text-xs font-semibold text-neutral-900 hover:underline"
                    >
                      {job.trackingNumber}
                    </Link>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                        reminderBadgeClass(job.reminder.kind)
                      )}
                    >
                      {job.reminder.shortLabel}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-neutral-600">
                    {[job.companyName, job.customerName].filter(Boolean).join(" · ") || "—"}
                    {job.estimatedDays ? ` · estimasi ${job.estimatedDays} hari` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {job.reminder.label}
                    {job.endDate
                      ? ` · target ${job.endDate.toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}`
                      : ""}
                    {" · "}
                    {SHIPMENT_STATUS_LABEL[job.status] ?? job.status}
                    {" · "}
                    {Number(job.progressPercent)}%
                  </p>
                </div>
                <Link
                  href={`/admin/shipments/${job.id}/progress`}
                  className="shrink-0 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Update progress
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-neutral-900">Shipment terbaru</h2>
          <Link
            href="/admin/shipments"
            className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
          >
            Lihat semua →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-100 bg-neutral-50/80 text-neutral-500">
              <tr>
                <th className="px-5 py-3 font-medium">Tracking</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Progress</th>
                <th className="px-5 py-3 font-medium">Deadline</th>
                <th className="px-5 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-neutral-500">
                    Belum ada shipment.
                  </td>
                </tr>
              ) : (
                recent.map((row) => {
                  const { endDate, reminder } = reminderForShipment(row, soonDays);
                  const isActive = ACTIVE_SHIPMENT_STATUSES.includes(
                    row.status as (typeof ACTIVE_SHIPMENT_STATUSES)[number]
                  );
                  return (
                    <tr key={row.id} className="hover:bg-neutral-50/50">
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/shipments/${row.id}`}
                          className="font-mono text-xs font-medium text-neutral-900 hover:underline"
                        >
                          {row.trackingNumber}
                        </Link>
                        {row.orderNumber ? (
                          <p className="text-xs text-neutral-500">{row.orderNumber}</p>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-neutral-700">
                        {[row.companyName, row.customerName].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="px-5 py-3">
                        {SHIPMENT_STATUS_LABEL[row.status] ?? row.status}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-neutral-100">
                            <div
                              className="h-full rounded-full bg-brand-blue"
                              style={{
                                width: `${Math.min(100, Number(row.progressPercent))}%`,
                              }}
                            />
                          </div>
                          <span className="tabular-nums text-xs text-neutral-600">
                            {Number(row.progressPercent)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {row.status === "DELIVERED" || row.status === "CANCELLED" ? (
                          <span className="text-xs text-neutral-400">—</span>
                        ) : isActive ? (
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                              reminderBadgeClass(reminder.kind)
                            )}
                            title={
                              endDate
                                ? `Target ${endDate.toLocaleDateString("id-ID")}`
                                : reminder.label
                            }
                          >
                            {reminder.shortLabel}
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/admin/shipments/${row.id}/progress`}
                          className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                        >
                          Update progress
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

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            href: "/admin/shipments/new",
            title: "Buat tracking baru",
            desc: "Input shipment & progress manual",
          },
          {
            href: "/admin/wbs-templates",
            title: "Kelola template WBS",
            desc: `${templates} template aktif`,
          },
          {
            href: "/admin/analytics",
            title: "Lihat analytics",
            desc: "Performa & tren shipment",
          },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-300 hover:bg-neutral-50"
          >
            <p className="text-sm font-semibold text-neutral-900">{item.title}</p>
            <p className="mt-1 text-xs text-neutral-500">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
