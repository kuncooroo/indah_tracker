/** Pure WBS weight helpers — safe for client + server. */

export const MAX_SUB_HOURS = 8;
/** Toleransi Σ bobot parent vs 100% (pembulatan 2 desimal). */
export const WEIGHT_SUM_TOLERANCE = 0.05;

export function clampHours(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.min(MAX_SUB_HOURS, Math.max(0, Math.round(value)));
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
