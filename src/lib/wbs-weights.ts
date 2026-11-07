/** Pure WBS weight helpers — safe for client + server. */

/** Satu shift workshop. Dipakai untuk mengubah jam pengerjaan menjadi hari kerja. */
export const WORK_HOURS_PER_DAY = 8;
/** Satu baris WBS boleh mencakup pengerjaan beberapa hari (maks 10 hari kerja). */
export const MAX_SUB_HOURS = WORK_HOURS_PER_DAY * 10;
/** Toleransi Σ bobot parent vs 100% (pembulatan 2 desimal). */
export const WEIGHT_SUM_TOLERANCE = 0.05;

export function clampHours(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.min(MAX_SUB_HOURS, Math.max(0, Math.round(value)));
}

export function workDaysFromHours(hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.max(1, Math.round(hours / WORK_HOURS_PER_DAY));
}

/** "40 jam · 5 hari kerja", atau "8 jam" bila masih dalam satu shift. */
export function hourEstimatePhrase(
  hours: number | null | undefined,
  fallback = WORK_HOURS_PER_DAY
): string {
  const h = hours == null || !Number.isFinite(Number(hours)) ? fallback : Number(hours);
  if (h <= WORK_HOURS_PER_DAY) return `${h} jam`;
  const days = workDaysFromHours(h);
  return `${h} jam · ${days} hari kerja`;
}

type PhaseHours = {
  estimatedHours?: number | null;
  children: { estimatedHours?: number | null }[];
};

export function phaseShopHours(parent: PhaseHours): number {
  if (parent.children.length === 0) return parent.estimatedHours ?? 0;
  return parent.children.reduce((sum, child) => sum + (child.estimatedHours ?? 0), 0);
}

/** True bila ada baris yang lebih dari satu shift — estimasi durasi bengkel, bukan bobot ≤8 jam. */
export function usesMultiDayEstimate(parent: PhaseHours): boolean {
  const lines =
    parent.children.length > 0
      ? parent.children.map((child) => child.estimatedHours ?? 0)
      : [parent.estimatedHours ?? 0];
  return lines.some((hours) => hours > WORK_HOURS_PER_DAY);
}

/**
 * Hari fase saat template diterapkan.
 * Template lama (semua sub-tugas ≤ 1 shift) tetap memakai bagi rata `estimatedDays`.
 */
export function phaseDurationDays(parent: PhaseHours, fallbackDays: number): number {
  if (!usesMultiDayEstimate(parent)) return fallbackDays;
  return workDaysFromHours(phaseShopHours(parent));
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function distributeWeights(parentCount: number, childCounts: number[]) {
  if (parentCount <= 0) return { parentWeights: [] as number[], childWeights: [] as number[][] };
  const parentWeight = round2(100 / parentCount);
  const parentWeights = Array.from({ length: parentCount }, (_, i) =>
    i === parentCount - 1 ? round2(100 - parentWeight * (parentCount - 1)) : parentWeight
  );
  const childWeights = parentWeights.map((pw, i) => {
    const n = childCounts[i] ?? 0;
    if (n <= 0) return [] as number[];
    const each = round2(pw / n);
    return Array.from({ length: n }, (_, j) =>
      j === n - 1 ? round2(pw - each * (n - 1)) : each
    );
  });
  return { parentWeights, childWeights };
}

export type WeightCheck = {
  sum: number;
  ok: boolean;
  delta: number;
};

/** Validasi Σ bobot parent ≈ 100%. */
export function validateParentWeights(
  parentWeights: Array<number | string | { toNumber?: () => number }>,
  tol = WEIGHT_SUM_TOLERANCE
): WeightCheck {
  const sum = round2(
    parentWeights.reduce<number>((acc, w) => {
      let n: number;
      if (typeof w === "object" && w && typeof w.toNumber === "function") {
        n = w.toNumber();
      } else {
        n = Number(w);
      }
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0)
  );
  const delta = round2(sum - 100);
  return { sum, ok: Math.abs(delta) <= tol, delta };
}

export type TemplatePreviewParent = {
  title: string;
  weightPercent: number;
  children: { title: string; weightPercent: number; estimatedHours: number | null }[];
};

/** Preview bobot merata sebelum apply template. */
export function previewTemplateWeights(
  parents: Array<{
    title: string;
    children: Array<{ title: string; estimatedHours: number | null }>;
  }>
): { parents: TemplatePreviewParent[]; weightCheck: WeightCheck } {
  const childCounts = parents.map((p) => p.children.length);
  const { parentWeights, childWeights } = distributeWeights(parents.length, childCounts);
  const previewParents: TemplatePreviewParent[] = parents.map((p, i) => ({
    title: p.title,
    weightPercent: parentWeights[i] ?? 0,
    children: p.children.map((c, j) => ({
      title: c.title,
      weightPercent: childWeights[i]?.[j] ?? 0,
      estimatedHours: clampHours(c.estimatedHours ?? 8),
    })),
  }));
  return {
    parents: previewParents,
    weightCheck: validateParentWeights(parentWeights),
  };
}
