import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@fotbal-fm/cache', () => ({
  cacheClearAll: vi.fn(async () => true),
  cacheDeletePattern: vi.fn(async () => 2),
  isValidWebhookSecret: (provided: string | null, expected: string | undefined) => !!provided && provided === expected,
}));

const { cacheClearAll, cacheDeletePattern } = await import('@fotbal-fm/cache');
const { POST } = await import('@/app/api/cache/clear/route');

function webhook(body: unknown, secret = 'test-secret') {
  return new NextRequest('http://web/api/cache/clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Strapi-Webhook-Signature': secret },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/cache/clear (Strapi webhook)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRAPI_WEBHOOK_SECRET = 'test-secret';
  });

  it('rejects a bad secret', async () => {
    const res = await POST(webhook({ model: 'news-article' }, 'wrong'));
    expect(res.status).toBe(401);
    expect(cacheClearAll).not.toHaveBeenCalled();
  });

  it('flushes everything for ordinary content', async () => {
    const res = await POST(webhook({ event: 'entry.update', model: 'news-article', uid: 'api::news-article.news-article' }));
    expect(await res.json()).toEqual({ cleared: true });
    expect(cacheClearAll).toHaveBeenCalledTimes(1);
  });

  it('flushes everything when the payload cannot be read', async () => {
    const res = await POST(webhook('not json'));
    expect(await res.json()).toEqual({ cleared: true });
    expect(cacheClearAll).toHaveBeenCalledTimes(1);
  });

  it('never flushes the site for a deep-link claim', async () => {
    const res = await POST(webhook({ event: 'entry.create', model: 'deep-link-claim' }));
    expect(await res.json()).toEqual({ cleared: false, model: 'deep-link-claim', deleted: 0 });
    expect(cacheClearAll).not.toHaveBeenCalled();
    expect(cacheDeletePattern).not.toHaveBeenCalled();
  });

  it('invalidates only the landing-page keys for deep links and audience categories', async () => {
    await POST(webhook({ event: 'entry.update', model: 'deep-link' }));
    expect(cacheDeletePattern).toHaveBeenCalledWith('deep-link:*');

    await POST(webhook({ event: 'entry.update', model: 'audience-category' }));
    expect(cacheDeletePattern).toHaveBeenCalledWith('audience-categories:*');
    expect(cacheClearAll).not.toHaveBeenCalled();
  });
});
