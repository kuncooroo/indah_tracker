import { Prisma, type ProgressTaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const MAX_SUB_HOURS = 8;

export function clampHours(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.min(MAX_SUB_HOURS, Math.max(0, Math.round(value)));
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function distributeWeights(parentCount: number, childCounts: number[]) {
  if (parentCount <= 0) return { parentWeights: [] as number[], childWeights: [] as number[][] };
  const parentWeight = round2(100 / parentCount);
  const parentWeights = Array.from({ length: parentCount }, (_, i) =>
    i === parentCount - 1 ? round2(100 - parentWeight * (parentCount - 1)) : parentWeight
  );
  const childWeights = parentWeights.map((pw, i) => {
    const n = childCounts[i] ?? 0;
    if (n <= 0) return [] as number[];
    const each = round2(pw / n);
    return Array.from({ length: n }, (_, j) =>
      j === n - 1 ? round2(pw - each * (n - 1)) : each
    );
  });
  return { parentWeights, childWeights };
}

export async function recalculateShipmentProgress(shipmentId: string) {
  const tasks = await prisma.progressTask.findMany({
    where: { shipmentId },
    select: {
      id: true,
      parentId: true,
      status: true,
      weightPercent: true,
    },
  });

  const parentIds = new Set(tasks.filter((t) => !t.parentId).map((t) => t.id));
  const childrenByParent = new Map<string, typeof tasks>();
  for (const t of tasks) {
    if (!t.parentId) continue;
    const list = childrenByParent.get(t.parentId) ?? [];
    list.push(t);
    childrenByParent.set(t.parentId, list);
  }

  let completed = 0;
  for (const parentId of parentIds) {
    const children = childrenByParent.get(parentId) ?? [];
    if (children.length === 0) {
      const parent = tasks.find((t) => t.id === parentId);
      if (parent?.status === "COMPLETED") completed += Number(parent.weightPercent);
    } else {
      for (const child of children) {
        if (child.status === "COMPLETED") completed += Number(child.weightPercent);
      }
    }
  }

  const progressPercent = new Prisma.Decimal(round2(Math.min(100, Math.max(0, completed))));

  for (const parentId of parentIds) {
    const children = childrenByParent.get(parentId) ?? [];
    if (children.length === 0) continue;
    const allDone = children.every((c) => c.status === "COMPLETED");
    const anyStarted = children.some(
      (c) => c.status === "IN_PROGRESS" || c.status === "COMPLETED"
    );
    const nextStatus: ProgressTaskStatus = allDone
      ? "COMPLETED"
      : anyStarted
        ? "IN_PROGRESS"
        : "NOT_STARTED";
    await prisma.progressTask.update({
      where: { id: parentId },
      data: {
        status: nextStatus,
        completedAt: allDone ? new Date() : null,
        ...(!anyStarted ? { startedAt: null } : {}),
      },
    });
    if (anyStarted) {
      await prisma.progressTask.updateMany({
        where: { id: parentId, startedAt: null },
        data: { startedAt: new Date() },
      });
    }
  }

  const shipmentStatus =
    Number(progressPercent) >= 100
      ? ("DELIVERED" as const)
      : Number(progressPercent) > 0
        ? ("IN_PROGRESS" as const)
        : undefined;

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      progressPercent,
      ...(shipmentStatus
        ? {
            status: shipmentStatus,
            deliveredAt: shipmentStatus === "DELIVERED" ? new Date() : null,
          }
        : {}),
    },
  });

  return progressPercent;
}

export async function applyWbsTemplateToShipment(shipmentId: string, templateId: string) {
  const [shipment, template] = await Promise.all([
    prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { id: true, createdAt: true },
    }),
    prisma.wbsTemplate.findUnique({
      where: { id: templateId },
      include: {
        items: {
          where: { parentId: null },
          orderBy: { sortOrder: "asc" },
          include: { children: { orderBy: { sortOrder: "asc" } } },
        },
      },
    }),
  ]);

  if (!shipment) throw new Error("SHIPMENT_NOT_FOUND");
  if (!template || !template.active) throw new Error("TEMPLATE_NOT_FOUND");
  if (template.items.length === 0) throw new Error("TEMPLATE_EMPTY");

  const existing = await prisma.progressTask.count({ where: { shipmentId } });
  if (existing > 0) throw new Error("PROGRESS_ALREADY_EXISTS");

  const childCounts = template.items.map((p) => p.children.length);
  const { parentWeights, childWeights } = distributeWeights(
    template.items.length,
    childCounts
  );
  const daysPerParent = Math.max(1, Math.floor(template.estimatedDays / template.items.length));
  const endDate = new Date(shipment.createdAt);
  endDate.setDate(endDate.getDate() + template.estimatedDays);

  await prisma.$transaction(async (tx) => {
    await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        wbsTemplateId: template.id,
        estimatedDays: template.estimatedDays,
        estimatedEndDate: endDate,
        progressPercent: 0,
        status: "IN_PROGRESS",
      },
    });

    for (let i = 0; i < template.items.length; i++) {
      const parentItem = template.items[i];
      const parent = await tx.progressTask.create({
        data: {
          shipmentId,
          title: parentItem.title,
          sortOrder: parentItem.sortOrder,
          weightPercent: parentWeights[i] ?? 0,
          estimatedDays: daysPerParent,
          status: "NOT_STARTED",
        },
      });

      const kids = parentItem.children;
      const weights = childWeights[i] ?? [];
      for (let j = 0; j < kids.length; j++) {
        const child = kids[j];
        await tx.progressTask.create({
          data: {
            shipmentId,
            parentId: parent.id,
            title: child.title,
            sortOrder: child.sortOrder,
            weightPercent: weights[j] ?? 0,
            estimatedHours: clampHours(child.estimatedHours ?? 8),
            status: "NOT_STARTED",
          },
        });
      }
    }
  });
}
