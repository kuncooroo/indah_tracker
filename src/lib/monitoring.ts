/**
 * Error monitoring — aktif jika SENTRY_DSN di-set.
 * Tanpa DSN: log ke console saja (dev-friendly).
 */
import * as Sentry from "@sentry/nextjs";

let initialized = false;

export function initMonitoring() {
  if (initialized) return;
  initialized = true;
  const dsn = process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    enabled: true,
  });
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  console.error("[error]", error, context ?? "");
  const dsn = process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return;
  try {
    initMonitoring();
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    /* ignore */
  }
}

export function captureMessage(message: string, level: "info" | "warning" | "error" = "info") {
  const dsn = process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) {
    console.log(`[${level}]`, message);
    return;
  }
  try {
    initMonitoring();
    Sentry.captureMessage(message, level);
  } catch {
    /* ignore */
  }
}
