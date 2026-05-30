// Per-user request throttling (security hardening gap 7). A lightweight in-memory
// fixed-window limiter: enough to stop a signed-in user from looping an expensive
// endpoint (/api/tailor, /api/jobs/search) in a tight loop.
//
// Caveat: state lives in the process, so on a multi-instance or serverless
// deployment each instance counts independently. For production-grade global
// limits, back this with Upstash/Redis behind the same checkRateLimit signature;
// callers do not need to change.

interface Window {
  count: number;
  resetAt: number; // epoch ms when the current window expires
}

// Bucket name to per-user window. A bucket isolates one endpoint's limit from
// another's, so a tailor request does not consume a job-search allowance.
const buckets = new Map<string, Map<string, Window>>();

export interface RateLimitConfig {
  limit: number; // max requests per window
  windowMs: number; // window length in milliseconds
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number; // 0 when ok
}

// Records a hit for (bucket, key) and reports whether it is within the limit.
// Call once per request, after authentication, keyed by user id.
export function checkRateLimit(bucket: string, key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  let windows = buckets.get(bucket);
  if (!windows) {
    windows = new Map();
    buckets.set(bucket, windows);
  }

  const existing = windows.get(key);
  if (!existing || now >= existing.resetAt) {
    windows.set(key, { count: 1, resetAt: now + config.windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= config.limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}

// Convenience for route handlers: returns a ready 429 Response when the caller is
// over the limit, or null when the request may proceed.
export function rateLimitedResponse(
  bucket: string,
  key: string,
  config: RateLimitConfig,
): Response | null {
  const result = checkRateLimit(bucket, key, config);
  if (result.ok) return null;
  return Response.json(
    { error: 'Too many requests. Please slow down and try again shortly.' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } },
  );
}
