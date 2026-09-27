import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SHIPMENT_STATUS_LABEL } from "@/lib/tracking";

export default async function AdminDashboardPage() {
  const [total, inProgress, delivered, recent] = await Promise.all([
    prisma.shipment.count(),
    prisma.shipment.count({
      where: { status: { in: ["CREATED", "IN_PROGRESS", "QUALITY_CHECK", "READY_TO_SHIP", "IN_TRANSIT"] } },
    }),
    prisma.shipment.count({ where: { status: "DELIVERED" } }),
    prisma.shipment.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        trackingNumber: true,
        orderNumber: true,
        status: true,
        progressPercent: true,
        customerName: true,
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-500">Ringkasan operasional tracking.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total shipment", value: total },
          { label: "Aktif", value: inProgress },
          { label: "Terkirim", value: delivered },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-neutral-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {card.label}
            </p>
            <p className="mt-2 text-3xl font-bold text-neutral-900">{card.value}</p>
          </div>
        ))}
      </div>

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
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-100 bg-neutral-50/80 text-neutral-500">
            <tr>
              <th className="px-5 py-3 font-medium">Tracking</th>
              <th className="px-5 py-3 font-medium">Customer</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {recent.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-neutral-500">
                  Belum ada shipment.
                </td>
              </tr>
            ) : (
              recent.map((row) => (
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
                  <td className="px-5 py-3 text-neutral-700">{row.customerName ?? "—"}</td>
                  <td className="px-5 py-3">
                    {SHIPMENT_STATUS_LABEL[row.status] ?? row.status}
                  </td>
                  <td className="px-5 py-3 tabular-nums">{Number(row.progressPercent)}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
