import Link from "next/link";
import {
  AdminActionForm,
  AdminFormField,
  AdminSubmitButton,
  adminFormGridClass,
} from "@/components/admin/admin-forms";
import {
  runReminderJobNow,
  updateReminderSettings,
} from "@/lib/admin-settings-actions";
import { getReminderNotifyConfig, getSoonDays, dayKeyJakarta } from "@/lib/reminder-config";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isSuperAdmin, requireAdmin } from "@/lib/auth";
import { changeOwnPassword } from "@/lib/admin-users-actions";
import { ChangeOwnPasswordForm } from "@/components/admin/admin-users-forms";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const session = await getAdminSession();
  const superAdmin = isSuperAdmin(session);

  const [soonDays, cfg, todayLogs] = await Promise.all([
    getSoonDays(),
    Promise.resolve(getReminderNotifyConfig()),
    prisma.deadlineNotificationLog.count({
      where: { dayKey: dayKeyJakarta() },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Settings</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Reminder, keamanan akun, dan (SUPERADMIN) kelola user.
          </p>
        </div>
        {superAdmin ? (
          <Link
            href="/admin/users"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Kelola admin →
          </Link>
        ) : null}
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Ganti password</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Login sebagai {session?.user?.email} · role {session?.user?.role ?? "ADMIN"}
        </p>
        <div className="mt-4">
          <ChangeOwnPasswordForm action={changeOwnPassword} />
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Ambang due soon</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Job dengan sisa hari ≤ nilai ini dianggap &quot;due soon&quot;. Default 2. Bisa di-override
          juga via env <code className="rounded bg-neutral-100 px-1">REMINDER_SOON_DAYS</code>{" "}
          (DB menang jika sudah di-set di sini).
        </p>
        <AdminActionForm
          action={updateReminderSettings}
          className={`${adminFormGridClass} mt-4 max-w-md`}
          resetOnSuccess={false}
        >
          <AdminFormField
            label="soonDays (0–30)"
            name="soonDays"
            type="number"
            min={0}
            max={30}
            defaultValue={String(soonDays)}
            required
          />
          <AdminSubmitButton label="Simpan" />
        </AdminActionForm>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Notifikasi</h2>
        <ul className="mt-3 space-y-2 text-sm text-neutral-600">
          <li>
            Email:{" "}
            <strong>
              {cfg.emailEnabled
                ? cfg.smtp.host
                  ? "siap (SMTP)"
                  : "SMTP belum di-set"
                : "dimatikan"}
            </strong>
          </li>
          <li>
            Telegram:{" "}
            <strong>
              {cfg.telegramEnabled
                ? "aktif"
                : "opsional — set TELEGRAM_BOT_TOKEN + CHAT_ID"}
            </strong>
          </li>
          <li>
            Cron secret:{" "}
            <strong>{cfg.cronSecret ? "terpasang" : "kosong (dev-only tanpa secret)"}</strong>
          </li>
          <li>
            Log notifikasi hari ini (WIB): <strong>{todayLogs}</strong>
          </li>
        </ul>
        <p className="mt-3 text-xs text-neutral-500">
          Anti-spam: maksimal 1 notifikasi per shipment per channel per hari (zona Asia/Jakarta).
        </p>
        <div className="mt-4 max-w-sm">
          <AdminActionForm action={runReminderJobNow} resetOnSuccess={false}>
            <AdminSubmitButton label="Jalankan reminder sekarang" />
          </AdminActionForm>
          <p className="mt-2 text-xs text-neutral-400">
            Atau jadwalkan:{" "}
            <code className="rounded bg-neutral-100 px-1">npm run cron:reminders</code> / hit{" "}
            <code className="rounded bg-neutral-100 px-1">/api/cron/deadline-reminders</code>
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Backup database</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Export rutin ke folder <code className="rounded bg-neutral-100 px-1">backups/</code>.
          Jalankan di server (cron harian disarankan).
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-neutral-900 p-4 text-xs text-neutral-100">
{`# JSON dump (Prisma) — aman cross-platform
npm run db:backup

# Atau mysqldump (jika MySQL client terpasang)
npm run db:backup:sql

# Cron contoh (03:00 WIB):
0 3 * * * cd /path/to/indah_tracker && npm run db:backup`}
        </pre>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-600">
        <h2 className="text-sm font-semibold text-neutral-900">Jadwal reminder (contoh)</h2>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-neutral-900 p-4 text-xs text-neutral-100">
{`# Linux crontab — tiap hari jam 07:00 WIB
0 7 * * * curl -s -H "x-cron-secret: $CRON_SECRET" \\
  https://YOUR_DOMAIN/api/cron/deadline-reminders

# Windows Task Scheduler / n8n: HTTP GET dengan header x-cron-secret`}
        </pre>
      </section>
    </div>
  );
}
