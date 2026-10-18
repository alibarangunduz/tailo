import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit, rateLimitedResponse } from '@/lib/rate-limit';

// The limiter's state is module-level, so each test uses its own bucket name.
let bucket = 0;
const nextBucket = () => `test-${++bucket}`;
const config = { limit: 3, windowMs: 60_000 };

describe('checkRateLimit', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('allows up to the limit, then blocks', () => {
    const b = nextBucket();
    expect([1, 2, 3].map(() => checkRateLimit(b, 'u1', config).ok)).toEqual([true, true, true]);
    expect(checkRateLimit(b, 'u1', config)).toEqual({ ok: false, retryAfterSeconds: 60 });
  });

  it('counts users independently', () => {
    const b = nextBucket();
    for (let i = 0; i < 3; i++) checkRateLimit(b, 'u1', config);
    expect(checkRateLimit(b, 'u1', config).ok).toBe(false);
    expect(checkRateLimit(b, 'u2', config).ok).toBe(true);
  });

  it('counts buckets independently', () => {
    const a = nextBucket();
    const b = nextBucket();
    for (let i = 0; i < 3; i++) checkRateLimit(a, 'u1', config);
    expect(checkRateLimit(b, 'u1', config).ok).toBe(true);
  });

  it('reports the remaining wait and resets after the window', () => {
    const b = nextBucket();
    for (let i = 0; i < 3; i++) checkRateLimit(b, 'u1', config);
    vi.advanceTimersByTime(45_500);
    expect(checkRateLimit(b, 'u1', config)).toEqual({ ok: false, retryAfterSeconds: 15 });
    vi.advanceTimersByTime(14_500);
    expect(checkRateLimit(b, 'u1', config).ok).toBe(true);
  });
});

describe('rateLimitedResponse', () => {
  it('returns null while allowed and a 429 with Retry-After once over', async () => {
    const b = nextBucket();
    const tight = { limit: 1, windowMs: 10_000 };
    expect(rateLimitedResponse(b, 'u1', tight)).toBeNull();
    const res = rateLimitedResponse(b, 'u1', tight)!;
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(await res.json()).toHaveProperty('error');
  });
});
