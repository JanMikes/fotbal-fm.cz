import { describe, it, expect, vi, beforeEach } from 'vitest';

// D-V4: the form rate limiter (5 submissions per IP per 10 min) sets the counter and its TTL in one
// MULTI, so a key can never live without a TTL (volatile-lru would never evict it: that IP refused
// forever). The fake models Redis' INCR / EXPIRE NX semantics; it has no standalone incr/expire, so
// any command outside the transaction fails the test.

class FakeRedis {
  keys = new Map<string, { value: number; ttl?: number }>();
  failExec: Error | null = null;
  multi() {
    const ops: (() => [Error | null, unknown])[] = [];
    const chain = {
      incr: (key: string) => {
        ops.push(() => {
          const entry = this.keys.get(key) ?? { value: 0 };
          entry.value += 1;
          this.keys.set(key, entry);
          return [null, entry.value];
        });
        return chain;
      },
      expire: (key: string, seconds: number, flag?: 'NX') => {
        ops.push(() => {
          const entry = this.keys.get(key);
          if (!entry || (flag === 'NX' && entry.ttl !== undefined)) return [null, 0];
          entry.ttl = seconds;
          return [null, 1];
        });
        return chain;
      },
      exec: async () => {
        if (this.failExec) throw this.failExec;
        return ops.map((op) => op());
      },
    };
    return chain;
  }
}

let fake: FakeRedis | null = new FakeRedis();
vi.mock('@fotbal-fm/cache', () => ({ getRedisClient: vi.fn(async () => fake) }));
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn() }));

const { POST } = await import('@/app/api/form/submit/route');

const submit = (ip = '203.0.113.7') =>
  POST(new Request('http://localhost/api/form/submit', { method: 'POST', headers: { 'x-forwarded-for': ip }, body: new FormData() }));

beforeEach(() => {
  fake = new FakeRedis();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('form submit rate limit', () => {
  it('allows 5 submissions per IP, refuses the 6th with 429 (an empty form is a 400 past the limiter)', async () => {
    for (let i = 0; i < 5; i++) expect((await submit()).status).toBe(400);
    expect((await submit()).status).toBe(429);
    expect((await submit('198.51.100.1')).status).toBe(400); // another IP has its own window
  });

  it('the first submission creates the counter WITH its 10-min TTL, in the same transaction', async () => {
    await submit();
    expect(fake!.keys.get('form-rate:203.0.113.7')).toEqual({ value: 1, ttl: 600 });
  });

  it('the window is fixed: later submissions do not extend the TTL', async () => {
    await submit();
    fake!.keys.get('form-rate:203.0.113.7')!.ttl = 42; // time passed
    await submit();
    expect(fake!.keys.get('form-rate:203.0.113.7')).toEqual({ value: 2, ttl: 42 });
  });

  it('a key left without a TTL (the old INCR-then-EXPIRE code) gets one on the next submission', async () => {
    fake!.keys.set('form-rate:203.0.113.7', { value: 9 });
    expect((await submit()).status).toBe(429);
    expect(fake!.keys.get('form-rate:203.0.113.7')).toEqual({ value: 10, ttl: 600 });
  });

  it('a failed transaction (Redis command timeout) or no Redis lets the submission through', async () => {
    fake!.failExec = new Error('Command timed out');
    expect((await submit()).status).toBe(400);
    expect(console.error).toHaveBeenCalledWith('[Form Submit] Rate limit check failed, allowing:', 'Command timed out');
    fake = null;
    expect((await submit()).status).toBe(400);
  });
});
