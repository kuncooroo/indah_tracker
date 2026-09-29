import { prisma } from "@/lib/prisma";
import { SHIPMENT_STATUS_LABEL } from "@/lib/tracking";
import { formatRelativeId } from "@/lib/track-public";

export const ActivityAction = {
  SHIPMENT_CREATED: "SHIPMENT_CREATED",
  SHIPMENT_UPDATED: "SHIPMENT_UPDATED",
  STATUS_CHANGED: "STATUS_CHANGED",
  TASK_UPDATED: "TASK_UPDATED",
  TASK_CREATED: "TASK_CREATED",
  TASK_DELETED: "TASK_DELETED",
  PHOTO_UPLOADED: "PHOTO_UPLOADED",
  PHOTO_DELETED: "PHOTO_DELETED",
  TEMPLATE_APPLIED: "TEMPLATE_APPLIED",
  PROGRESS_CLEARED: "PROGRESS_CLEARED",
} as const;

export type ActivityActionType = (typeof ActivityAction)[keyof typeof ActivityAction];

export type ActivityActor = {
  type: "admin" | "api" | "system";
  id?: string | null;
  name?: string | null;
  email?: string | null;
};

function jsonSafe(value: unknown): string | null {
  if (value == null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export async function logActivity(input: {
  shipmentId: string;
  action: ActivityActionType | string;
  summary: string;
  publicText?: string | null;
  actor: ActivityActor;
  before?: unknown;
  after?: unknown;
  meta?: unknown;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        shipmentId: input.shipmentId,
        action: input.action,
        summary: input.summary.slice(0, 191),
        publicText: input.publicText ? input.publicText.slice(0, 191) : null,
        actorType: input.actor.type,
        actorId: input.actor.id ?? null,
        actorName: input.actor.name ?? null,
        actorEmail: input.actor.email ?? null,
        beforeJson: jsonSafe(input.before),
        afterJson: jsonSafe(input.after),
        metaJson: jsonSafe(input.meta),
      },
    });
  } catch (e) {
    // Jangan gagalkan aksi utama karena audit gagal
    console.error("[activity-log]", e instanceof Error ? e.message : e);
  }
}

export function actorFromSession(session: {
  user?: { id?: string; name?: string | null; email?: string | null } | null;
} | null): ActivityActor {
  if (!session?.user) return { type: "system", name: "System" };
  return {
    type: "admin",
    id: session.user.id ?? null,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
  };
}

export function statusPublicLabel(status: string) {
  return SHIPMENT_STATUS_LABEL[status] ?? status;
}

/** Ringkasan aman untuk track publik (tanpa actor/email/internal JSON). */
export function toPublicActivity(row: {
  action: string;
  publicText: string | null;
  createdAt: Date;
}) {
  if (!row.publicText) return null;
  return {
    text: row.publicText,
    at: row.createdAt.toISOString(),
    relative: formatRelativeId(row.createdAt),
  };
}

export async function getShipmentActivityTimeline(shipmentId: string, take = 50) {
  return prisma.activityLog.findMany({
    where: { shipmentId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function getPublicActivityFeed(shipmentId: string, take = 8) {
  const rows = await prisma.activityLog.findMany({
    where: {
      shipmentId,
      publicText: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      action: true,
      publicText: true,
      createdAt: true,
    },
  });
  return rows.map(toPublicActivity).filter((x): x is NonNullable<typeof x> => Boolean(x));
}
