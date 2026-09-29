import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Uptime / health check.
 * - 200: DB reachable
 * - 503: DB down
 * Optional: Authorization Bearer CRON_SECRET untuk detail ekstra (hindari expose di public monitor).
 */
export async function GET(request: Request) {
  const started = Date.now();
  let dbOk = false;
  let dbError: string | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (e) {
    dbError = e instanceof Error ? e.message : "db_error";
  }

  const auth = request.headers.get("authorization");
  const cron = process.env.CRON_SECRET?.trim();
  const detailed =
    Boolean(cron) &&
    (auth === `Bearer ${cron}` || request.headers.get("x-cron-secret") === cron);

  const body = {
    ok: dbOk,
    service: "indah-tracker",
    ts: new Date().toISOString(),
    latencyMs: Date.now() - started,
    ...(detailed
      ? {
          db: dbOk ? "up" : "down",
          dbError,
          version: process.env.npm_package_version ?? "0.1.0",
          node: process.version,
        }
      : {}),
  };

  return NextResponse.json(body, {
    status: dbOk ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
