import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createWbsTemplateItem,
  updateWbsTemplateItem,
  deleteWbsTemplateItem,
  duplicateWbsTemplate,
} from "@/lib/admin-wbs-actions";
import { prisma } from "@/lib/prisma";
import { distributeWeights, validateParentWeights } from "@/lib/wbs-weights";
import { AdminDeleteButton } from "@/components/admin/admin-forms";
import {
  WbsTemplateItemCreateDialog,
  WbsTemplateItemEditDialog,
} from "@/components/admin/admin-wbs-crud";
import { DuplicateWbsTemplateButton } from "@/components/admin/duplicate-wbs-template-button";

type PageProps = { params: Promise<{ id: string }> };

export default async function WbsTemplateDetailPage({ params }: PageProps) {
  const { id } = await params;
  const template = await prisma.wbsTemplate.findUnique({
    where: { id },
    include: {
      items: {
        where: { parentId: null },
        orderBy: { sortOrder: "asc" },
        include: { children: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!template) notFound();

  const childCounts = template.items.map((p) => p.children.length);
  const { parentWeights } = distributeWeights(template.items.length, childCounts);
  const weightCheck = validateParentWeights(parentWeights);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/wbs-templates" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Template WBS
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">{template.name}</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Estimasi {template.estimatedDays} hari
              {template.description ? ` · ${template.description}` : ""}
              {template.items.length > 0
                ? ` · preview Σ bobot ${weightCheck.sum}%`
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DuplicateWbsTemplateButton
              templateId={template.id}
              duplicateAction={duplicateWbsTemplate}
              redirectToCopy
            />
            <WbsTemplateItemCreateDialog templateId={template.id} createAction={createWbsTemplateItem} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {template.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500">
            Belum ada fase. Tambah fase parent terlebih dahulu.
          </div>
        ) : (
          template.items.map((parent, idx) => (
            <div key={parent.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 bg-neutral-50/80 px-5 py-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                    Fase {idx + 1} · bobot apply ~{parentWeights[idx] ?? 0}%
                  </p>
                  <h3 className="font-semibold text-neutral-900">{parent.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <WbsTemplateItemCreateDialog
                    templateId={template.id}
                    parentId={parent.id}
                    parentTitle={parent.title}
                    createAction={createWbsTemplateItem}
                  />
                  <WbsTemplateItemEditDialog
                    row={parent}
                    updateAction={updateWbsTemplateItem}
                  />
                  <AdminDeleteButton
                    action={async () => {
                      "use server";
                      return deleteWbsTemplateItem(parent.id);
                    }}
                  />
                </div>
              </div>
              <ul className="divide-y divide-neutral-100">
                {parent.children.length === 0 ? (
                  <li className="px-5 py-4 text-sm text-neutral-400">Belum ada sub-tugas.</li>
                ) : (
                  parent.children.map((child) => (
                    <li key={child.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-neutral-800">{child.title}</p>
                        <p className="text-xs text-neutral-500">
                          Estimasi {child.estimatedHours ?? 8} jam
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <WbsTemplateItemEditDialog row={child} updateAction={updateWbsTemplateItem} />
                        <AdminDeleteButton
                          action={async () => {
                            "use server";
                            return deleteWbsTemplateItem(child.id);
                          }}
                        />
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
