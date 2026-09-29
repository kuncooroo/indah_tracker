import Link from "next/link";
import { SHIPMENT_STATUS_LABEL } from "@/lib/tracking";
import { deleteShipment, purgeShipment, restoreShipment } from "@/lib/admin-actions";
import { AdminDeleteButton } from "@/components/admin/admin-forms";
import { getAdminSession, isSuperAdmin } from "@/lib/auth";
import { ShipmentShareActions } from "@/components/admin/shipment-share-actions";
import {
  buildTrackPath,
  buildTrackUrl,
  buildWhatsAppTrackLink,
  reminderBadgeClass,
} from "@/lib/shipment-links";
import {
  buildShipmentsHref,
  deadlineLabel,
  parseShipmentListFilters,
  queryShipments,
} from "@/lib/shipment-query";
import { getSoonDays } from "@/lib/reminder-config";
import { cn, formatDateOnlyId } from "@/lib/utils";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminShipmentsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const filters = parseShipmentListFilters(sp);
  const soonDays = await getSoonDays();
  const session = await getAdminSession();
  const superAdmin = isSuperAdmin(session);
  const { total, pageCount, rows } = await queryShipments(filters, soonDays);

  const statusOptions = Object.entries(SHIPMENT_STATUS_LABEL);
  const deadlineTitle = deadlineLabel(filters.deadline);
  const from = total === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1;
  const to = Math.min(filters.page * filters.pageSize, total);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            {filters.archived ? "Arsip shipments" : "Shipments"}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {filters.archived
              ? "Shipment yang diarsipkan — bisa dipulihkan atau dihapus permanen (SUPERADMIN)."
              : "Kelola nomor tracking dan progress pengiriman."}
            {deadlineTitle ? (
              <span className="ml-1 font-medium text-neutral-700">· Filter: {deadlineTitle}</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={filters.archived ? "/admin/shipments" : "/admin/shipments?archived=1"}
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
          >
            {filters.archived ? "← Aktif" : "Lihat arsip"}
          </Link>
          {!filters.archived ? (
            <Link
              href="/admin/shipments/new"
              className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
            >
              + Generate tracking
            </Link>
          ) : null}
        </div>
      </div>

      {/* Search & filters */}
      <form
        method="get"
        className="rounded-xl border border-neutral-200 bg-white p-4"
      >
        <div className="grid gap-3 md:grid-cols-4">
          <label className="block text-sm md:col-span-2">
            <span className="font-medium text-neutral-700">Cari</span>
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Tracking, PO, customer, company, telepon…"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-neutral-700">Status</span>
            <select
              name="status"
              defaultValue={filters.status}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
            >
              <option value="">Semua status</option>
              {statusOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-neutral-700">Deadline</span>
            <select
              name="deadline"
              defaultValue={filters.deadline}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
            >
              <option value="">Semua</option>
              <option value="active">Aktif saja</option>
              <option value="overdue">Sudah telat</option>
              <option value="due_soon">Due soon (≤{soonDays} hari)</option>
              <option value="on_track">On track</option>
              <option value="no_deadline">Tanpa target</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Terapkan filter
          </button>
          {(filters.q || filters.status || filters.deadline) && (
            <Link
              href="/admin/shipments"
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Reset
            </Link>
          )}
          <p className="ml-auto text-xs text-neutral-500">
            Menampilkan {from}–{to} dari {total} shipment
          </p>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-neutral-100 bg-neutral-50/80 text-neutral-500">
              <tr>
                <th className="px-5 py-3 font-medium">Tracking</th>
                <th className="px-5 py-3 font-medium">PO / Customer</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Progress</th>
                <th className="px-5 py-3 font-medium">Deadline</th>
                <th className="px-5 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-neutral-500">
                    {total === 0 && !filters.q && !filters.status && !filters.deadline
                      ? "Belum ada data. Generate tracking pertama Anda."
                      : "Tidak ada shipment yang cocok dengan filter."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const trackPath = buildTrackPath(row.trackingNumber, row.phoneLast4);
                  const trackUrl = buildTrackUrl(row.trackingNumber, row.phoneLast4);
                  const waUrl = buildWhatsAppTrackLink({
                    phone: row.phone,
                    trackingNumber: row.trackingNumber,
                    phoneLast4: row.phoneLast4,
                    customerName: row.customerName,
                    companyName: row.companyName,
                    orderNumber: row.orderNumber,
                  });
                  const isClosed = row.status === "DELIVERED" || row.status === "CANCELLED";

                  return (
                    <tr key={row.id} className="hover:bg-neutral-50/40">
                      <td className="px-5 py-3 font-mono text-xs font-medium">
                        <Link
                          href={`/admin/shipments/${row.id}`}
                          className="text-neutral-900 hover:underline"
                        >
                          {row.trackingNumber}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-neutral-900">{row.customerName ?? "—"}</p>
                        <p className="text-xs text-neutral-500">
                          {[row.orderNumber, row.companyName].filter(Boolean).join(" · ") || "—"}
                        </p>
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
                        {isClosed ? (
                          <span className="text-xs text-neutral-400">—</span>
                        ) : (
                          <div>
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                                reminderBadgeClass(row.reminder.kind)
                              )}
                            >
                              {row.reminder.shortLabel}
                            </span>
                            {row.endDate ? (
                              <p className="mt-1 text-[11px] text-neutral-500">
                                {formatDateOnlyId(row.endDate)}
                                {row.estimatedDays ? ` · ${row.estimatedDays}h` : ""}
                              </p>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {filters.archived ? (
                            <>
                              <form
                                action={async () => {
                                  "use server";
                                  await restoreShipment(row.id);
                                }}
                              >
                                <button
                                  type="submit"
                                  className="rounded-md border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
                                >
                                  Pulihkan
                                </button>
                              </form>
                              {superAdmin ? (
                                <AdminDeleteButton
                                  iconOnly
                                  label="Hapus permanen"
                                  action={async () => {
                                    "use server";
                                    return purgeShipment(row.id);
                                  }}
                                />
                              ) : null}
                            </>
                          ) : (
                            <>
                              <Link
                                href={`/admin/shipments/${row.id}/progress`}
                                className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                              >
                                Update progress
                              </Link>
                              <ShipmentShareActions
                                compact
                                trackUrl={trackUrl}
                                trackPath={trackPath}
                                whatsappUrl={waUrl}
                              />
                              <AdminDeleteButton
                                iconOnly
                                label="Arsipkan"
                                action={async () => {
                                  "use server";
                                  return deleteShipment(row.id);
                                }}
                              />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pageCount > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-5 py-3">
            <p className="text-xs text-neutral-500">
              Halaman {filters.page} dari {pageCount}
            </p>
            <div className="flex items-center gap-2">
              {filters.page > 1 ? (
                <Link
                  href={buildShipmentsHref({ ...filters, page: filters.page - 1 })}
                  className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  ← Prev
                </Link>
              ) : (
                <span className="rounded-md border border-neutral-100 px-3 py-1.5 text-xs text-neutral-300">
                  ← Prev
                </span>
              )}
              {filters.page < pageCount ? (
                <Link
                  href={buildShipmentsHref({ ...filters, page: filters.page + 1 })}
                  className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Next →
                </Link>
              ) : (
                <span className="rounded-md border border-neutral-100 px-3 py-1.5 text-xs text-neutral-300">
                  Next →
                </span>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
