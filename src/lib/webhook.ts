import { createHmac, timingSafeEqual } from "node:crypto";
import { getAppUrl } from "@/lib/env";
import { buildTrackUrl } from "@/lib/shipment-links";

export type WebhookEvent =
  | "shipment.created"
  | "shipment.status_changed"
  | "shipment.progress_updated";

export type WebhookPayload = {
  event: WebhookEvent;
  occurredAt: string;
  data: {
    id: string;
    trackingNumber: string;
    externalOrderId: string | null;
    orderNumber: string | null;
    status: string;
    progressPercent: number;
    customerName: string | null;
    companyName: string | null;
    trackUrl: string;
  };
};

export function getWebhookConfig() {
  return {
    url: process.env.WEBHOOK_URL?.trim() || "",
    secret: process.env.WEBHOOK_SECRET?.trim() || "",
    timeoutMs: Number(process.env.WEBHOOK_TIMEOUT_MS ?? 8000),
  };
}

export function signWebhookBody(body: string, secret: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function verifyWebhookSignature(body: string, signature: string | null, secret: string) {
  if (!signature || !secret) return false;
  const expected = signWebhookBody(body, secret);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function shipmentWebhookData(row: {
  id: string;
  trackingNumber: string;
  externalOrderId: string | null;
  orderNumber: string | null;
  status: string;
  progressPercent: { toNumber?: () => number } | number | string;
  customerName: string | null;
  companyName: string | null;
  phoneLast4: string | null;
}): WebhookPayload["data"] {
  const progress =
    typeof row.progressPercent === "object" &&
    row.progressPercent &&
    typeof row.progressPercent.toNumber === "function"
      ? row.progressPercent.toNumber()
      : Number(row.progressPercent);
  return {
    id: row.id,
    trackingNumber: row.trackingNumber,
    externalOrderId: row.externalOrderId,
    orderNumber: row.orderNumber,
    status: row.status,
    progressPercent: Number.isFinite(progress) ? progress : 0,
    customerName: row.customerName,
    companyName: row.companyName,
    trackUrl: buildTrackUrl(row.trackingNumber, row.phoneLast4),
  };
}

/** Fire-and-forget outbound webhook. Tidak menggagalkan aksi utama. */
export async function dispatchWebhook(
  event: WebhookEvent,
  shipment: Parameters<typeof shipmentWebhookData>[0]
) {
  const cfg = getWebhookConfig();
  if (!cfg.url) return { skipped: true as const };

  const payload: WebhookPayload = {
    event,
    occurredAt: new Date().toISOString(),
    data: shipmentWebhookData(shipment),
  };
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "IndahTracker-Webhook/1.0",
    "X-Tracker-Event": event,
  };
  if (cfg.secret) {
    headers["X-Tracker-Signature"] = signWebhookBody(body, cfg.secret);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`[webhook] ${event} → ${res.status} ${await res.text().catch(() => "")}`);
      return { ok: false as const, status: res.status };
    }
    return { ok: true as const, status: res.status };
  } catch (e) {
    console.error("[webhook]", event, e instanceof Error ? e.message : e);
    return { ok: false as const, error: e instanceof Error ? e.message : "fetch failed" };
  } finally {
    clearTimeout(timer);
  }
}

/** Helper untuk test endpoint lokal. */
export function webhookDocsHint() {
  return {
    url: getWebhookConfig().url || null,
    events: ["shipment.created", "shipment.status_changed", "shipment.progress_updated"],
    headers: ["X-Tracker-Event", "X-Tracker-Signature (HMAC-SHA256 hex of raw body)"],
    appUrl: getAppUrl(),
  };
}
