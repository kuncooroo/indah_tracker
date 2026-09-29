import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateId(date: Date | string | null | undefined) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

/** Tanggal saja (tanpa jam), aman untuk Date atau string ISO dari cache. */
export function formatDateOnlyId(date: Date | string | null | undefined) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateLongId(date: Date | string = new Date()) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function startOfLocalDay(date: Date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Days from today to target (positive = future, negative = overdue). */
export function daysUntil(target: Date | string, from: Date = new Date()) {
  const end = startOfLocalDay(typeof target === "string" ? new Date(target) : target);
  const start = startOfLocalDay(from);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export type DeadlineReminder = {
  kind: "overdue" | "due_soon" | "on_track" | "no_deadline";
  days: number | null;
  label: string;
  shortLabel: string;
};

/** Reminder copy for estimated end date (Indonesia). */
export function getDeadlineReminder(
  estimatedEndDate: Date | string | null | undefined,
  opts: { soonDays?: number } = {}
): DeadlineReminder {
  const soonDays = opts.soonDays ?? 2;
  if (!estimatedEndDate) {
    return {
      kind: "no_deadline",
      days: null,
      label: "Belum ada target selesai",
      shortLabel: "Tanpa target",
    };
  }
  const days = daysUntil(estimatedEndDate);
  if (days < 0) {
    const late = Math.abs(days);
    return {
      kind: "overdue",
      days,
      label: `Sudah telat ${late} hari`,
      shortLabel: `Telat ${late}h`,
    };
  }
  if (days === 0) {
    return {
      kind: "due_soon",
      days: 0,
      label: "Target hari ini",
      shortLabel: "Hari ini",
    };
  }
  if (days <= soonDays) {
    return {
      kind: "due_soon",
      days,
      label: `Kurang ${days} hari lagi`,
      shortLabel: `−${days} hari`,
    };
  }
  return {
    kind: "on_track",
    days,
    label: `Sisa ${days} hari`,
    shortLabel: `${days} hari`,
  };
}
