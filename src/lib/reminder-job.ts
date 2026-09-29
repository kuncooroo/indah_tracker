import { prisma } from "@/lib/prisma";
import {
  ACTIVE_SHIPMENT_STATUSES,
  reminderForShipment,
} from "@/lib/shipment-links";
import {
  dayKeyJakarta,
  getReminderNotifyConfig,
  getSoonDays,
} from "@/lib/reminder-config";
import {
  buildReminderDigestHtml,
  buildReminderDigestText,
  sendReminderEmail,
  sendReminderTelegram,
  type ReminderJobItem,
} from "@/lib/notify";

export type DeadlineReminderRunResult = {
  dayKey: string;
  soonDays: number;
  scanned: number;
  overdueCount: number;
  dueSoonCount: number;
  toNotify: number;
  skippedAlreadyNotified: number;
  emailed: boolean;
  emailSkipped: boolean;
  emailError?: string;
  telegramSent: boolean;
  telegramSkipped: boolean;
  telegramError?: string;
  logged: number;
};

async function resolveRecipients(): Promise<string[]> {
  const cfg = getReminderNotifyConfig();
  if (cfg.emailTo) {
    return cfg.emailTo
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const admins = await prisma.admin.findMany({
    where: { active: true },
    select: { email: true },
    orderBy: { createdAt: "asc" },
  });
  return admins.map((a) => a.email).filter(Boolean);
}

/**
 * Cek deadline aktif → kirim digest email (+ opsional Telegram).
 * Anti-spam: 1 notifikasi per shipment per channel per hari (dayKey WIB).
 */
export async function runDeadlineReminderJob(): Promise<DeadlineReminderRunResult> {
  const soonDays = await getSoonDays();
  const dayKey = dayKeyJakarta();
  const cfg = getReminderNotifyConfig();

  const active = await prisma.shipment.findMany({
    where: { status: { in: [...ACTIVE_SHIPMENT_STATUSES] }, deletedAt: null },
    select: {
      id: true,
      trackingNumber: true,
      customerName: true,
      companyName: true,
      orderNumber: true,
      progressPercent: true,
      estimatedDays: true,
      estimatedEndDate: true,
      createdAt: true,
      status: true,
    },
  });

  const overdue: ReminderJobItem[] = [];
  const dueSoon: ReminderJobItem[] = [];

  for (const row of active) {
    const { endDate, reminder } = reminderForShipment(row, soonDays);
    if (reminder.kind !== "overdue" && reminder.kind !== "due_soon") continue;
    const item: ReminderJobItem = {
      id: row.id,
      trackingNumber: row.trackingNumber,
      customerName: row.customerName,
      companyName: row.companyName,
      orderNumber: row.orderNumber,
      progressPercent: Number(row.progressPercent),
      kind: reminder.kind,
      label: reminder.label,
      endDate,
    };
    if (reminder.kind === "overdue") overdue.push(item);
    else dueSoon.push(item);
  }

  overdue.sort((a, b) => (a.endDate?.getTime() ?? 0) - (b.endDate?.getTime() ?? 0));
  dueSoon.sort((a, b) => (a.endDate?.getTime() ?? 0) - (b.endDate?.getTime() ?? 0));

  const candidates = [...overdue, ...dueSoon];
  const candidateIds = candidates.map((c) => c.id);

  const already = candidateIds.length
    ? await prisma.deadlineNotificationLog.findMany({
        where: {
          dayKey,
          shipmentId: { in: candidateIds },
        },
        select: { shipmentId: true, channel: true },
      })
    : [];

  const emailedIds = new Set(
    already.filter((a) => a.channel === "email").map((a) => a.shipmentId)
  );
  const telegramedIds = new Set(
    already.filter((a) => a.channel === "telegram").map((a) => a.shipmentId)
  );

  const emailQueue = candidates.filter((c) => !emailedIds.has(c.id));
  const telegramQueue = candidates.filter((c) => !telegramedIds.has(c.id));
  const skippedAlreadyNotified = candidates.length - Math.max(emailQueue.length, telegramQueue.length);

  let emailed = false;
  let emailSkipped = false;
  let emailError: string | undefined;
  let telegramSent = false;
  let telegramSkipped = false;
  let telegramError: string | undefined;
  let logged = 0;

  if (emailQueue.length > 0) {
    const emailOverdue = overdue.filter((o) => emailQueue.some((q) => q.id === o.id));
    const emailDueSoon = dueSoon.filter((o) => emailQueue.some((q) => q.id === o.id));
    const text = buildReminderDigestText({
      dayKey,
      soonDays,
      overdue: emailOverdue,
      dueSoon: emailDueSoon,
    });
    const html = buildReminderDigestHtml({
      dayKey,
      soonDays,
      overdue: emailOverdue,
      dueSoon: emailDueSoon,
    });
    const to = await resolveRecipients();
    const result = await sendReminderEmail({
      to,
      subject: `[Indah Tracker] Reminder: ${emailOverdue.length} telat, ${emailDueSoon.length} due soon`,
      text,
      html,
    });
    emailed = result.ok && !result.skipped;
    emailSkipped = Boolean(result.skipped);
    emailError = result.error;

    if (result.ok) {
      for (const item of emailQueue) {
        try {
          await prisma.deadlineNotificationLog.create({
            data: {
              shipmentId: item.id,
              kind: item.kind,
              channel: "email",
              dayKey,
            },
          });
          logged += 1;
        } catch {
          /* unique race */
        }
      }
    }
  } else {
    emailSkipped = true;
  }

  if (cfg.telegramEnabled && telegramQueue.length > 0) {
    const tgOverdue = overdue.filter((o) => telegramQueue.some((q) => q.id === o.id));
    const tgDueSoon = dueSoon.filter((o) => telegramQueue.some((q) => q.id === o.id));
    const text = buildReminderDigestText({
      dayKey,
      soonDays,
      overdue: tgOverdue,
      dueSoon: tgDueSoon,
    });
    const result = await sendReminderTelegram(text);
    telegramSent = result.ok && !result.skipped;
    telegramSkipped = Boolean(result.skipped);
    telegramError = result.error;

    if (result.ok) {
      for (const item of telegramQueue) {
        try {
          await prisma.deadlineNotificationLog.create({
            data: {
              shipmentId: item.id,
              kind: item.kind,
              channel: "telegram",
              dayKey,
            },
          });
          logged += 1;
        } catch {
          /* unique */
        }
      }
    }
  } else {
    telegramSkipped = true;
  }

  return {
    dayKey,
    soonDays,
    scanned: active.length,
    overdueCount: overdue.length,
    dueSoonCount: dueSoon.length,
    toNotify: emailQueue.length,
    skippedAlreadyNotified,
    emailed,
    emailSkipped,
    emailError,
    telegramSent,
    telegramSkipped,
    telegramError,
    logged,
  };
}
