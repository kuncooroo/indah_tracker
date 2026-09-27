import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SHIPMENT_STATUS_LABEL } from "@/lib/tracking";
import { updateShipment, deleteShipment } from "@/lib/admin-actions";
import { AdminActionForm, AdminDeleteButton } from "@/components/admin/admin-forms";

type PageProps = { params: Promise<{ id: string }> };

const statusOptions = Object.entries(SHIPMENT_STATUS_LABEL).map(([value, label]) => ({
  value,
  label,
}));

export default async function ShipmentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      _count: { select: { progressTasks: true } },
      wbsTemplate: { select: { name: true } },
    },
  });
  if (!shipment) redirect("/admin/shipments");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/shipments" className="text-sm text-neutral-500 hover:text-neutral-800">
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
          <Link
            href={`/admin/shipments/${shipment.id}/progress`}
            className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Progress WBS
          </Link>
          <Link
            href={`/track?code=${encodeURIComponent(shipment.trackingNumber)}${
              shipment.phoneLast4 ? `&phone=${encodeURIComponent(shipment.phoneLast4)}` : ""
            }`}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Halaman public
          </Link>
          <AdminDeleteButton
            label="Hapus"
            action={async () => {
              "use server";
              return deleteShipment(shipment.id);
            }}
          />
        </div>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-neutral-900">Data shipment</h2>
        <AdminActionForm action={updateShipment} className="mt-4 grid gap-4 sm:grid-cols-2" resetOnSuccess={false}>
          <input type="hidden" name="id" value={shipment.id} />
          <Field label="Customer" name="customerName" defaultValue={shipment.customerName ?? ""} />
          <Field label="Perusahaan" name="companyName" defaultValue={shipment.companyName ?? ""} />
          <Field label="Telepon" name="phone" defaultValue={shipment.phone ?? ""} />
          <Field label="Nomor PO" name="orderNumber" defaultValue={shipment.orderNumber ?? ""} />
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
