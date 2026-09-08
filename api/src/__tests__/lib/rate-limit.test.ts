import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRateLimiter } from '../../lib/rate-limit.js';

describe('createRateLimiter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows `limit` calls per window and blocks the next one', () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 1000 });
    expect(limiter.check('a')).toBe(true);
    expect(limiter.check('a')).toBe(true);
    expect(limiter.check('a')).toBe(true);
    expect(limiter.check('a')).toBe(false);
    expect(limiter.check('b')).toBe(true);
  });

  it('starts a fresh window once the previous one has passed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-08T12:00:00Z'));
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.check('a')).toBe(true);
    expect(limiter.check('a')).toBe(false);
    vi.setSystemTime(new Date('2026-09-08T12:00:01.001Z'));
    expect(limiter.check('a')).toBe(true);
  });

  it('reset() clears all counters', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.check('a')).toBe(true);
    limiter.reset();
    expect(limiter.check('a')).toBe(true);
  });
});
