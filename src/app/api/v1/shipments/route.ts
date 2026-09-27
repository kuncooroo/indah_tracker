import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateTrackingNumber, phoneLast4 } from "@/lib/tracking";

function unauthorized() {
  return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

function checkApiKey(request: Request) {
  const key = process.env.TRACKER_API_KEY;
  if (!key) return false;
  const header = request.headers.get("x-api-key") ?? request.headers.get("authorization");
  if (!header) return false;
  if (header === key) return true;
  if (header.startsWith("Bearer ") && header.slice(7) === key) return true;
  return false;
}

/** Dipanggil dari katalog PWA untuk generate tracking number */
export async function POST(request: Request) {
  if (!checkApiKey(request)) return unauthorized();

  try {
    const body = (await request.json()) as {
      orderNumber?: string;
      externalOrderId?: string;
      customerName?: string;
      companyName?: string;
      phone?: string;
      note?: string;
      applyTemplateId?: string;
    };

    let trackingNumber = generateTrackingNumber();
    for (let i = 0; i < 5; i++) {
      const exists = await prisma.shipment.findUnique({ where: { trackingNumber } });
      if (!exists) break;
      trackingNumber = generateTrackingNumber();
    }

    const phone = body.phone?.trim() || null;
    const shipment = await prisma.shipment.create({
      data: {
        trackingNumber,
        orderNumber: body.orderNumber?.trim() || null,
        externalOrderId: body.externalOrderId?.trim() || null,
        customerName: body.customerName?.trim() || null,
        companyName: body.companyName?.trim() || null,
        phone,
        phoneLast4: phoneLast4(phone),
        note: body.note?.trim() || null,
        status: "CREATED",
        progressPercent: 0,
      },
    });

    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
    return NextResponse.json({
      success: true,
      data: {
        id: shipment.id,
        trackingNumber: shipment.trackingNumber,
        trackUrl: `${base}/track?code=${encodeURIComponent(shipment.trackingNumber)}`,
        progressUrl: `${base}/admin/shipments/${shipment.id}/progress`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : "Gagal membuat tracking." },
      { status: 500 }
    );
  }
}
