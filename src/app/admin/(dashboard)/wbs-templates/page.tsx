import Link from "next/link";
import {
  createWbsTemplate,
  updateWbsTemplate,
  deleteWbsTemplate,
} from "@/lib/admin-wbs-actions";
import { prisma } from "@/lib/prisma";
import { AdminDeleteButton } from "@/components/admin/admin-forms";
import { WbsTemplateCreateDialog, WbsTemplateEditDialog } from "@/components/admin/admin-wbs-crud";

export default async function WbsTemplatesPage() {
  const rows = await prisma.wbsTemplate.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true, shipments: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Template WBS</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Template fase produksi — diterapkan ke shipment untuk tracking progress.
          </p>
        </div>
        <WbsTemplateCreateDialog createAction={createWbsTemplate} />
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-100 bg-neutral-50/80 text-neutral-500">
            <tr>
              <th className="px-5 py-3 font-medium">Nama</th>
              <th className="px-5 py-3 font-medium">Hari</th>
              <th className="px-5 py-3 font-medium">Item</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 text-right font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-5 py-3">
                  <Link
                    href={`/admin/wbs-templates/${row.id}`}
                    className="font-medium text-neutral-900 hover:underline"
                  >
                    {row.name}
                  </Link>
                  {row.description ? (
                    <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">{row.description}</p>
                  ) : null}
                </td>
                <td className="px-5 py-3 tabular-nums">{row.estimatedDays}</td>
                <td className="px-5 py-3 tabular-nums">{row._count.items}</td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      row.active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
                    }`}
                  >
                    {row.active ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/wbs-templates/${row.id}`}
                      className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      Detail
                    </Link>
                    <WbsTemplateEditDialog row={row} updateAction={updateWbsTemplate} />
                    <AdminDeleteButton
                      action={async () => {
                        "use server";
                        return deleteWbsTemplate(row.id);
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
