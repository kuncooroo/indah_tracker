"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, runAdminAction, type ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import { setSoonDays } from "@/lib/reminder-config";
import { runDeadlineReminderJob } from "@/lib/reminder-job";

export async function updateReminderSettings(formData: FormData): Promise<ActionResult> {
  return runAdminAction(async () => {
    await requireAdmin();
    const raw = parseInt(String(formData.get("soonDays") ?? "2"), 10);
    if (!Number.isFinite(raw) || raw < 0 || raw > 30) {
      return fail("soonDays harus angka 0–30.");
    }
    const value = await setSoonDays(raw);
    revalidatePath("/admin/settings");
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/shipments");
    return ok(`Ambang due soon diset ke ${value} hari.`);
  }, "Settings disimpan.");
}

export async function runReminderJobNow(_formData?: FormData): Promise<ActionResult> {
  return runAdminAction(async () => {
    await requireAdmin();
    const result = await runDeadlineReminderJob();
    revalidatePath("/admin/settings");
    const parts = [
      `Scan ${result.scanned}`,
      `telat ${result.overdueCount}`,
      `due soon ${result.dueSoonCount}`,
      `kirim email: ${result.emailed ? "ya" : result.emailSkipped ? "skip" : "gagal"}`,
      `telegram: ${result.telegramSent ? "ya" : result.telegramSkipped ? "skip" : "gagal"}`,
    ];
    if (result.emailError) parts.push(`email err: ${result.emailError}`);
    if (result.telegramError) parts.push(`tg err: ${result.telegramError}`);
    return ok(parts.join(" · "), { id: result.dayKey });
  }, "Job dijalankan.");
}
