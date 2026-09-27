"use server";

import { revalidatePath } from "next/cache";
import type { ProgressTaskStatus } from "@prisma/client";
import { fail, ok, runAdminAction, type ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  applyWbsTemplateToShipment,
  clampHours,
  MAX_SUB_HOURS,
  recalculateShipmentProgress,
} from "@/lib/shipment-progress";

function revalidateShipmentProgress(shipmentId: string) {
  revalidatePath("/admin/shipments");
  revalidatePath(`/admin/shipments/${shipmentId}`);
  revalidatePath(`/admin/shipments/${shipmentId}/progress`);
  revalidatePath("/admin/wbs-templates");
  revalidatePath("/admin/dashboard");
  revalidatePath("/track");
}

function requireTrimmed(
  raw: FormDataEntryValue | null,
  field: string,
  label: string,
  opts: { min?: number; max?: number } = {}
): { ok: true; value: string } | { ok: false; result: ActionResult } {
  const value = String(raw ?? "").trim();
  if (!value) return { ok: false, result: fail(`${label} wajib diisi.`, { fieldErrors: { [field]: "Wajib" } }) };
  if (opts.min && value.length < opts.min) {
    return { ok: false, result: fail(`${label} minimal ${opts.min} karakter.`) };
  }
  if (opts.max && value.length > opts.max) {
    return { ok: false, result: fail(`${label} maksimal ${opts.max} karakter.`) };
  }
  return { ok: true, value };
}

// ——— WBS Templates ———

export async function createWbsTemplate(formData: FormData): Promise<ActionResult> {
  return runAdminAction(async () => {
    await requireAdmin();
    const name = requireTrimmed(formData.get("name"), "name", "Nama template", { min: 2, max: 120 });
    if (!name.ok) return name.result;
    const days = parseInt(String(formData.get("estimatedDays") ?? "30"), 10);
    const estimatedDays = Number.isFinite(days) && days > 0 ? days : 30;
    await prisma.wbsTemplate.create({
      data: {
        name: name.value,
        description: String(formData.get("description") ?? "").trim() || null,
        estimatedDays,
        active: formData.get("active") === "on" || formData.get("active") === "true",
      },
    });
    revalidatePath("/admin/wbs-templates");
    return ok("Template WBS dibuat.");
  }, "Template WBS dibuat.");
}

export async function updateWbsTemplate(formData: FormData): Promise<ActionResult> {
  return runAdminAction(async () => {
    await requireAdmin();
    const id = String(formData.get("id") ?? "");
    if (!id) return fail("ID tidak valid.");
    const name = requireTrimmed(formData.get("name"), "name", "Nama template", { min: 2, max: 120 });
    if (!name.ok) return name.result;
    const days = parseInt(String(formData.get("estimatedDays") ?? "30"), 10);
    await prisma.wbsTemplate.update({
      where: { id },
      data: {
        name: name.value,
        description: String(formData.get("description") ?? "").trim() || null,
        estimatedDays: Number.isFinite(days) && days > 0 ? days : 30,
        active: formData.get("active") === "on" || formData.get("active") === "true",
      },
    });
    revalidatePath("/admin/wbs-templates");
    revalidatePath(`/admin/wbs-templates/${id}`);
    return ok("Template diperbarui.");
  }, "Template diperbarui.");
}

export async function deleteWbsTemplate(id: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    await requireAdmin();
    await prisma.wbsTemplate.delete({ where: { id } });
    revalidatePath("/admin/wbs-templates");
    return ok("Template dihapus.");
  }, "Template dihapus.");
}

export async function createWbsTemplateItem(formData: FormData): Promise<ActionResult> {
  return runAdminAction(async () => {
    await requireAdmin();
    const templateId = String(formData.get("templateId") ?? "");
    if (!templateId) return fail("Template tidak valid.");
    const title = requireTrimmed(formData.get("title"), "title", "Judul", { min: 2, max: 200 });
    if (!title.ok) return title.result;
    const parentId = String(formData.get("parentId") ?? "").trim() || null;
    const sortRaw = parseInt(String(formData.get("sortOrder") ?? "0"), 10);
    let estimatedHours: number | null = null;
    if (parentId) {
      const hours = parseInt(String(formData.get("estimatedHours") ?? "8"), 10);
      estimatedHours = clampHours(Number.isFinite(hours) ? hours : 8);
    }
    if (parentId) {
      const parent = await prisma.wbsTemplateItem.findFirst({
        where: { id: parentId, templateId, parentId: null },
      });
      if (!parent) return fail("Parent tidak ditemukan.");
    }
    await prisma.wbsTemplateItem.create({
      data: {
        templateId,
        parentId,
        title: title.value,
        sortOrder: Number.isFinite(sortRaw) ? sortRaw : 0,
        estimatedHours,
      },
    });
    revalidatePath(`/admin/wbs-templates/${templateId}`);
    return ok(parentId ? "Sub-tugas ditambahkan." : "Fase parent ditambahkan.");
  }, "Item ditambahkan.");
}

export async function updateWbsTemplateItem(formData: FormData): Promise<ActionResult> {
  return runAdminAction(async () => {
    await requireAdmin();
    const id = String(formData.get("id") ?? "");
    if (!id) return fail("ID tidak valid.");
    const title = requireTrimmed(formData.get("title"), "title", "Judul", { min: 2, max: 200 });
    if (!title.ok) return title.result;
    const existing = await prisma.wbsTemplateItem.findUnique({ where: { id } });
    if (!existing) return fail("Item tidak ditemukan.");
    const sortRaw = parseInt(String(formData.get("sortOrder") ?? String(existing.sortOrder)), 10);
    let estimatedHours = existing.estimatedHours;
    if (existing.parentId) {
      const hours = parseInt(String(formData.get("estimatedHours") ?? "8"), 10);
      estimatedHours = clampHours(Number.isFinite(hours) ? hours : 8);
    } else {
      estimatedHours = null;
    }
    await prisma.wbsTemplateItem.update({
      where: { id },
      data: {
        title: title.value,
        sortOrder: Number.isFinite(sortRaw) ? sortRaw : existing.sortOrder,
        estimatedHours,
      },
    });
    revalidatePath(`/admin/wbs-templates/${existing.templateId}`);
    return ok("Item diperbarui.");
  }, "Item diperbarui.");
}

export async function deleteWbsTemplateItem(id: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    await requireAdmin();
    const existing = await prisma.wbsTemplateItem.findUnique({ where: { id } });
    if (!existing) return fail("Item tidak ditemukan.");
    await prisma.wbsTemplateItem.delete({ where: { id } });
    revalidatePath(`/admin/wbs-templates/${existing.templateId}`);
    return ok("Item dihapus.");
  }, "Item dihapus.");
}

// ——— Shipment progress ———

export async function applyTemplateToShipment(formData: FormData): Promise<ActionResult> {
  return runAdminAction(async () => {
    await requireAdmin();
    const shipmentId = String(formData.get("shipmentId") ?? formData.get("orderId") ?? "");
    const templateId = String(formData.get("templateId") ?? "");
    if (!shipmentId || !templateId) return fail("Shipment atau template tidak valid.");
    try {
      await applyWbsTemplateToShipment(shipmentId, templateId);
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (code === "PROGRESS_ALREADY_EXISTS") {
        return fail("Shipment ini sudah punya progress. Reset dulu jika ingin apply ulang.");
      }
      if (code === "TEMPLATE_EMPTY") return fail("Template belum punya item.");
      if (code === "TEMPLATE_NOT_FOUND") return fail("Template tidak ditemukan.");
      if (code === "SHIPMENT_NOT_FOUND") return fail("Shipment tidak ditemukan.");
      throw e;
    }
    revalidateShipmentProgress(shipmentId);
    return ok("Template WBS diterapkan.");
  }, "Template diterapkan.");
}

export async function updateProgressTask(formData: FormData): Promise<ActionResult> {
  return runAdminAction(async () => {
    await requireAdmin();
    const id = String(formData.get("id") ?? "");
    if (!id) return fail("ID tidak valid.");

    const task = await prisma.progressTask.findUnique({
      where: { id },
      include: {
        parent: { select: { title: true } },
        children: { select: { id: true } },
        shipment: { select: { id: true, trackingNumber: true } },
      },
    });
    if (!task) return fail("Task tidak ditemukan.");

    const isParentWithChildren = !task.parentId && task.children.length > 0;
    const statusRaw = String(formData.get("status") ?? task.status) as ProgressTaskStatus;
    const allowed: ProgressTaskStatus[] = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"];
    const status = allowed.includes(statusRaw) ? statusRaw : task.status;

    let actualHours: number | null = task.actualHours;
    if (task.parentId) {
      const hours = parseInt(String(formData.get("actualHours") ?? ""), 10);
      if (Number.isFinite(hours)) actualHours = clampHours(hours);
      if (status === "COMPLETED" && (actualHours == null || actualHours <= 0)) {
        return fail(`Isi jam kerja aktual (1–${MAX_SUB_HOURS} jam) saat menyelesaikan sub-tugas.`);
      }
    }

    const photoUrl = String(formData.get("photoUrl") ?? "").trim();
    const photoCaption = String(formData.get("photoCaption") ?? "").trim() || null;
    const note = String(formData.get("note") ?? "").trim() || null;

    if (isParentWithChildren && status !== task.status) {
      return fail("Status fase parent mengikuti sub-tugas. Update sub-tugas saja.");
    }

    await prisma.progressTask.update({
      where: { id },
      data: {
        status: isParentWithChildren ? task.status : status,
        actualHours: task.parentId ? actualHours : null,
        note,
        startedAt:
          status === "IN_PROGRESS" || status === "COMPLETED"
            ? task.startedAt ?? new Date()
            : null,
        completedAt: status === "COMPLETED" ? new Date() : null,
      },
    });

    if (photoUrl && (task.parentId || !isParentWithChildren)) {
      await prisma.progressPhoto.create({
        data: { taskId: id, url: photoUrl, caption: photoCaption },
      });
    }

    await recalculateShipmentProgress(task.shipmentId);
    revalidateShipmentProgress(task.shipmentId);
    return ok("Progress diperbarui.");
  }, "Progress diperbarui.");
}

export async function deleteProgressPhoto(id: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    await requireAdmin();
    const photo = await prisma.progressPhoto.findUnique({
      where: { id },
      include: { task: { select: { shipmentId: true } } },
    });
    if (!photo) return fail("Foto tidak ditemukan.");
    await prisma.progressPhoto.delete({ where: { id } });
    revalidateShipmentProgress(photo.task.shipmentId);
    return ok("Foto dihapus.");
  }, "Foto dihapus.");
}

export async function clearShipmentProgress(shipmentId: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    await requireAdmin();
    await prisma.progressTask.deleteMany({ where: { shipmentId } });
    await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        progressPercent: 0,
        wbsTemplateId: null,
        estimatedDays: null,
        estimatedEndDate: null,
        status: "CREATED",
        deliveredAt: null,
      },
    });
    revalidateShipmentProgress(shipmentId);
    return ok("Progress dihapus.");
  }, "Progress dihapus.");
}
