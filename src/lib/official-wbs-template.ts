import type { PrismaClient } from "@prisma/client";
import { workDaysFromHours } from "./wbs-weights";

/**
 * Format resmi CV Indah Mesin.
 * Jam = durasi pengerjaan satu kru untuk 1 unit standar (8 jam = 1 hari kerja), berurutan:
 * fabrikasi bejana berat 4–5 hari, jacket/kaki/casing 2–3 hari, pintu 4 hari,
 * troli 2 hari, keranjang 3 hari, pipa utilitas 1–2 hari, instrumen 1 hari,
 * panel control 3 hari, kalibrasi 2 hari.
 */
export const OFFICIAL_WBS_TEMPLATE_NAME = "WBS Resmi CV Indah Mesin";

export type OfficialWbsPhase = {
  title: string;
  /** Jam untuk fase tanpa sub-tugas. */
  hours?: number;
  children: { title: string; hours: number }[];
};

export const OFFICIAL_WBS_PHASES: OfficialWbsPhase[] = [
  {
    title: "Boiler",
    children: [
      { title: "Boiler dalam", hours: 40 },
      { title: "Boiler luar", hours: 24 },
      { title: "Kaki boiler", hours: 16 },
    ],
  },
  {
    title: "Chamber",
    children: [
      { title: "Body", hours: 40 },
      { title: "Casing", hours: 16 },
      { title: "Pintu", hours: 32 },
      { title: "Kaki", hours: 16 },
    ],
  },
  {
    title: "Troli dan Keranjang",
    children: [
      { title: "Troli", hours: 16 },
      { title: "Keranjang", hours: 24 },
    ],
  },
  {
    title: "Pipa dan Instrumen",
    children: [
      { title: "Pipa steam", hours: 16 },
      { title: "Pipa air", hours: 16 },
      { title: "Pipa angin", hours: 8 },
      { title: "Water level", hours: 8 },
      { title: "Instrumen steam", hours: 8 },
      { title: "Instrumen air", hours: 8 },
      { title: "Instrumen angin", hours: 8 },
      { title: "Panel control", hours: 24 },
    ],
  },
  {
    title: "Kalibrasi",
    hours: 16,
    children: [],
  },
];

export function officialPhaseHours(phase: OfficialWbsPhase): number {
  if (phase.children.length === 0) return phase.hours ?? 0;
  return phase.children.reduce((sum, child) => sum + child.hours, 0);
}

export function officialWbsEstimatedDays(): number {
  return OFFICIAL_WBS_PHASES.reduce(
    (sum, phase) => sum + workDaysFromHours(officialPhaseHours(phase)),
    0
  );
}

export function officialWbsDescription(): string {
  const days = officialWbsEstimatedDays();
  return `Format resmi CV Indah Mesin: Boiler, Chamber, Troli dan Keranjang, Pipa dan Instrumen, Kalibrasi. Estimasi ${days} hari kerja untuk 1 unit standar — satu kru workshop, 8 jam/hari, fase dikerjakan berurutan.`;
}

/** Buat atau timpa template resmi tanpa menghapus template lain. */
export async function upsertOfficialWbsTemplate(db: PrismaClient): Promise<"created" | "updated"> {
  const estimatedDays = officialWbsEstimatedDays();
  const description = officialWbsDescription();
  const existing = await db.wbsTemplate.findFirst({
    where: { name: OFFICIAL_WBS_TEMPLATE_NAME },
    select: { id: true },
  });

  const template = existing
    ? await db.wbsTemplate.update({
        where: { id: existing.id },
        data: { description, estimatedDays, active: true },
      })
    : await db.wbsTemplate.create({
        data: {
          name: OFFICIAL_WBS_TEMPLATE_NAME,
          description,
          estimatedDays,
          active: true,
        },
      });

  if (existing) {
    await db.wbsTemplateItem.deleteMany({ where: { templateId: template.id } });
  }

  for (let i = 0; i < OFFICIAL_WBS_PHASES.length; i++) {
    const phase = OFFICIAL_WBS_PHASES[i];
    const parent = await db.wbsTemplateItem.create({
      data: {
        templateId: template.id,
        title: phase.title,
        sortOrder: i,
        estimatedHours: phase.children.length === 0 ? (phase.hours ?? null) : null,
      },
    });
    for (let j = 0; j < phase.children.length; j++) {
      const child = phase.children[j];
      await db.wbsTemplateItem.create({
        data: {
          templateId: template.id,
          parentId: parent.id,
          title: child.title,
          sortOrder: j,
          estimatedHours: child.hours,
        },
      });
    }
  }

  return existing ? "updated" : "created";
}
