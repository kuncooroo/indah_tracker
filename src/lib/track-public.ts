import type { TrackLocale } from "@/lib/track-i18n";
import { formatRelativeLocale, getTrackDict } from "@/lib/track-i18n";

export function getTrackStepperSteps(locale: TrackLocale = "id") {
  const steps = getTrackDict(locale).steps;
  return [
    { key: "CREATED" as const, ...steps.CREATED },
    { key: "IN_PROGRESS" as const, ...steps.IN_PROGRESS },
    { key: "QUALITY_CHECK" as const, ...steps.QUALITY_CHECK },
    { key: "READY_TO_SHIP" as const, ...steps.READY_TO_SHIP },
    { key: "IN_TRANSIT" as const, ...steps.IN_TRANSIT },
    { key: "DELIVERED" as const, ...steps.DELIVERED },
  ];
}

/** Default ID steps (static consumers). */
export const TRACK_STEPPER_STEPS = getTrackStepperSteps("id");

const ORDER = [
  "CREATED",
  "IN_PROGRESS",
  "QUALITY_CHECK",
  "READY_TO_SHIP",
  "IN_TRANSIT",
  "DELIVERED",
] as const;

/** Index step aktif; CANCELLED = -1 */
export function stepperIndex(status: string): number {
  if (status === "CANCELLED") return -1;
  const idx = ORDER.indexOf(status as (typeof ORDER)[number]);
  return idx >= 0 ? idx : 0;
}

export function formatRelativeId(
  date: Date | string | null | undefined,
  locale: TrackLocale = "id"
) {
  return formatRelativeLocale(date, locale);
}
