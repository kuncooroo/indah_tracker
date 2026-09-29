import { ActivityAction, logActivity, statusPublicLabel } from "@/lib/activity-log";
import {
  apiJson,
  apiUnauthorized,
  checkTrackerApiKey,
  isShipmentStatus,
  toApiShipment,
} from "@/lib/api-v1";
import { prisma } from "@/lib/prisma";
import { phoneLast4 } from "@/lib/tracking";
import { dispatchWebhook } from "@/lib/webhook";

type Ctx = { params: Promise<{ id: string }> };

async function findShipment(idOrExternal: string) {
  return prisma.shipment.findFirst({
    where: {
      deletedAt: null,
      OR: [{ id: idOrExternal }, { externalOrderId: idOrExternal }, { trackingNumber: idOrExternal }],
    },
  });
}

/** GET /api/v1/shipments/:id — id | trackingNumber | externalOrderId */
export async function GET(request: Request, ctx: Ctx) {
  if (!checkTrackerApiKey(request)) return apiUnauthorized();
  const { id } = await ctx.params;
  const shipment = await findShipment(id);
  if (!shipment) {
    return apiJson({ success: false, message: "Shipment tidak ditemukan." }, 404);
  }
  return apiJson({ success: true, data: toApiShipment(shipment) });
}

/**
 * PATCH /api/v1/shipments/:id
 * Update status / data dasar (sinkron ERP).
 */
export async function PATCH(request: Request, ctx: Ctx) {
  if (!checkTrackerApiKey(request)) return apiUnauthorized();
  const { id } = await ctx.params;

  try {
    const existing = await findShipment(id);
    if (!existing) {
      return apiJson({ success: false, message: "Shipment tidak ditemukan." }, 404);
    }

    const body = (await request.json()) as {
      status?: string;
      note?: string | null;
      orderNumber?: string | null;
      customerName?: string | null;
      companyName?: string | null;
      phone?: string | null;
      externalOrderId?: string | null;
    };

    const data: Record<string, unknown> = {};
    let statusChanged = false;
    let nextStatus = existing.status;

    if (body.status != null) {
      const s = String(body.status).trim().toUpperCase();
      if (!isShipmentStatus(s)) {
        return apiJson({ success: false, message: `Status tidak valid: ${body.status}` }, 400);
      }
      if (s !== existing.status) {
        data.status = s;
        nextStatus = s;
        statusChanged = true;
        data.deliveredAt = s === "DELIVERED" ? new Date() : null;
      }
    }

    if (body.note !== undefined) data.note = body.note?.trim() || null;
    if (body.orderNumber !== undefined) data.orderNumber = body.orderNumber?.trim() || null;
    if (body.customerName !== undefined) data.customerName = body.customerName?.trim() || null;
    if (body.companyName !== undefined) data.companyName = body.companyName?.trim() || null;
    if (body.phone !== undefined) {
      const phone = body.phone?.trim() || null;
      data.phone = phone;
      data.phoneLast4 = phoneLast4(phone);
    }
    if (body.externalOrderId !== undefined) {
      const ext = body.externalOrderId?.trim() || null;
      if (ext && ext !== existing.externalOrderId) {
        const clash = await prisma.shipment.findFirst({
          where: { externalOrderId: ext, NOT: { id: existing.id }, deletedAt: null },
        });
        if (clash) {
          return apiJson({ success: false, message: "externalOrderId sudah dipakai shipment lain." }, 409);
        }
      }
      data.externalOrderId = ext;
    }

    if (Object.keys(data).length === 0) {
      return apiJson({ success: true, data: toApiShipment(existing), unchanged: true });
    }

    const updated = await prisma.shipment.update({
      where: { id: existing.id },
      data,
    });

    if (statusChanged) {
      await logActivity({
        shipmentId: updated.id,
        action: ActivityAction.STATUS_CHANGED,
        summary: `Status (API): ${statusPublicLabel(existing.status)} → ${statusPublicLabel(nextStatus)}`,
        publicText: `Status diperbarui menjadi ${statusPublicLabel(nextStatus)}`,
        actor: { type: "api", name: "API / ERP" },
        before: { status: existing.status },
        after: { status: nextStatus },
      });
      void dispatchWebhook("shipment.status_changed", updated);
    } else {
      await logActivity({
        shipmentId: updated.id,
        action: ActivityAction.SHIPMENT_UPDATED,
        summary: "Data shipment diperbarui via API",
        publicText: null,
        actor: { type: "api", name: "API / ERP" },
        after: data,
      });
    }

    return apiJson({ success: true, data: toApiShipment(updated) });
  } catch (e) {
    return apiJson(
      { success: false, message: e instanceof Error ? e.message : "Gagal memperbarui." },
      500
    );
  }
}
