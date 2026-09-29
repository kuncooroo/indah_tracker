import { ActivityAction, logActivity } from "@/lib/activity-log";
import {
  apiJson,
  apiUnauthorized,
  checkTrackerApiKey,
  toApiShipment,
} from "@/lib/api-v1";
import { prisma } from "@/lib/prisma";
import { applyWbsTemplateToShipment } from "@/lib/shipment-progress";
import { generateTrackingNumber, phoneLast4 } from "@/lib/tracking";
import { dispatchWebhook } from "@/lib/webhook";

/** GET /api/v1/shipments?externalOrderId= | ?trackingNumber= | ?id= */
export async function GET(request: Request) {
  if (!checkTrackerApiKey(request)) return apiUnauthorized();

  const { searchParams } = new URL(request.url);
  const externalOrderId = searchParams.get("externalOrderId")?.trim();
  const trackingNumber = searchParams.get("trackingNumber")?.trim()?.toUpperCase();
  const id = searchParams.get("id")?.trim();

  if (!externalOrderId && !trackingNumber && !id) {
    return apiJson(
      {
        success: false,
        message: "Wajib salah satu query: externalOrderId, trackingNumber, atau id.",
      },
      400
    );
  }

  const shipment = await prisma.shipment.findFirst({
    where: {
      deletedAt: null,
      ...(id ? { id } : {}),
      ...(externalOrderId ? { externalOrderId } : {}),
      ...(trackingNumber ? { trackingNumber } : {}),
    },
  });

  if (!shipment) {
    return apiJson({ success: false, message: "Shipment tidak ditemukan." }, 404);
  }

  return apiJson({ success: true, data: toApiShipment(shipment) });
}

/** POST — create / upsert by externalOrderId (idempotent). */
export async function POST(request: Request) {
  if (!checkTrackerApiKey(request)) return apiUnauthorized();

  try {
    const body = (await request.json()) as {
      orderNumber?: string;
      externalOrderId?: string;
      customerName?: string;
      companyName?: string;
      phone?: string;
      note?: string;
      applyTemplateId?: string;
      /** Jika true dan externalOrderId sudah ada → update field dasar, bukan buat baru */
      upsert?: boolean;
    };

    const externalOrderId = body.externalOrderId?.trim() || null;
    const phone = body.phone?.trim() || null;
    const orderNumber = body.orderNumber?.trim() || null;
    const customerName = body.customerName?.trim() || null;
    const companyName = body.companyName?.trim() || null;
    const note = body.note?.trim() || null;
    const applyTemplateId = body.applyTemplateId?.trim() || null;
    const upsert = body.upsert !== false; // default true untuk sync ERP

    if (externalOrderId) {
      const existing = await prisma.shipment.findFirst({
        where: { externalOrderId, deletedAt: null },
      });
      if (existing) {
        if (!upsert) {
          return apiJson(
            {
              success: false,
              message: "externalOrderId sudah terdaftar.",
              data: toApiShipment(existing),
            },
            409
          );
        }

        const updated = await prisma.shipment.update({
          where: { id: existing.id },
          data: {
            orderNumber: orderNumber ?? existing.orderNumber,
            customerName: customerName ?? existing.customerName,
            companyName: companyName ?? existing.companyName,
            phone: phone ?? existing.phone,
            phoneLast4: phone ? phoneLast4(phone) : existing.phoneLast4,
            note: note ?? existing.note,
          },
        });

        await logActivity({
          shipmentId: updated.id,
          action: ActivityAction.SHIPMENT_UPDATED,
          summary: `Sinkron dari API (externalOrderId=${externalOrderId})`,
          publicText: null,
          actor: { type: "api", name: "API / ERP" },
          after: {
            orderNumber: updated.orderNumber,
            customerName: updated.customerName,
            companyName: updated.companyName,
          },
        });

        if (applyTemplateId) {
          const taskCount = await prisma.progressTask.count({
            where: { shipmentId: updated.id },
          });
          if (taskCount === 0) {
            try {
              await applyWbsTemplateToShipment(updated.id, applyTemplateId);
            } catch (e) {
              const code = e instanceof Error ? e.message : "";
              if (code !== "TEMPLATE_NOT_FOUND" && code !== "TEMPLATE_EMPTY") throw e;
            }
          }
        }

        const fresh = await prisma.shipment.findUniqueOrThrow({ where: { id: updated.id } });
        return apiJson({
          success: true,
          upserted: true,
          data: toApiShipment(fresh),
        });
      }
    }

    let trackingNumber = generateTrackingNumber();
    for (let i = 0; i < 5; i++) {
      const exists = await prisma.shipment.findUnique({ where: { trackingNumber } });
      if (!exists) break;
      trackingNumber = generateTrackingNumber();
    }

    const shipment = await prisma.shipment.create({
      data: {
        trackingNumber,
        orderNumber,
        externalOrderId,
        customerName,
        companyName,
        phone,
        phoneLast4: phoneLast4(phone),
        note,
        status: "CREATED",
        progressPercent: 0,
      },
    });

    await logActivity({
      shipmentId: shipment.id,
      action: ActivityAction.SHIPMENT_CREATED,
      summary: `Tracking ${shipment.trackingNumber} dibuat via API`,
      publicText: "Pesanan tracking dibuat dan siap diproses",
      actor: { type: "api", name: "API / ERP" },
      after: {
        trackingNumber: shipment.trackingNumber,
        orderNumber: shipment.orderNumber,
        externalOrderId: shipment.externalOrderId,
      },
    });

    if (applyTemplateId) {
      try {
        await applyWbsTemplateToShipment(shipment.id, applyTemplateId);
      } catch (e) {
        const code = e instanceof Error ? e.message : "";
        if (
          code !== "TEMPLATE_NOT_FOUND" &&
          code !== "TEMPLATE_EMPTY" &&
          code !== "PROGRESS_ALREADY_EXISTS"
        ) {
          throw e;
        }
      }
    }

    const fresh = await prisma.shipment.findUniqueOrThrow({ where: { id: shipment.id } });
    void dispatchWebhook("shipment.created", fresh);

    return apiJson({
      success: true,
      upserted: false,
      data: toApiShipment(fresh),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal membuat tracking.";
    // Unique constraint race
    if (message.includes("Unique constraint") || message.includes("externalOrderId")) {
      return apiJson({ success: false, message: "externalOrderId bentrok / sudah ada." }, 409);
    }
    return apiJson({ success: false, message }, 500);
  }
}
