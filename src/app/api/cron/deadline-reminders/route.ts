import { NextResponse } from "next/server";
import { getReminderNotifyConfig } from "@/lib/reminder-config";
import { runDeadlineReminderJob } from "@/lib/reminder-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(request: Request): boolean {
  const cfg = getReminderNotifyConfig();
  const header = request.headers.get("authorization") ?? "";
  const cronHeader = request.headers.get("x-cron-secret") ?? "";
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret") ?? "";

  // Dev tanpa CRON_SECRET: izinkan hanya di non-production
  if (!cfg.cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  if (cronHeader && cronHeader === cfg.cronSecret) return true;
  if (querySecret && querySecret === cfg.cronSecret) return true;
  if (header === `Bearer ${cfg.cronSecret}`) return true;
  return false;
}

async function handle(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDeadlineReminderJob();
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        message: e instanceof Error ? e.message : "Job gagal",
      },
      { status: 500 }
    );
  }
}

/** Cron harian — GET atau POST dengan CRON_SECRET */
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
