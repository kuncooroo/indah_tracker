"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import type { ProgressTaskStatus } from "@prisma/client";
import { fail, ok, runAdminAction, type ActionResult } from "@/lib/action-result";
import {
  ActivityAction,
  actorFromSession,
  logActivity,
  statusPublicLabel,
} from "@/lib/activity-log";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  applyWbsTemplateToShipment,
  clampHours,
  MAX_SUB_HOURS,
  recalculateShipmentProgress,
  rebalanceShipmentWeights,
  suggestShipmentStatusFromProgress,
  validateParentWeights,
} from "@/lib/shipment-progress";
import { SHIPMENT_STATUS_LABEL } from "@/lib/tracking";
import { SHIPMENTS_LIST_CACHE_TAG } from "@/lib/shipment-query";

function revalidateShipmentProgress(shipmentId: string) {
  revalidatePath("/admin/shipments");
  revalidateTag(SHIPMENTS_LIST_CACHE_TAG, "max");
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
    await requireSuperAdmin();
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
    const session = await requireAdmin();
    const shipmentId = String(formData.get("shipmentId") ?? formData.get("orderId") ?? "");
    const templateId = String(formData.get("templateId") ?? "");
    if (!shipmentId || !templateId) return fail("Shipment atau template tidak valid.");

    const template = await prisma.wbsTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, name: true, estimatedDays: true },
    });

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

    await logActivity({
      shipmentId,
      action: ActivityAction.TEMPLATE_APPLIED,
      summary: `Template WBS diterapkan: ${template?.name ?? templateId}`,
      publicText: "Rencana tahapan pengerjaan diterapkan",
      actor: actorFromSession(session),
      after: {
        templateId,
        templateName: template?.name ?? null,
        estimatedDays: template?.estimatedDays ?? null,
      },
    });

    revalidateShipmentProgress(shipmentId);
    return ok("Template WBS diterapkan.");
  }, "Template diterapkan.");
}

export async function updateProgressTask(formData: FormData): Promise<ActionResult> {
  return runAdminAction(async () => {
    const session = await requireAdmin();
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

    const nextStatus = isParentWithChildren ? task.status : status;

    await prisma.progressTask.update({
      where: { id },
      data: {
        status: nextStatus,
        actualHours: task.parentId ? actualHours : null,
        note,
        startedAt:
          nextStatus === "IN_PROGRESS" || nextStatus === "COMPLETED"
            ? task.startedAt ?? new Date()
            : null,
        completedAt: nextStatus === "COMPLETED" ? new Date() : null,
      },
    });

    let photoId: string | null = null;
    if (photoUrl && (task.parentId || !isParentWithChildren)) {
      const photo = await prisma.progressPhoto.create({
        data: { taskId: id, url: photoUrl, caption: photoCaption },
      });
      photoId = photo.id;
    }

    await recalculateShipmentProgress(task.shipmentId);

    const actor = actorFromSession(session);
    const statusChanged = task.status !== nextStatus;
    const hoursChanged = task.actualHours !== actualHours;
    const noteChanged = (task.note ?? null) !== note;

    if (statusChanged || hoursChanged || noteChanged) {
      const publicText =
        nextStatus === "COMPLETED"
          ? `Tahap "${task.title}" selesai`
          : nextStatus === "IN_PROGRESS"
            ? `Tahap "${task.title}" sedang dikerjakan`
            : `Tahap "${task.title}" diperbarui`;

      await logActivity({
        shipmentId: task.shipmentId,
        action: ActivityAction.TASK_UPDATED,
        summary: `Task "${task.title}": ${task.status} → ${nextStatus}`,
        publicText,
        actor,
        before: {
          status: task.status,
          actualHours: task.actualHours,
          note: task.note,
        },
        after: {
          status: nextStatus,
          actualHours: task.parentId ? actualHours : null,
          note,
        },
        meta: { taskId: task.id, parentTitle: task.parent?.title ?? null },
      });
    }

    if (photoId) {
      await logActivity({
        shipmentId: task.shipmentId,
        action: ActivityAction.PHOTO_UPLOADED,
        summary: `Foto ditambahkan pada "${task.title}"`,
        publicText: `Dokumentasi foto ditambahkan untuk tahap "${task.title}"`,
        actor,
        after: { photoId, caption: photoCaption, taskId: task.id },
      });
    }

    revalidateShipmentProgress(task.shipmentId);
    return ok("Progress diperbarui.");
  }, "Progress diperbarui.");
}

export async function deleteProgressPhoto(id: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    const session = await requireAdmin();
    const photo = await prisma.progressPhoto.findUnique({
      where: { id },
      include: {
        task: { select: { shipmentId: true, title: true, id: true } },
      },
    });
    if (!photo) return fail("Foto tidak ditemukan.");
    await prisma.progressPhoto.delete({ where: { id } });

    await logActivity({
      shipmentId: photo.task.shipmentId,
      action: ActivityAction.PHOTO_DELETED,
      summary: `Foto dihapus dari "${photo.task.title}"`,
      publicText: null, // hapus foto = internal
      actor: actorFromSession(session),
      before: { photoId: photo.id, caption: photo.caption, taskId: photo.task.id },
    });

    revalidateShipmentProgress(photo.task.shipmentId);
    return ok("Foto dihapus.");
  }, "Foto dihapus.");
}

export async function clearShipmentProgress(shipmentId: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    const session = await requireAdmin();
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

    await logActivity({
      shipmentId,
      action: ActivityAction.PROGRESS_CLEARED,
      summary: "Progress WBS di-reset",
      publicText: null,
      actor: actorFromSession(session),
    });

    revalidateShipmentProgress(shipmentId);
    return ok("Progress dihapus.");
  }, "Progress dihapus.");
}

export async function createManualProgressParent(formData: FormData): Promise<ActionResult> {
  return runAdminAction(async () => {
    const session = await requireAdmin();
    const shipmentId = String(formData.get("shipmentId") ?? "");
    if (!shipmentId) return fail("Shipment tidak valid.");
    const title = requireTrimmed(formData.get("title"), "title", "Judul fase", { min: 2, max: 200 });
    if (!title.ok) return title.result;

    const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) return fail("Shipment tidak ditemukan.");

    const sortRaw = parseInt(String(formData.get("sortOrder") ?? "0"), 10);
    const maxSort = await prisma.progressTask.aggregate({
      where: { shipmentId, parentId: null },
      _max: { sortOrder: true },
    });
    const sortOrder = Number.isFinite(sortRaw) && String(formData.get("sortOrder") ?? "").trim() !== ""
      ? sortRaw
      : (maxSort._max.sortOrder ?? -1) + 1;

    const created = await prisma.progressTask.create({
      data: {
        shipmentId,
        title: title.value,
        sortOrder,
        weightPercent: 0,
        status: "NOT_STARTED",
      },
    });

    await rebalanceShipmentWeights(shipmentId);
    await recalculateShipmentProgress(shipmentId);

    if (shipment.status === "CREATED") {
      await prisma.shipment.update({
        where: { id: shipmentId },
        data: { status: "IN_PROGRESS" },
      });
      await logActivity({
        shipmentId,
        action: ActivityAction.STATUS_CHANGED,
        summary: "Status: Dibuat → Dalam proses",
        publicText: "Status diperbarui menjadi Dalam proses",
        actor: actorFromSession(session),
        before: { status: "CREATED" },
        after: { status: "IN_PROGRESS" },
      });
    }

    await logActivity({
      shipmentId,
      action: ActivityAction.TASK_CREATED,
      summary: `Fase ditambahkan: ${title.value}`,
      publicText: `Tahap baru ditambahkan: ${title.value}`,
      actor: actorFromSession(session),
      after: { taskId: created.id, title: title.value, kind: "parent" },
    });

    revalidateShipmentProgress(shipmentId);
    return ok("Fase ditambahkan.");
  }, "Fase ditambahkan.");
}

export async function createManualProgressChild(formData: FormData): Promise<ActionResult> {
  return runAdminAction(async () => {
    const session = await requireAdmin();
    const shipmentId = String(formData.get("shipmentId") ?? "");
    const parentId = String(formData.get("parentId") ?? "");
    if (!shipmentId || !parentId) return fail("Shipment atau fase tidak valid.");
    const title = requireTrimmed(formData.get("title"), "title", "Judul sub-tugas", { min: 2, max: 200 });
    if (!title.ok) return title.result;

    const parent = await prisma.progressTask.findFirst({
      where: { id: parentId, shipmentId, parentId: null },
    });
    if (!parent) return fail("Fase parent tidak ditemukan.");

    const hours = parseInt(String(formData.get("estimatedHours") ?? "8"), 10);
    const estimatedHours = clampHours(Number.isFinite(hours) ? hours : 8);
    const sortRaw = parseInt(String(formData.get("sortOrder") ?? "0"), 10);
    const maxSort = await prisma.progressTask.aggregate({
      where: { parentId },
      _max: { sortOrder: true },
    });
    const sortOrder = Number.isFinite(sortRaw) && String(formData.get("sortOrder") ?? "").trim() !== ""
      ? sortRaw
      : (maxSort._max.sortOrder ?? -1) + 1;

    const created = await prisma.progressTask.create({
      data: {
        shipmentId,
        parentId,
        title: title.value,
        sortOrder,
        weightPercent: 0,
        estimatedHours,
        status: "NOT_STARTED",
      },
    });

    await rebalanceShipmentWeights(shipmentId);
    await recalculateShipmentProgress(shipmentId);

    await logActivity({
      shipmentId,
      action: ActivityAction.TASK_CREATED,
      summary: `Sub-tugas ditambahkan: ${title.value} (fase ${parent.title})`,
      publicText: `Sub-tahap baru: ${title.value}`,
      actor: actorFromSession(session),
      after: {
        taskId: created.id,
        title: title.value,
        parentId,
        parentTitle: parent.title,
        kind: "child",
      },
    });

    revalidateShipmentProgress(shipmentId);
    return ok("Sub-tugas ditambahkan.");
  }, "Sub-tugas ditambahkan.");
}

export async function deleteProgressTask(id: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    const session = await requireAdmin();
    const task = await prisma.progressTask.findUnique({
      where: { id },
      select: { id: true, shipmentId: true, parentId: true, title: true },
    });
    if (!task) return fail("Task tidak ditemukan.");

    await prisma.progressTask.delete({ where: { id } });
    await rebalanceShipmentWeights(task.shipmentId);
    await recalculateShipmentProgress(task.shipmentId);

    await logActivity({
      shipmentId: task.shipmentId,
      action: ActivityAction.TASK_DELETED,
      summary: `${task.parentId ? "Sub-tugas" : "Fase"} dihapus: ${task.title}`,
      publicText: null,
      actor: actorFromSession(session),
      before: { taskId: task.id, title: task.title, parentId: task.parentId },
    });

    revalidateShipmentProgress(task.shipmentId);
    return ok(task.parentId ? "Sub-tugas dihapus." : "Fase dihapus.");
  }, "Task dihapus.");
}

/** Bulk update status untuk checklist lapangan (HP). */
export async function bulkUpdateProgressTasks(formData: FormData): Promise<ActionResult> {
  return runAdminAction(async () => {
    const session = await requireAdmin();
    const shipmentId = String(formData.get("shipmentId") ?? "");
    if (!shipmentId) return fail("Shipment tidak valid.");

    const raw = String(formData.get("updates") ?? "").trim();
    if (!raw) return fail("Tidak ada perubahan.");

    let parsed: Array<{ id: string; status: string; actualHours?: number | null }>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return fail("Format update tidak valid.");
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return fail("Tidak ada task yang diubah.");
    }
    if (parsed.length > 80) return fail("Terlalu banyak task sekaligus (maks 80).");

    const allowed: ProgressTaskStatus[] = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"];
    const ids = parsed.map((u) => u.id).filter(Boolean);
    const tasks = await prisma.progressTask.findMany({
      where: { id: { in: ids }, shipmentId },
      include: {
        children: { select: { id: true } },
        parent: { select: { title: true } },
      },
    });
    const byId = new Map(tasks.map((t) => [t.id, t]));

    const actor = actorFromSession(session);
    let changed = 0;
    const titles: string[] = [];

    for (const item of parsed) {
      const task = byId.get(item.id);
      if (!task) continue;

      const isParentWithChildren = !task.parentId && task.children.length > 0;
      if (isParentWithChildren) continue; // status parent ikut anak

      const statusRaw = String(item.status) as ProgressTaskStatus;
      if (!allowed.includes(statusRaw)) continue;
      if (statusRaw === task.status) continue;

      let actualHours = task.actualHours;
      if (task.parentId) {
        if (item.actualHours != null && Number.isFinite(Number(item.actualHours))) {
          actualHours = clampHours(Number(item.actualHours));
        }
        if (statusRaw === "COMPLETED") {
          if (actualHours == null || actualHours <= 0) {
            actualHours = clampHours(task.estimatedHours ?? MAX_SUB_HOURS) ?? MAX_SUB_HOURS;
          }
        }
      }

      await prisma.progressTask.update({
        where: { id: task.id },
        data: {
          status: statusRaw,
          actualHours: task.parentId ? actualHours : null,
          startedAt:
            statusRaw === "IN_PROGRESS" || statusRaw === "COMPLETED"
              ? task.startedAt ?? new Date()
              : null,
          completedAt: statusRaw === "COMPLETED" ? new Date() : null,
        },
      });

      changed += 1;
      titles.push(task.title);

      const publicText =
        statusRaw === "COMPLETED"
          ? `Tahap "${task.title}" selesai`
          : statusRaw === "IN_PROGRESS"
            ? `Tahap "${task.title}" sedang dikerjakan`
            : `Tahap "${task.title}" diperbarui`;

      await logActivity({
        shipmentId,
        action: ActivityAction.TASK_UPDATED,
        summary: `Bulk: "${task.title}" ${task.status} → ${statusRaw}`,
        publicText,
        actor,
        before: { status: task.status },
        after: { status: statusRaw, actualHours: task.parentId ? actualHours : null },
        meta: { taskId: task.id, bulk: true },
      });
    }

    if (changed === 0) return fail("Tidak ada status yang berubah.");

    await recalculateShipmentProgress(shipmentId);
    revalidateShipmentProgress(shipmentId);
    return ok(
      changed === 1
        ? `1 tahap diperbarui: ${titles[0]}`
        : `${changed} tahap diperbarui.`
    );
  }, "Bulk update selesai.");
}

export async function duplicateWbsTemplate(id: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    await requireAdmin();
    const source = await prisma.wbsTemplate.findUnique({
      where: { id },
      include: {
        items: {
          where: { parentId: null },
          orderBy: { sortOrder: "asc" },
          include: { children: { orderBy: { sortOrder: "asc" } } },
        },
      },
    });
    if (!source) return fail("Template tidak ditemukan.");

    const copyName = `${source.name} (salinan)`.slice(0, 120);
    const created = await prisma.$transaction(async (tx) => {
      const tpl = await tx.wbsTemplate.create({
        data: {
          name: copyName,
          description: source.description,
          estimatedDays: source.estimatedDays,
          active: false,
        },
      });

      for (const parent of source.items) {
        const newParent = await tx.wbsTemplateItem.create({
          data: {
            templateId: tpl.id,
            title: parent.title,
            sortOrder: parent.sortOrder,
            estimatedHours: null,
          },
        });
        for (const child of parent.children) {
          await tx.wbsTemplateItem.create({
            data: {
              templateId: tpl.id,
              parentId: newParent.id,
              title: child.title,
              sortOrder: child.sortOrder,
              estimatedHours: child.estimatedHours,
            },
          });
        }
      }
      return tpl;
    });

    revalidatePath("/admin/wbs-templates");
    revalidatePath(`/admin/wbs-templates/${created.id}`);
    return ok(`Template diduplikat: ${copyName}`, { id: created.id });
  }, "Template diduplikat.");
}

/** Seimbangkan ulang bobot parent/child agar Σ ≈ 100%. */
export async function rebalanceProgressWeights(shipmentId: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    await requireAdmin();
    const parents = await prisma.progressTask.findMany({
      where: { shipmentId, parentId: null },
      select: { weightPercent: true },
    });
    if (parents.length === 0) return fail("Belum ada fase progress.");

    await rebalanceShipmentWeights(shipmentId);
    await recalculateShipmentProgress(shipmentId);

    const after = await prisma.progressTask.findMany({
      where: { shipmentId, parentId: null },
      select: { weightPercent: true },
    });
    const check = validateParentWeights(after.map((p) => p.weightPercent));

    revalidateShipmentProgress(shipmentId);
    return ok(
      check.ok
        ? `Bobot diseimbangkan (Σ parent ${check.sum}%).`
        : `Bobot dihitung ulang (Σ parent ${check.sum}%).`
    );
  }, "Bobot diseimbangkan.");
}

/** Terapkan saran status dari progress WBS (eksplisit — tidak override otomatis). */
export async function applySuggestedShipmentStatus(
  shipmentId: string
): Promise<ActionResult> {
  return runAdminAction(async () => {
    const session = await requireAdmin();
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { id: true, status: true, progressPercent: true },
    });
    if (!shipment) return fail("Shipment tidak ditemukan.");

    const { suggested, reason } = suggestShipmentStatusFromProgress({
      progressPercent: Number(shipment.progressPercent),
      currentStatus: shipment.status,
    });
    if (!suggested) {
      return fail(reason ?? "Tidak ada saran status saat ini.");
    }

    await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: suggested,
        deliveredAt: suggested === "DELIVERED" ? new Date() : null,
      },
    });

    await logActivity({
      shipmentId,
      action: ActivityAction.STATUS_CHANGED,
      summary: `Status (saran WBS): ${statusPublicLabel(shipment.status)} → ${statusPublicLabel(suggested)}`,
      publicText: `Status diperbarui menjadi ${statusPublicLabel(suggested)}`,
      actor: actorFromSession(session),
      before: { status: shipment.status },
      after: { status: suggested },
      meta: { source: "wbs_suggest", reason },
    });

    revalidateShipmentProgress(shipmentId);
    const fresh = await prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (fresh) {
      const { dispatchWebhook } = await import("@/lib/webhook");
      void dispatchWebhook("shipment.status_changed", fresh);
    }
    return ok(
      `Status diterapkan: ${SHIPMENT_STATUS_LABEL[suggested] ?? suggested}`
    );
  }, "Status diterapkan.");
}

