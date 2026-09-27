/** Generate tracking number: IM-TRK-YYYYMMDD-XXXX */
export function generateTrackingNumber(seq = Math.floor(Math.random() * 9000) + 1000) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `IM-TRK-${y}${m}${d}-${String(seq).padStart(4, "0")}`;
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
