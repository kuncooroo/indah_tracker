import { startOfLocalDay } from "@/lib/utils";

export type AnalyticsPeriod = "7" | "30" | "90" | "all";

export const ANALYTICS_PERIODS: { value: AnalyticsPeriod; label: string; days: number | null }[] = [
  { value: "7", label: "7 hari", days: 7 },
  { value: "30", label: "30 hari", days: 30 },
  { value: "90", label: "90 hari", days: 90 },
  { value: "all", label: "Semua", days: null },
];

export function parseAnalyticsPeriod(raw: string | null | undefined): AnalyticsPeriod {
  if (raw === "7" || raw === "30" || raw === "90" || raw === "all") return raw;
  return "30";
}

export function periodDays(period: AnalyticsPeriod): number | null {
  return ANALYTICS_PERIODS.find((p) => p.value === period)?.days ?? 30;
}

export function periodSince(period: AnalyticsPeriod, from = new Date()): Date | null {
  const days = periodDays(period);
  if (days == null) return null;
  const d = startOfLocalDay(from);
  d.setDate(d.getDate() - (days - 1));
  return d;
}

export function dayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function buildDailyBuckets(
  days: number,
  events: { at: Date }[],
  from = new Date()
): { key: string; label: string; count: number }[] {
  const buckets: { key: string; label: string; count: number }[] = [];
  const counts = new Map<string, number>();
  for (const e of events) {
    const k = dayKey(startOfLocalDay(e.at));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  for (let i = days - 1; i >= 0; i--) {
    const day = startOfLocalDay(from);
    day.setDate(day.getDate() - i);
    const key = dayKey(day);
    buckets.push({
      key,
      label: day.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
      count: counts.get(key) ?? 0,
    });
  }
  return buckets;
}

export function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export function avg(nums: number[]) {
  if (nums.length === 0) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export type LeadSample = {
  actualDays: number;
  estimatedDays: number | null;
  delta: number | null; // actual - estimated (negatif = lebih cepat)
  onTime: boolean | null;
};

export function computeLeadSamples(
  rows: Array<{
    createdAt: Date;
    deliveredAt: Date | null;
    estimatedDays: number | null;
  }>
): LeadSample[] {
  return rows
    .filter((r) => r.deliveredAt)
    .map((r) => {
      const actualDays = Math.max(
        0,
        Math.round(
          (r.deliveredAt!.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        )
      );
      const estimatedDays =
        r.estimatedDays != null && r.estimatedDays > 0 ? r.estimatedDays : null;
      const delta = estimatedDays != null ? actualDays - estimatedDays : null;
      const onTime = delta != null ? delta <= 0 : null;
      return { actualDays, estimatedDays, delta, onTime };
    });
}

export function summarizeLeadTimes(samples: LeadSample[]) {
  const actuals = samples.map((s) => s.actualDays);
  const withEstimate = samples.filter((s) => s.estimatedDays != null);
  const deltas = withEstimate
    .map((s) => s.delta)
    .filter((d): d is number => d != null);
  const onTimeCount = withEstimate.filter((s) => s.onTime).length;

  return {
    count: samples.length,
    withEstimateCount: withEstimate.length,
    avgActual: avg(actuals),
    avgEstimated: avg(withEstimate.map((s) => s.estimatedDays!)),
    avgDelta: avg(deltas),
    onTimeRate: withEstimate.length ? pct(onTimeCount, withEstimate.length) : null,
    fasterCount: withEstimate.filter((s) => (s.delta ?? 0) < 0).length,
    slowerCount: withEstimate.filter((s) => (s.delta ?? 0) > 0).length,
    onTimeExact: withEstimate.filter((s) => s.delta === 0).length,
    minActual: actuals.length ? Math.min(...actuals) : null,
    maxActual: actuals.length ? Math.max(...actuals) : null,
  };
}

/** Escape CSV cell (Excel-friendly). */
export function csvEscape(value: string | number | null | undefined) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: string[][]) {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
}
