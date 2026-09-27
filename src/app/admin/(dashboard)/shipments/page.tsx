import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SHIPMENT_STATUS_LABEL } from "@/lib/tracking";
import { deleteShipment } from "@/lib/admin-actions";
import { AdminDeleteButton } from "@/components/admin/admin-forms";

export default async function AdminShipmentsPage() {
  const rows = await prisma.shipment.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Shipments</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Kelola nomor tracking dan progress pengiriman.
          </p>
        </div>
        <Link
          href="/admin/shipments/new"
          className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
        >
          + Generate tracking
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-100 bg-neutral-50/80 text-neutral-500">
            <tr>
              <th className="px-5 py-3 font-medium">Tracking</th>
              <th className="px-5 py-3 font-medium">PO / Customer</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Progress</th>
              <th className="px-5 py-3 text-right font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-neutral-500">
                  Belum ada data. Generate tracking pertama Anda.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
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
                  <td className="px-5 py-3 tabular-nums">{Number(row.progressPercent)}%</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/shipments/${row.id}/progress`}
                        className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                      >
                        Progress
                      </Link>
                      <Link
                        href={`/admin/shipments/${row.id}`}
                        className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                      >
                        Detail
                      </Link>
                      <Link
                        href={`/track?code=${encodeURIComponent(row.trackingNumber)}${
                          row.phoneLast4 ? `&phone=${encodeURIComponent(row.phoneLast4)}` : ""
                        }`}
                        className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                      >
                        Public
                      </Link>
                      <AdminDeleteButton
                        action={async () => {
                          "use server";
                          return deleteShipment(row.id);
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
