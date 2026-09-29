"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { ShipmentStatus } from "@prisma/client";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import {
  ActivityAction,
  actorFromSession,
  logActivity,
  statusPublicLabel,
} from "@/lib/activity-log";
import { getAdminSession, requireAdmin, requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateTrackingNumber, phoneLast4 } from "@/lib/tracking";
import { SHIPMENTS_LIST_CACHE_TAG } from "@/lib/shipment-query";

function bustShipmentListCache() {
  revalidatePath("/admin/shipments");
  revalidateTag(SHIPMENTS_LIST_CACHE_TAG, "max");
}

export async function createShipment(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
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

    await logActivity({
      shipmentId: shipment.id,
      action: ActivityAction.SHIPMENT_CREATED,
      summary: `Tracking ${shipment.trackingNumber} dibuat`,
      publicText: "Pesanan tracking dibuat dan siap diproses",
      actor: actorFromSession(session),
      after: {
        trackingNumber: shipment.trackingNumber,
        orderNumber,
        customerName,
        companyName,
        status: shipment.status,
      },
    });

    bustShipmentListCache();
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
    const session = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    if (!id) return fail("ID tidak valid.");

    const existing = await prisma.shipment.findUnique({ where: { id } });
    if (!existing) return fail("Shipment tidak ditemukan.");
    if (existing.deletedAt) return fail("Shipment diarsipkan — pulihkan dulu untuk mengedit.");

    const status = String(formData.get("status") ?? "CREATED") as ShipmentStatus;
    const customerName = String(formData.get("customerName") ?? "").trim() || null;
    const companyName = String(formData.get("companyName") ?? "").trim() || null;
    const phone = String(formData.get("phone") ?? "").trim() || null;
    const note = String(formData.get("note") ?? "").trim() || null;
    const orderNumber = String(formData.get("orderNumber") ?? "").trim() || null;
    const externalOrderId = String(formData.get("externalOrderId") ?? "").trim() || null;

    if (externalOrderId && externalOrderId !== existing.externalOrderId) {
      const clash = await prisma.shipment.findFirst({
        where: {
          externalOrderId,
          deletedAt: null,
          NOT: { id },
        },
      });
      if (clash) return fail("externalOrderId sudah dipakai shipment lain.");
    }

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
        externalOrderId,
        deliveredAt: status === "DELIVERED" ? new Date() : null,
      },
    });

    const actor = actorFromSession(session);
    const beforeSnap = {
      status: existing.status,
      customerName: existing.customerName,
      companyName: existing.companyName,
      phone: existing.phone,
      orderNumber: existing.orderNumber,
      note: existing.note,
    };
    const afterSnap = {
      status,
      customerName,
      companyName,
      phone,
      orderNumber,
      note,
    };

    if (existing.status !== status) {
      await logActivity({
        shipmentId: id,
        action: ActivityAction.STATUS_CHANGED,
        summary: `Status: ${statusPublicLabel(existing.status)} → ${statusPublicLabel(status)}`,
        publicText: `Status diperbarui menjadi ${statusPublicLabel(status)}`,
        actor,
        before: { status: existing.status },
        after: { status },
      });
      const fresh = await prisma.shipment.findUnique({ where: { id } });
      if (fresh) {
        const { dispatchWebhook } = await import("@/lib/webhook");
        void dispatchWebhook("shipment.status_changed", fresh);
      }
    }

    const otherChanged =
      existing.customerName !== customerName ||
      existing.companyName !== companyName ||
      existing.phone !== phone ||
      existing.orderNumber !== orderNumber ||
      existing.note !== note;

    if (otherChanged) {
      await logActivity({
        shipmentId: id,
        action: ActivityAction.SHIPMENT_UPDATED,
        summary: "Data shipment diperbarui",
        publicText: null, // internal-ish field edits — jangan tampil publik
        actor,
        before: beforeSnap,
        after: afterSnap,
      });
    }

    revalidatePath(`/admin/shipments/${id}`);
    bustShipmentListCache();
    return ok("Shipment diperbarui.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Gagal memperbarui.");
  }
}

export async function deleteShipment(id: string): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    const existing = await prisma.shipment.findUnique({
      where: { id },
      select: { id: true, trackingNumber: true, deletedAt: true },
    });
    if (!existing) return fail("Shipment tidak ditemukan.");
    if (existing.deletedAt) return fail("Shipment sudah diarsipkan.");

    await prisma.shipment.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: session.user?.id ?? null,
      },
    });

    await logActivity({
      shipmentId: id,
      action: ActivityAction.SHIPMENT_UPDATED,
      summary: `Shipment diarsipkan (${existing.trackingNumber})`,
      publicText: null,
      actor: actorFromSession(session),
      after: { deletedAt: true },
    });

    bustShipmentListCache();
    revalidatePath("/admin/dashboard");
    revalidatePath(`/admin/shipments/${id}`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Gagal mengarsipkan.");
  }
  redirect("/admin/shipments");
}

/** Pulihkan shipment dari arsip. */
export async function restoreShipment(id: string): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    const existing = await prisma.shipment.findUnique({
      where: { id },
      select: { id: true, trackingNumber: true, deletedAt: true },
    });
    if (!existing) return fail("Shipment tidak ditemukan.");
    if (!existing.deletedAt) return fail("Shipment tidak dalam arsip.");

    await prisma.shipment.update({
      where: { id },
      data: { deletedAt: null, deletedBy: null },
    });

    await logActivity({
      shipmentId: id,
      action: ActivityAction.SHIPMENT_UPDATED,
      summary: `Shipment dipulihkan dari arsip (${existing.trackingNumber})`,
      publicText: null,
      actor: actorFromSession(session),
      after: { deletedAt: false },
    });

    bustShipmentListCache();
    revalidatePath("/admin/dashboard");
    revalidatePath(`/admin/shipments/${id}`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Gagal memulihkan.");
  }
  redirect(`/admin/shipments/${id}`);
}

/** Hapus permanen — SUPERADMIN saja. */
export async function purgeShipment(id: string): Promise<ActionResult> {
  try {
    await requireSuperAdmin();
    const existing = await prisma.shipment.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });
    if (!existing) return fail("Shipment tidak ditemukan.");
    if (!existing.deletedAt) {
      return fail("Arsipkan dulu sebelum hapus permanen.");
    }
    await prisma.shipment.delete({ where: { id } });
    bustShipmentListCache();
    revalidatePath("/admin/dashboard");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal menghapus permanen.";
    if (msg === "Forbidden" || msg === "Unauthorized") {
      return fail("Hanya SUPERADMIN yang boleh hapus permanen.");
    }
    return fail(msg);
  }
  redirect("/admin/shipments?archived=1");
}

export async function createShipmentAndRedirect(formData: FormData): Promise<void> {
  const result = await createShipment(formData);
  if (result.success && result.id) {
    redirect(`/admin/shipments/${result.id}/progress`);
  }
  redirect("/admin/shipments/new?error=1");
}

/** Digunakan jika session diperlukan di luar requireAdmin throw path */
export async function getOptionalAdminActor() {
  const session = await getAdminSession();
  return actorFromSession(session);
}
