/**
 * In-memory sliding/fixed-window rate limiter.
 * Cocok untuk single-instance (Laragon / 1 VPS). Multi-instance → ganti ke Redis nanti.
 */

type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

const MAX_KEYS = 5_000;

function prune(now: number) {
  if (store.size < MAX_KEYS) return;
  for (const [key, bucket] of store) {
    if (now > bucket.resetAt) store.delete(key);
  }
  // Jika masih penuh, hapus entri terlama
  if (store.size >= MAX_KEYS) {
    const first = store.keys().next().value;
    if (first) store.delete(first);
  }
}

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
};

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  prune(now);

  let bucket = store.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + opts.windowMs };
    store.set(key, bucket);
  }

  bucket.count += 1;
  const remaining = Math.max(0, opts.limit - bucket.count);
  const ok = bucket.count <= opts.limit;
  const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

  return {
    ok,
    limit: opts.limit,
    remaining,
    resetAt: bucket.resetAt,
    retryAfterSec,
  };
}

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    ...(result.ok ? {} : { "Retry-After": String(result.retryAfterSec) }),
  };
}
