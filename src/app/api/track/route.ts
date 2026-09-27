import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SHIPMENT_STATUS_LABEL } from "@/lib/tracking";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim().toUpperCase();
  const phoneLast4 = searchParams.get("phoneLast4")?.trim();

  if (!code) {
    return NextResponse.json({ success: false, message: "Nomor tracking wajib diisi." }, { status: 400 });
  }

  const shipment = await prisma.shipment.findUnique({
    where: { trackingNumber: code },
    include: {
      progressTasks: {
        where: { parentId: null },
        orderBy: { sortOrder: "asc" },
        include: {
          children: {
            orderBy: { sortOrder: "asc" },
            include: { photos: { orderBy: { createdAt: "desc" } } },
          },
        },
      },
    },
  });

  if (!shipment) {
    return NextResponse.json({ success: false, message: "Nomor tracking tidak ditemukan." }, { status: 404 });
  }

  if (shipment.phoneLast4) {
    if (!phoneLast4 || phoneLast4 !== shipment.phoneLast4) {
      return NextResponse.json(
        {
          success: false,
          needsPhone: true,
          message: "Masukkan 4 digit terakhir nomor telepon penerima/pengirim.",
        },
        { status: 403 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      trackingNumber: shipment.trackingNumber,
      orderNumber: shipment.orderNumber,
      customerName: shipment.customerName,
      companyName: shipment.companyName,
      status: shipment.status,
      statusLabel: SHIPMENT_STATUS_LABEL[shipment.status] ?? shipment.status,
      progressPercent: Number(shipment.progressPercent),
      note: shipment.note,
      estimatedDays: shipment.estimatedDays,
      estimatedEndDate: shipment.estimatedEndDate,
      parents: shipment.progressTasks.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        weightPercent: Number(p.weightPercent),
        estimatedDays: p.estimatedDays,
        children: p.children.map((c) => ({
          id: c.id,
          title: c.title,
          status: c.status,
          weightPercent: Number(c.weightPercent),
          estimatedHours: c.estimatedHours,
          actualHours: c.actualHours,
          completedAt: c.completedAt,
          note: c.note,
          photos: c.photos.map((ph) => ({
            id: ph.id,
            url: ph.url,
            caption: ph.caption,
          })),
        })),
      })),
    },
  });
}
