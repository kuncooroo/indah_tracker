/**
 * Keep the original completion time when a finished task is saved again.
 * A new completion stamps `now`. Leaving COMPLETED clears the timestamp.
 */
export function resolveCompletedAt(
  nextStatus: string,
  existingStatus: string,
  existingCompletedAt: Date | null | undefined,
  now: Date
): Date | null {
  if (nextStatus !== "COMPLETED") return null;
  if (existingStatus === "COMPLETED" && existingCompletedAt) return existingCompletedAt;
  return now;
}
