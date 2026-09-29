import { Prisma, type ProgressTaskStatus, type ShipmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  clampHours,
  distributeWeights,
  round2,
} from "@/lib/wbs-weights";

export {
  MAX_SUB_HOURS,
  WEIGHT_SUM_TOLERANCE,
  clampHours,
  round2,
  distributeWeights,
  validateParentWeights,
  previewTemplateWeights,
  type WeightCheck,
  type TemplatePreviewParent,
} from "@/lib/wbs-weights";

/**
 * Saran status dari progress WBS — tidak memaksa DELIVERED (itu keputusan logistics).
 * Status "downstream" (READY_TO_SHIP+) tidak diturunkan otomatis.
 */
export function suggestShipmentStatusFromProgress(input: {
  progressPercent: number;
  currentStatus: ShipmentStatus | string;
}): { suggested: ShipmentStatus | null; reason: string | null } {
  const pct = Number(input.progressPercent);
  const current = input.currentStatus;

  if (current === "CANCELLED" || current === "DELIVERED") {
    return { suggested: null, reason: null };
  }

  // Progress selesai → QC, jangan lompat ke DELIVERED
  if (pct >= 100) {
    if (current === "QUALITY_CHECK" || current === "READY_TO_SHIP" || current === "IN_TRANSIT") {
      return { suggested: null, reason: null };
    }
    return {
      suggested: "QUALITY_CHECK",
      reason: "Progress WBS 100% — sarankan Quality check (bukan otomatis Terkirim).",
    };
  }

  if (pct > 0) {
    if (current === "CREATED") {
      return {
        suggested: "IN_PROGRESS",
        reason: "Sudah ada progress — status masih Dibuat.",
      };
    }
    if (
      current === "QUALITY_CHECK" ||
      current === "READY_TO_SHIP" ||
      current === "IN_TRANSIT" ||
      current === "IN_PROGRESS"
    ) {
      return { suggested: null, reason: null };
    }
  }

  return { suggested: null, reason: null };
}

/** Status yang boleh di-auto-bump ringan dari recalc (tanpa override manual downstream). */
const AUTO_BUMPABLE: ReadonlySet<string> = new Set(["CREATED"]);

/** Redistribute parent/child weightPercent evenly after manual add/remove. */
export async function rebalanceShipmentWeights(shipmentId: string) {
  const parents = await prisma.progressTask.findMany({
    where: { shipmentId, parentId: null },
    orderBy: { sortOrder: "asc" },
    include: {
      children: { orderBy: { sortOrder: "asc" }, select: { id: true } },
    },
  });

  if (parents.length === 0) return;

  const childCounts = parents.map((p) => p.children.length);
  const { parentWeights, childWeights } = distributeWeights(parents.length, childCounts);

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < parents.length; i++) {
      const parent = parents[i];
      await tx.progressTask.update({
        where: { id: parent.id },
        data: { weightPercent: parentWeights[i] ?? 0 },
      });
      const weights = childWeights[i] ?? [];
      for (let j = 0; j < parent.children.length; j++) {
        await tx.progressTask.update({
          where: { id: parent.children[j].id },
          data: { weightPercent: weights[j] ?? 0 },
        });
      }
    }
  });
}

export async function recalculateShipmentProgress(shipmentId: string) {
  const [tasks, shipment] = await Promise.all([
    prisma.progressTask.findMany({
      where: { shipmentId },
      select: {
        id: true,
        parentId: true,
        status: true,
        weightPercent: true,
      },
    }),
    prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        id: true,
        status: true,
        progressPercent: true,
        trackingNumber: true,
        externalOrderId: true,
        orderNumber: true,
        customerName: true,
        companyName: true,
        phoneLast4: true,
      },
    }),
  ]);

  if (!shipment) {
    return new Prisma.Decimal(0);
  }

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

  // Auto-status: hanya bump ringan CREATED → IN_PROGRESS.
  let nextShipmentStatus: ShipmentStatus | undefined;
  const current = shipment.status;
  if (current && AUTO_BUMPABLE.has(current) && Number(progressPercent) > 0) {
    nextShipmentStatus = "IN_PROGRESS";
  }

  const prevProgress = Number(shipment.progressPercent);
  const progressChanged = Math.abs(prevProgress - Number(progressPercent)) >= 0.01;
  const statusChanged = Boolean(nextShipmentStatus && nextShipmentStatus !== current);

  const updated = await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      progressPercent,
      ...(nextShipmentStatus ? { status: nextShipmentStatus } : {}),
    },
  });

  if (statusChanged || progressChanged) {
    const { dispatchWebhook } = await import("@/lib/webhook");
    if (statusChanged) {
      void dispatchWebhook("shipment.status_changed", updated);
    } else {
      void dispatchWebhook("shipment.progress_updated", updated);
    }
  }

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
