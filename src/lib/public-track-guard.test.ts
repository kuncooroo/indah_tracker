import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { rateLimit, rateLimitPinned } from "./rate-limit.ts";
import { generateTrackingNumber, publicPhoneAttemptKey } from "./tracking.ts";

test("phone verification is limited per tracking code, not per client IP", () => {
  const key = publicPhoneAttemptKey("  im-trk-20261026-abcd  ");
  assert.equal(key, "track:phone:IM-TRK-20261026-ABCD");
  assert.deepEqual(key.split(":"), ["track", "phone", "IM-TRK-20261026-ABCD"]);

  const opts = { limit: 3, windowMs: 60_000 };
  const isolated = `track:phone:${randomUUID()}`;
  assert.equal(rateLimitPinned(isolated, opts).ok, true);
  assert.equal(rateLimitPinned(isolated, opts).ok, true);
  assert.equal(rateLimitPinned(isolated, opts).ok, true);
  assert.equal(rateLimitPinned(isolated, opts).ok, false);

  for (let i = 0; i < 6_000; i++) {
    rateLimit(`track:ip:203.0.113.${i % 250}-${i}`, { limit: 60, windowMs: 60_000 });
  }

  assert.equal(rateLimitPinned(isolated, opts).ok, false);
});

test("new tracking numbers are not a 4-digit daily sequence", () => {
  const issued = new Set<string>();
  for (let i = 0; i < 30; i++) {
    const trackingNumber = generateTrackingNumber();
    assert.match(trackingNumber, /^IM-TRK-\d{8}-[0-9A-F]{8}$/);
    issued.add(trackingNumber);
  }
  assert.equal(issued.size, 30);
  assert.match(generateTrackingNumber(1), /-0001$/);
});
