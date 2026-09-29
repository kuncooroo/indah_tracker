import { getAppUrl } from "@/lib/env";
import { getReminderNotifyConfig } from "@/lib/reminder-config";

export type ReminderJobItem = {
  id: string;
  trackingNumber: string;
  customerName: string | null;
  companyName: string | null;
  orderNumber: string | null;
  progressPercent: number;
  kind: "overdue" | "due_soon";
  label: string;
  endDate: Date | null;
};

function formatItemLine(item: ReminderJobItem) {
  const who =
    [item.companyName, item.customerName].filter(Boolean).join(" · ") || "—";
  const target = item.endDate
    ? item.endDate.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      })
    : "—";
  return `• ${item.trackingNumber} — ${item.label} (target ${target}) · ${who} · ${item.progressPercent}%`;
}

export function buildReminderDigestText(opts: {
  dayKey: string;
  soonDays: number;
  overdue: ReminderJobItem[];
  dueSoon: ReminderJobItem[];
}) {
  const base = getAppUrl();
  const lines = [
    `Indah Tracker — Reminder deadline (${opts.dayKey} WIB)`,
    `Ambang due soon: ≤${opts.soonDays} hari`,
    "",
  ];

  if (opts.overdue.length) {
    lines.push(`SUDAH TELAT (${opts.overdue.length})`);
    for (const item of opts.overdue) lines.push(formatItemLine(item));
    lines.push("");
  }
  if (opts.dueSoon.length) {
    lines.push(`DUE SOON ≤${opts.soonDays} HARI (${opts.dueSoon.length})`);
    for (const item of opts.dueSoon) lines.push(formatItemLine(item));
    lines.push("");
  }

  lines.push(`Dashboard: ${base}/admin/dashboard`);
  lines.push(`List telat: ${base}/admin/shipments?deadline=overdue`);
  lines.push(`List due soon: ${base}/admin/shipments?deadline=due_soon`);
  return lines.join("\n");
}

export function buildReminderDigestHtml(opts: {
  dayKey: string;
  soonDays: number;
  overdue: ReminderJobItem[];
  dueSoon: ReminderJobItem[];
}) {
  const base = getAppUrl();
  const row = (item: ReminderJobItem) => {
    const who =
      [item.companyName, item.customerName].filter(Boolean).join(" · ") || "—";
    const target = item.endDate
      ? item.endDate.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Jakarta",
        })
      : "—";
    const color = item.kind === "overdue" ? "#b91c1c" : "#b45309";
    return `<tr>
      <td style="padding:8px;border-bottom:1px solid #eee;font-family:monospace;font-size:12px">
        <a href="${base}/admin/shipments/${item.id}/progress">${item.trackingNumber}</a>
      </td>
      <td style="padding:8px;border-bottom:1px solid #eee;font-size:13px;color:${color}">${item.label}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;font-size:13px">${target}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;font-size:13px">${who}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;font-size:13px">${item.progressPercent}%</td>
    </tr>`;
  };

  const section = (title: string, items: ReminderJobItem[]) => {
    if (!items.length) return "";
    return `<h3 style="margin:24px 0 8px;font-size:15px">${title} (${items.length})</h3>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="text-align:left;background:#f5f5f5;font-size:12px;color:#666">
            <th style="padding:8px">Tracking</th>
            <th style="padding:8px">Reminder</th>
            <th style="padding:8px">Target</th>
            <th style="padding:8px">Customer</th>
            <th style="padding:8px">Progress</th>
          </tr>
        </thead>
        <tbody>${items.map(row).join("")}</tbody>
      </table>`;
  };

  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#171717;max-width:720px;margin:0 auto;padding:24px">
    <h2 style="margin:0 0 4px">Indah Tracker — Reminder deadline</h2>
    <p style="margin:0 0 16px;color:#666;font-size:14px">${opts.dayKey} WIB · due soon ≤${opts.soonDays} hari</p>
    ${section("Sudah telat", opts.overdue)}
    ${section(`Due soon`, opts.dueSoon)}
    <p style="margin-top:28px;font-size:13px">
      <a href="${base}/admin/dashboard">Dashboard</a> ·
      <a href="${base}/admin/shipments?deadline=overdue">List telat</a> ·
      <a href="${base}/admin/shipments?deadline=due_soon">List due soon</a>
    </p>
  </body></html>`;
}

export async function sendReminderEmail(opts: {
  to: string[];
  subject: string;
  text: string;
  html: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const cfg = getReminderNotifyConfig();
  if (!cfg.emailEnabled) return { ok: true, skipped: true };
  if (!cfg.smtp.host) {
    return { ok: false, error: "SMTP_HOST belum di-set" };
  }
  if (opts.to.length === 0) {
    return { ok: false, error: "Tidak ada penerima email admin" };
  }

  try {
    // Dynamic import agar build tidak wajib punya nodemailer types di edge
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: cfg.smtp.host,
      port: cfg.smtp.port,
      secure: cfg.smtp.secure,
      auth:
        cfg.smtp.user && cfg.smtp.pass
          ? { user: cfg.smtp.user, pass: cfg.smtp.pass }
          : undefined,
    });

    await transporter.sendMail({
      from: cfg.smtp.from,
      to: opts.to.join(", "),
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal kirim email" };
  }
}

/** Opsional: Telegram bot ke chat admin. */
export async function sendReminderTelegram(
  text: string
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const cfg = getReminderNotifyConfig();
  if (!cfg.telegramEnabled) return { ok: true, skipped: true };

  try {
    const url = `https://api.telegram.org/bot${cfg.telegram.token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: cfg.telegram.chatId,
        text: text.slice(0, 4000),
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Telegram ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Gagal kirim Telegram",
    };
  }
}
