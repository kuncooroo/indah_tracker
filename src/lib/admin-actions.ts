"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ShipmentStatus } from "@prisma/client";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateTrackingNumber, phoneLast4 } from "@/lib/tracking";

export async function createShipment(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const orderNumber = String(formData.get("orderNumber") ?? "").trim() || null;
    const customerName = String(formData.get("customerName") ?? "").trim() || null;
    const companyName = String(formData.get("companyName") ?? "").trim() || null;
    const phone = String(formData.get("phone") ?? "").trim() || null;
    const note = String(formData.get("note") ?? "").trim() || null;
    const externalOrderId = String(formData.get("externalOrderId") ?? "").trim() || null;

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
        customerName,
        companyName,
        phone,
        phoneLast4: phoneLast4(phone),
        externalOrderId,
        note,
        status: "CREATED",
        progressPercent: 0,
      },
    });

    revalidatePath("/admin/shipments");
    revalidatePath("/admin/dashboard");
    return ok("Tracking berhasil dibuat.", {
      trackingNumber: shipment.trackingNumber,
      id: shipment.id,
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Gagal membuat tracking.");
  }
}

export async function updateShipment(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const id = String(formData.get("id") ?? "");
    if (!id) return fail("ID tidak valid.");

    const status = String(formData.get("status") ?? "CREATED") as ShipmentStatus;
    const customerName = String(formData.get("customerName") ?? "").trim() || null;
    const companyName = String(formData.get("companyName") ?? "").trim() || null;
    const phone = String(formData.get("phone") ?? "").trim() || null;
    const note = String(formData.get("note") ?? "").trim() || null;
    const orderNumber = String(formData.get("orderNumber") ?? "").trim() || null;

    await prisma.shipment.update({
      where: { id },
      data: {
        status,
        customerName,
        companyName,
        phone,
        phoneLast4: phoneLast4(phone),
        note,
        orderNumber,
        deliveredAt: status === "DELIVERED" ? new Date() : null,
      },
    });

    revalidatePath(`/admin/shipments/${id}`);
    revalidatePath("/admin/shipments");
    return ok("Shipment diperbarui.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Gagal memperbarui.");
  }
}

export async function deleteShipment(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await prisma.shipment.delete({ where: { id } });
    revalidatePath("/admin/shipments");
    revalidatePath("/admin/dashboard");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Gagal menghapus.");
  }
  redirect("/admin/shipments");
}

export async function createShipmentAndRedirect(formData: FormData): Promise<void> {
  const result = await createShipment(formData);
  if (result.success && result.id) {
    redirect(`/admin/shipments/${result.id}/progress`);
  }
  redirect("/admin/shipments/new?error=1");
}
