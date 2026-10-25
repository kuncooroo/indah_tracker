import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveDeliveredAt } from "./tracking.ts";

describe("resolveDeliveredAt", () => {
  const earlier = new Date("2026-10-01T00:00:00.000Z");
  const now = new Date("2026-10-25T11:00:00.000Z");

  it("keeps the original timestamp when a delivered shipment is edited", () => {
    assert.equal(resolveDeliveredAt("DELIVERED", "DELIVERED", earlier, now), earlier);
  });

  it("stamps now when the shipment first becomes delivered", () => {
    assert.equal(resolveDeliveredAt("IN_TRANSIT", "DELIVERED", null, now), now);
  });

  it("stamps now if a delivered shipment has no timestamp yet", () => {
    assert.equal(resolveDeliveredAt("DELIVERED", "DELIVERED", null, now), now);
  });

  it("clears the timestamp when the shipment leaves delivered", () => {
    assert.equal(resolveDeliveredAt("DELIVERED", "CANCELLED", earlier, now), null);
  });

  it("does not invent a delivery time for other statuses", () => {
    assert.equal(resolveDeliveredAt("CREATED", "IN_PROGRESS", null, now), null);
  });
});
