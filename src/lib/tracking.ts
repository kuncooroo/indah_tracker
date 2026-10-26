import { randomBytes } from "node:crypto";

/**
 * Public tracking id: IM-TRK-YYYYMMDD- plus 32 random bits.
 * A 4-digit suffix is enumerable (9000 values per day). Pass `seq` only from seed data.
 */
export function generateTrackingNumber(seq?: number) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const suffix =
    seq == null ? randomBytes(4).toString("hex").toUpperCase() : String(seq).padStart(4, "0");
  return `IM-TRK-${y}${m}${d}-${suffix}`;
}

/** Phone-check bucket. Do not include client IP — X-Forwarded-For is caller-controlled. */
export function publicPhoneAttemptKey(trackingNumber: string) {
  return `track:phone:${trackingNumber.trim().toUpperCase()}`;
}

export function phoneLast4(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

export const SHIPMENT_STATUS_LABEL: Record<string, string> = {
  CREATED: "Dibuat",
  IN_PROGRESS: "Dalam proses",
  QUALITY_CHECK: "Quality check",
  READY_TO_SHIP: "Siap kirim",
  IN_TRANSIT: "Dalam pengiriman",
  DELIVERED: "Terkirim",
  CANCELLED: "Dibatalkan",
};
