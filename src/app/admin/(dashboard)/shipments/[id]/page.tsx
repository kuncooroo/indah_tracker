import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SHIPMENT_STATUS_LABEL } from "@/lib/tracking";
import { updateShipment, deleteShipment, restoreShipment, purgeShipment } from "@/lib/admin-actions";
import { AdminActionForm, AdminDeleteButton } from "@/components/admin/admin-forms";
import { ShipmentShareActions } from "@/components/admin/shipment-share-actions";
import { ActivityTimeline } from "@/components/admin/activity-timeline";
import { getShipmentActivityTimeline } from "@/lib/activity-log";
import {
  buildTrackPath,
  buildTrackUrl,
  buildWhatsAppTrackLink,
  reminderBadgeClass,
  reminderForShipment,
} from "@/lib/shipment-links";
import { getSoonDays } from "@/lib/reminder-config";
import { getAdminSession, isSuperAdmin } from "@/lib/auth";
import { cn } from "@/lib/utils";

type PageProps = { params: Promise<{ id: string }> };

const statusOptions = Object.entries(SHIPMENT_STATUS_LABEL).map(([value, label]) => ({
  value,
  label,
}));

export default async function ShipmentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [shipment, soonDays, activities, session] = await Promise.all([
    prisma.shipment.findUnique({
      where: { id },
      include: {
        _count: { select: { progressTasks: true } },
        wbsTemplate: { select: { name: true } },
      },
    }),
    getSoonDays(),
    getShipmentActivityTimeline(id, 40),
    getAdminSession(),
  ]);
  if (!shipment) redirect("/admin/shipments");

  const archived = Boolean(shipment.deletedAt);
  const superAdmin = isSuperAdmin(session);
  const { endDate, reminder } = reminderForShipment(shipment, soonDays);
  const trackPath = buildTrackPath(shipment.trackingNumber, shipment.phoneLast4);
  const trackUrl = buildTrackUrl(shipment.trackingNumber, shipment.phoneLast4);
  const waUrl = buildWhatsAppTrackLink({
    phone: shipment.phone,
    trackingNumber: shipment.trackingNumber,
    phoneLast4: shipment.phoneLast4,
    customerName: shipment.customerName,
    companyName: shipment.companyName,
    orderNumber: shipment.orderNumber,
  });
  const isClosed = shipment.status === "DELIVERED" || shipment.status === "CANCELLED";

  return (
    <div className="space-y-8">
      {archived ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-950">
            Shipment ini diarsipkan
            {shipment.deletedAt
              ? ` · ${shipment.deletedAt.toLocaleDateString("id-ID")}`
              : ""}
            . Tidak tampil di list aktif / track publik.
          </p>
          <div className="flex flex-wrap gap-2">
            <form
              action={async () => {
                "use server";
                await restoreShipment(shipment.id);
              }}
            >
              <button
                type="submit"
                className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
              >
                Pulihkan
              </button>
            </form>
            {superAdmin ? (
              <AdminDeleteButton
                label="Hapus permanen"
                action={async () => {
                  "use server";
                  return purgeShipment(shipment.id);
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={archived ? "/admin/shipments?archived=1" : "/admin/shipments"}
            className="text-sm text-neutral-500 hover:text-neutral-800"
          >
            ← Shipments
          </Link>
          <h1 className="mt-2 font-mono text-xl font-bold text-neutral-900">
            {shipment.trackingNumber}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {SHIPMENT_STATUS_LABEL[shipment.status]} · {Number(shipment.progressPercent)}%
            {shipment.wbsTemplate ? ` · ${shipment.wbsTemplate.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!archived ? (
            <>
              <Link
                href={`/admin/shipments/${shipment.id}/progress`}
                className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Update progress
              </Link>
              <Link
                href={`/admin/shipments/${shipment.id}/report`}
                className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
              >
                Laporan PDF
              </Link>
              <AdminDeleteButton
                label="Arsipkan"
                action={async () => {
                  "use server";
                  return deleteShipment(shipment.id);
                }}
              />
            </>
          ) : null}
        </div>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-neutral-900">Bagikan ke customer</h2>
            <p className="mt-1 break-all font-mono text-xs text-neutral-600">{trackUrl}</p>
            {!isClosed ? (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                Deadline:
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                    reminderBadgeClass(reminder.kind)
                  )}
                >
                  {reminder.shortLabel}
                </span>
                {endDate
                  ? `· target ${endDate.toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}`
                  : null}
                {shipment.estimatedDays ? `· estimasi ${shipment.estimatedDays} hari` : null}
              </p>
            ) : null}
          </div>
          <ShipmentShareActions trackUrl={trackUrl} trackPath={trackPath} whatsappUrl={waUrl} />
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-neutral-900">Data shipment</h2>
        {archived ? (
          <p className="mt-3 text-sm text-neutral-500">
            Pulihkan shipment untuk mengedit data.
          </p>
        ) : (
        <AdminActionForm
          action={updateShipment}
          className="mt-4 grid gap-4 sm:grid-cols-2"
          resetOnSuccess={false}
        >
          <input type="hidden" name="id" value={shipment.id} />
          <Field label="Customer" name="customerName" defaultValue={shipment.customerName ?? ""} />
          <Field label="Perusahaan" name="companyName" defaultValue={shipment.companyName ?? ""} />
          <Field label="Telepon" name="phone" defaultValue={shipment.phone ?? ""} />
          <Field label="Nomor PO" name="orderNumber" defaultValue={shipment.orderNumber ?? ""} />
          <Field
            label="External Order ID (ERP)"
            name="externalOrderId"
            defaultValue={shipment.externalOrderId ?? ""}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Status</label>
            <select
              name="status"
              defaultValue={shipment.status}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
            Progress WBS: <strong>{Number(shipment.progressPercent)}%</strong>
            <br />
            Tasks: {shipment._count.progressTasks}
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-neutral-700">Catatan</label>
            <textarea
              name="note"
              rows={2}
              defaultValue={shipment.note ?? ""}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Simpan
            </button>
          </div>
        </AdminActionForm>
        )}
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-neutral-900">Jejak perubahan</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Riwayat create, status, progress, foto, dan template.
        </p>
        <div className="mt-4">
          <ActivityTimeline items={activities} />
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-neutral-700">{label}</label>
      <input
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
      />
    </div>
  );
}
