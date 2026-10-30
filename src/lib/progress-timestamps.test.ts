import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveCompletedAt } from "./progress-timestamps.ts";

describe("resolveCompletedAt", () => {
  const earlier = new Date("2026-10-01T02:00:00.000Z");
  const now = new Date("2026-10-30T11:00:00.000Z");

  it("keeps the original timestamp when a finished task is saved again", () => {
    assert.equal(
      resolveCompletedAt("COMPLETED", "COMPLETED", earlier, now),
      earlier
    );
  });

  it("stamps now the first time a task is completed", () => {
    assert.equal(
      resolveCompletedAt("COMPLETED", "IN_PROGRESS", null, now),
      now
    );
  });

  it("stamps now if a finished task has no timestamp yet", () => {
    assert.equal(
      resolveCompletedAt("COMPLETED", "COMPLETED", null, now),
      now
    );
  });

  it("clears the timestamp when the task leaves completed", () => {
    assert.equal(
      resolveCompletedAt("IN_PROGRESS", "COMPLETED", earlier, now),
      null
    );
  });

  it("does not invent a completion time for unfinished work", () => {
    assert.equal(
      resolveCompletedAt("NOT_STARTED", "NOT_STARTED", null, now),
      null
    );
  });
});
