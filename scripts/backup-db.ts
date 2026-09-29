/**
 * Backup database Indah Tracker.
 *
 * Mode default: JSON dump via Prisma (cross-platform).
 * Mode --sql: mysqldump jika tersedia di PATH.
 *
 * Output: backups/indah_tracker-YYYYMMDD-HHMMSS.{json|sql}
 * Retention: hapus file lebih dari BACKUP_KEEP_DAYS (default 14).
 *
 * Usage:
 *   npx tsx scripts/backup-db.ts
 *   npx tsx scripts/backup-db.ts --sql
 *   npm run db:backup
 */
import "dotenv/config";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const execFileAsync = promisify(execFile);

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function parseMysqlUrl(url: string) {
  // mysql://user:pass@host:port/db
  const u = new URL(url);
  return {
    host: u.hostname || "127.0.0.1",
    port: u.port || "3306",
    user: decodeURIComponent(u.username || "root"),
    password: decodeURIComponent(u.password || ""),
    database: u.pathname.replace(/^\//, "") || "indah_tracker",
  };
}

async function pruneOld(dir: string, keepDays: number) {
  const entries = await fs.readdir(dir);
  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  for (const name of entries) {
    if (!name.startsWith("indah_tracker-")) continue;
    const full = path.join(dir, name);
    const st = await fs.stat(full);
    if (st.mtimeMs < cutoff) {
      await fs.unlink(full);
      console.log(`[backup] pruned ${name}`);
    }
  }
}

async function backupJson(outFile: string) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL wajib di-set");

  const adapter = new PrismaMariaDb(databaseUrl);
  const prisma = new PrismaClient({ adapter });

  try {
    const [admins, templates, templateItems, shipments, tasks, photos, settings, activity, deadlineLogs] =
      await Promise.all([
        prisma.admin.findMany({
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            active: true,
            createdAt: true,
            updatedAt: true,
            // password hash sengaja dikecualikan dari backup JSON rutin
          },
        }),
        prisma.wbsTemplate.findMany(),
        prisma.wbsTemplateItem.findMany(),
        prisma.shipment.findMany(),
        prisma.progressTask.findMany(),
        prisma.progressPhoto.findMany(),
        prisma.appSetting.findMany().catch(() => []),
        prisma.activityLog.findMany(),
        prisma.deadlineNotificationLog.findMany(),
      ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      note: "JSON logical backup — password admin tidak disertakan. Untuk restore penuh gunakan --sql / mysqldump.",
      counts: {
        admins: admins.length,
        templates: templates.length,
        templateItems: templateItems.length,
        shipments: shipments.length,
        tasks: tasks.length,
        photos: photos.length,
        activityLogs: activity.length,
      },
      data: {
        admins,
        wbsTemplates: templates,
        wbsTemplateItems: templateItems,
        shipments,
        progressTasks: tasks,
        progressPhotos: photos,
        appSettings: settings,
        activityLogs: activity,
        deadlineNotificationLogs: deadlineLogs,
      },
    };

    await fs.writeFile(outFile, JSON.stringify(payload, null, 2), "utf8");
  } finally {
    await prisma.$disconnect();
  }
}

async function backupSql(outFile: string) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL wajib di-set");
  const cfg = parseMysqlUrl(databaseUrl);
  const args = [
    `-h${cfg.host}`,
    `-P${cfg.port}`,
    `-u${cfg.user}`,
    ...(cfg.password ? [`-p${cfg.password}`] : []),
    "--single-transaction",
    "--routines",
    "--triggers",
    cfg.database,
  ];
  const { stdout } = await execFileAsync("mysqldump", args, {
    maxBuffer: 256 * 1024 * 1024,
    encoding: "utf8",
  });
  await fs.writeFile(outFile, stdout, "utf8");
}

async function main() {
  const useSql = process.argv.includes("--sql");
  const keepDays = Number(process.env.BACKUP_KEEP_DAYS ?? 14);
  const dir = path.resolve(process.cwd(), process.env.BACKUP_DIR || "backups");
  await fs.mkdir(dir, { recursive: true });

  const outFile = path.join(
    dir,
    `indah_tracker-${stamp()}.${useSql ? "sql" : "json"}`
  );

  console.log(`[backup] writing ${outFile}`);
  if (useSql) {
    await backupSql(outFile);
  } else {
    await backupJson(outFile);
  }
  const st = await fs.stat(outFile);
  console.log(`[backup] ok · ${(st.size / 1024).toFixed(1)} KB`);
  await pruneOld(dir, Number.isFinite(keepDays) ? keepDays : 14);
}

main().catch((e) => {
  console.error("[backup] failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
