/**
 * Best-effort in-memory rate limit for serverless (per instance).
 * Blocks abusive bursts; pair with client debouncing for UX.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 45;
const buckets = new Map<string, { count: number; windowStart: number }>();

export function checkSearchRateLimit(ip: string): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b || now - b.windowStart > WINDOW_MS) {
    buckets.set(ip, { count: 1, windowStart: now });
    return { ok: true };
  }
  if (b.count >= MAX_PER_WINDOW) {
    const retryAfterSec = Math.ceil((WINDOW_MS - (now - b.windowStart)) / 1000);
    return { ok: false, retryAfterSec };
  }
  b.count += 1;
  return { ok: true };
}

export function clientIpFromHeaders(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    return xff.split(",")[0]?.trim() || "unknown";
  }
  return h.get("x-real-ip") || "unknown";
}
