import type { Prisma, ShipmentStatus } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  ACTIVE_SHIPMENT_STATUSES,
  reminderForShipment,
} from "@/lib/shipment-links";
import type { DeadlineReminder } from "@/lib/utils";

export const SHIPMENT_PAGE_SIZE = 20;
export const SHIPMENTS_LIST_CACHE_TAG = "shipments-list";

export type DeadlineFilter = DeadlineReminder["kind"] | "active";

export type ShipmentListFilters = {
  q: string;
  status: string;
  deadline: string;
  archived: boolean;
  page: number;
  pageSize: number;
};

export function parseShipmentListFilters(
  searchParams: Record<string, string | string[] | undefined>
): ShipmentListFilters {
  const get = (key: string) => {
    const v = searchParams[key];
    return Array.isArray(v) ? v[0] ?? "" : v ?? "";
  };
  const pageRaw = parseInt(get("page") || "1", 10);
  return {
    q: get("q").trim(),
    status: get("status").trim(),
    deadline: get("deadline").trim(),
    archived: get("archived") === "1" || get("archived") === "true",
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
    pageSize: SHIPMENT_PAGE_SIZE,
  };
}

export function buildShipmentsHref(
  filters: Partial<ShipmentListFilters> & Record<string, string | number | boolean | undefined>
) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", String(filters.q));
  if (filters.status) params.set("status", String(filters.status));
  if (filters.deadline) params.set("deadline", String(filters.deadline));
  if (filters.archived) params.set("archived", "1");
  if (filters.page && Number(filters.page) > 1) params.set("page", String(filters.page));
  const qs = params.toString();
  return qs ? `/admin/shipments?${qs}` : "/admin/shipments";
}

/** Filter default: sembunyikan arsip kecuali archived=true. */
export function notDeletedWhere(): Prisma.ShipmentWhereInput {
  return { deletedAt: null };
}

function baseWhere(filters: ShipmentListFilters): Prisma.ShipmentWhereInput {
  const where: Prisma.ShipmentWhereInput = filters.archived
    ? { deletedAt: { not: null } }
    : { deletedAt: null };

  if (filters.q) {
    where.OR = [
      { trackingNumber: { contains: filters.q } },
      { orderNumber: { contains: filters.q } },
      { customerName: { contains: filters.q } },
      { companyName: { contains: filters.q } },
      { phone: { contains: filters.q } },
      { externalOrderId: { contains: filters.q } },
    ];
  }

  if (filters.status) {
    where.status = filters.status as ShipmentStatus;
  }

  if (
    filters.deadline === "active" ||
    filters.deadline === "overdue" ||
    filters.deadline === "due_soon" ||
    filters.deadline === "on_track" ||
    filters.deadline === "no_deadline"
  ) {
    if (!filters.status) {
      where.status = { in: [...ACTIVE_SHIPMENT_STATUSES] };
    }
  }

  return where;
}

function matchesDeadline(
  row: {
    estimatedEndDate: Date | null;
    estimatedDays: number | null;
    createdAt: Date;
    status: string;
  },
  deadline: string,
  soonDays: number
) {
  if (!deadline || deadline === "active") return true;
  const { reminder } = reminderForShipment(row, soonDays);
  return reminder.kind === deadline;
}

export async function queryShipments(filters: ShipmentListFilters, soonDays = 2) {
  const cacheable =
    !filters.q &&
    !filters.status &&
    !filters.deadline &&
    !filters.archived &&
    filters.page === 1;

  if (cacheable) {
    const cached = await unstable_cache(
      () => queryShipmentsUncached(filters, soonDays),
      ["shipments-list-default", String(soonDays), String(filters.pageSize)],
      { revalidate: 30, tags: [SHIPMENTS_LIST_CACHE_TAG] }
    )();
    // unstable_cache JSON-serializes Date → string; restore Date instances.
    return reviveShipmentList(cached);
  }

  return queryShipmentsUncached(filters, soonDays);
}

type ShipmentListResult = Awaited<ReturnType<typeof queryShipmentsUncached>>;

function asDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  return value instanceof Date ? value : new Date(value);
}

function reviveShipmentList(result: ShipmentListResult): ShipmentListResult {
  return {
    ...result,
    rows: result.rows.map((row) => ({
      ...row,
      createdAt: asDate(row.createdAt) ?? new Date(row.createdAt as unknown as string),
      updatedAt: asDate(row.updatedAt) ?? new Date(row.updatedAt as unknown as string),
      estimatedEndDate: asDate(row.estimatedEndDate),
      deliveredAt: asDate(row.deliveredAt),
      deletedAt: asDate(row.deletedAt),
      endDate: asDate(row.endDate),
    })),
  };
}

async function queryShipmentsUncached(filters: ShipmentListFilters, soonDays = 2) {
  const where = baseWhere(filters);
  const needsInMemoryDeadline =
    filters.deadline === "overdue" ||
    filters.deadline === "due_soon" ||
    filters.deadline === "on_track" ||
    filters.deadline === "no_deadline";

  if (!needsInMemoryDeadline) {
    const [total, rows] = await Promise.all([
      prisma.shipment.count({ where }),
      prisma.shipment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
    ]);
    return {
      total,
      pageCount: Math.max(1, Math.ceil(total / filters.pageSize)),
      rows: rows.map((row) => {
        const { endDate, reminder } = reminderForShipment(row, soonDays);
        return { ...row, endDate, reminder };
      }),
    };
  }

  // Deadline kinds depend on resolveEndDate (estimatedDays fallback) → filter in memory lalu paginate
  const candidates = await prisma.shipment.findMany({
    where,
    orderBy: [{ estimatedEndDate: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      estimatedEndDate: true,
      estimatedDays: true,
      createdAt: true,
    },
  });

  const matchedIds = candidates
    .filter((c) => matchesDeadline(c, filters.deadline, soonDays))
    .map((c) => c.id);

  const total = matchedIds.length;
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));
  const pageIds = matchedIds.slice(
    (filters.page - 1) * filters.pageSize,
    filters.page * filters.pageSize
  );

  if (pageIds.length === 0) {
    return { total, pageCount, rows: [] };
  }

  const rows = await prisma.shipment.findMany({
    where: { id: { in: pageIds } },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = pageIds
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((row) => {
      const { endDate, reminder } = reminderForShipment(row, soonDays);
      return { ...row, endDate, reminder };
    });

  return { total, pageCount, rows: ordered };
}

export function deadlineLabel(deadline: string) {
  if (deadline === "overdue") return "Sudah telat";
  if (deadline === "due_soon") return "Due soon";
  if (deadline === "on_track") return "On track";
  if (deadline === "no_deadline") return "Tanpa target";
  if (deadline === "active") return "Aktif";
  return "";
}
