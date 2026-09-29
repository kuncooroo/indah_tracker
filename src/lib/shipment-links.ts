import { getAppUrl } from "@/lib/env";
import {
  getDeadlineReminder,
  startOfLocalDay,
  type DeadlineReminder,
} from "@/lib/utils";

export const ACTIVE_SHIPMENT_STATUSES = [
  "CREATED",
  "IN_PROGRESS",
  "QUALITY_CHECK",
  "READY_TO_SHIP",
  "IN_TRANSIT",
] as const;

export type ActiveShipmentStatus = (typeof ACTIVE_SHIPMENT_STATUSES)[number];

export function resolveEndDate(row: {
  estimatedEndDate: Date | null;
  estimatedDays: number | null;
  createdAt: Date;
}): Date | null {
  if (row.estimatedEndDate) return row.estimatedEndDate;
  if (row.estimatedDays != null && row.estimatedDays > 0) {
    const end = new Date(row.createdAt);
    end.setDate(end.getDate() + row.estimatedDays);
    return end;
  }
  return null;
}

export function reminderForShipment(
  row: {
    estimatedEndDate: Date | null;
    estimatedDays: number | null;
    createdAt: Date;
    status?: string;
  },
  soonDays = 2
): { endDate: Date | null; reminder: DeadlineReminder } {
  const endDate = resolveEndDate(row);
  if (row.status === "DELIVERED" || row.status === "CANCELLED") {
    return {
      endDate,
      reminder: {
        kind: "no_deadline",
        days: null,
        label: "Selesai / dibatalkan",
        shortLabel: "—",
      },
    };
  }
  return { endDate, reminder: getDeadlineReminder(endDate, { soonDays }) };
}

export function reminderBadgeClass(kind: DeadlineReminder["kind"]) {
  if (kind === "overdue") return "bg-red-50 text-red-700 ring-red-200";
  if (kind === "due_soon") return "bg-amber-50 text-amber-800 ring-amber-200";
  if (kind === "on_track") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  return "bg-neutral-100 text-neutral-600 ring-neutral-200";
}

export function buildTrackPath(trackingNumber: string, phoneLast4?: string | null) {
  const params = new URLSearchParams({ code: trackingNumber });
  if (phoneLast4) params.set("phone", phoneLast4);
  return `/track?${params.toString()}`;
}

export function buildTrackUrl(trackingNumber: string, phoneLast4?: string | null) {
  return `${getAppUrl()}${buildTrackPath(trackingNumber, phoneLast4)}`;
}

/** Normalisasi nomor ID untuk wa.me (tanpa +). */
export function normalizeWaPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  if (!digits.startsWith("62") && digits.length <= 11) digits = `62${digits}`;
  return digits;
}

export function buildWhatsAppTrackLink(opts: {
  phone?: string | null;
  trackingNumber: string;
  phoneLast4?: string | null;
  customerName?: string | null;
  companyName?: string | null;
  orderNumber?: string | null;
}) {
  const trackUrl = buildTrackUrl(opts.trackingNumber, opts.phoneLast4);
  const who =
    [opts.customerName, opts.companyName].filter(Boolean).join(" / ") || "Pelanggan";
  const po = opts.orderNumber ? ` (PO: ${opts.orderNumber})` : "";
  const text = [
    `Halo ${who}${po},`,
    "",
    "Berikut link untuk melacak progress pesanan mesin Indah Mesin:",
    trackUrl,
    "",
    `Nomor tracking: ${opts.trackingNumber}`,
    opts.phoneLast4
      ? "Gunakan 4 digit terakhir nomor telepon yang terdaftar untuk verifikasi."
      : null,
    "",
    "Terima kasih.",
    "CV. Indah Jaya Teknik — Indah Mesin",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const waPhone = normalizeWaPhone(opts.phone);
  const q = new URLSearchParams({ text });
  if (waPhone) {
    return `https://wa.me/${waPhone}?${q.toString()}`;
  }
  return `https://wa.me/?${q.toString()}`;
}

export function deadlineFilterBounds(soonDays = 2) {
  const today = startOfLocalDay();
  const soonEnd = startOfLocalDay();
  soonEnd.setDate(soonEnd.getDate() + soonDays);
  soonEnd.setHours(23, 59, 59, 999);
  return { today, soonEnd };
}
