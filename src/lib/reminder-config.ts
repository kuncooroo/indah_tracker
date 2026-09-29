import { prisma } from "@/lib/prisma";

export const SETTING_SOON_DAYS = "REMINDER_SOON_DAYS";
export const DEFAULT_SOON_DAYS = 2;

/** Kalender hari di zona Asia/Jakarta → YYYY-MM-DD */
export function dayKeyJakarta(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parseSoonDays(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(30, n);
}

/** Sync: dari env saja (fallback cepat). */
export function getSoonDaysFromEnv(): number {
  return parseSoonDays(process.env.REMINDER_SOON_DAYS) ?? DEFAULT_SOON_DAYS;
}

/** Async: AppSetting DB → env → default. */
export async function getSoonDays(): Promise<number> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: SETTING_SOON_DAYS },
    });
    const fromDb = parseSoonDays(row?.value);
    if (fromDb != null) return fromDb;
  } catch {
    // tabel belum migrate / DB down → env
  }
  return getSoonDaysFromEnv();
}

export async function setSoonDays(days: number): Promise<number> {
  const value = String(Math.min(30, Math.max(0, Math.round(days))));
  await prisma.appSetting.upsert({
    where: { key: SETTING_SOON_DAYS },
    create: { key: SETTING_SOON_DAYS, value },
    update: { value },
  });
  return parseInt(value, 10);
}

export function getReminderNotifyConfig() {
  return {
    cronSecret: process.env.CRON_SECRET?.trim() || "",
    emailEnabled: process.env.REMINDER_EMAIL_ENABLED !== "false",
    telegramEnabled: Boolean(
      process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim()
    ),
    smtp: {
      host: process.env.SMTP_HOST?.trim() || "",
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER?.trim() || "",
      pass: process.env.SMTP_PASS?.trim() || "",
      from:
        process.env.SMTP_FROM?.trim() ||
        process.env.SMTP_USER?.trim() ||
        "noreply@indahmesin.com",
    },
    telegram: {
      token: process.env.TELEGRAM_BOT_TOKEN?.trim() || "",
      chatId: process.env.TELEGRAM_CHAT_ID?.trim() || "",
    },
    /** Override penerima email (koma-separated). Kosong = semua Admin.email */
    emailTo: process.env.REMINDER_EMAIL_TO?.trim() || "",
  };
}
