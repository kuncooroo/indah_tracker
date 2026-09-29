import type { Shipment, ShipmentStatus } from "@prisma/client";
import { getAppUrl } from "@/lib/env";
import { buildTrackUrl } from "@/lib/shipment-links";
import { SHIPMENT_STATUS_LABEL } from "@/lib/tracking";

export const SHIPMENT_STATUSES: ShipmentStatus[] = [
  "CREATED",
  "IN_PROGRESS",
  "QUALITY_CHECK",
  "READY_TO_SHIP",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED",
];

export function isShipmentStatus(value: string): value is ShipmentStatus {
  return (SHIPMENT_STATUSES as string[]).includes(value);
}

export function toApiShipment(
  row: Pick<
    Shipment,
    | "id"
    | "trackingNumber"
    | "externalOrderId"
    | "orderNumber"
    | "customerName"
    | "companyName"
    | "phone"
    | "phoneLast4"
    | "status"
    | "progressPercent"
    | "note"
    | "estimatedDays"
    | "estimatedEndDate"
    | "deliveredAt"
    | "createdAt"
    | "updatedAt"
    | "deletedAt"
  >
) {
  const base = getAppUrl();
  return {
    id: row.id,
    trackingNumber: row.trackingNumber,
    externalOrderId: row.externalOrderId,
    orderNumber: row.orderNumber,
    customerName: row.customerName,
    companyName: row.companyName,
    phone: row.phone,
    phoneLast4: row.phoneLast4,
    status: row.status,
    statusLabel: SHIPMENT_STATUS_LABEL[row.status] ?? row.status,
    progressPercent: Number(row.progressPercent),
    note: row.note,
    estimatedDays: row.estimatedDays,
    estimatedEndDate: row.estimatedEndDate?.toISOString() ?? null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archived: Boolean(row.deletedAt),
    trackUrl: buildTrackUrl(row.trackingNumber, row.phoneLast4),
    progressUrl: `${base}/admin/shipments/${row.id}/progress`,
    workshopUrl: `${base}/admin/workshop/${row.id}`,
  };
}

export function checkTrackerApiKey(request: Request) {
  const key = process.env.TRACKER_API_KEY?.trim();
  if (!key) return false;
  const xApiKey = request.headers.get("x-api-key")?.trim();
  if (xApiKey && xApiKey === key) return true;
  const auth = request.headers.get("authorization")?.trim();
  if (!auth) return false;
  if (auth === key) return true;
  if (auth.toLowerCase().startsWith("bearer ") && auth.slice(7).trim() === key) return true;
  return false;
}

export function apiUnauthorized() {
  return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

export function apiJson(data: unknown, status = 200) {
  return Response.json(data, { status });
}
