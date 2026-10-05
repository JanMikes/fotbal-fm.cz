import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// S7: the transitional Strapi webhook target bumps the written type's tags (data cache v2), never
// flushes. The real type → tags map is used.

vi.mock('@fotbal-fm/cache', () => ({
  bumpTags: vi.fn(async () => true),
  isValidWebhookSecret: (provided: string | null, expected: string | undefined) => !!provided && provided === expected,
}));

const { bumpTags } = await import('@fotbal-fm/cache');
const { POST } = await import('@/app/api/cache/clear/route');

function webhook(body: unknown, secret = 'test-secret') {
  return new NextRequest('http://web/api/cache/clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Strapi-Webhook-Signature': secret },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/cache/clear (transitional Strapi webhook target)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env.STRAPI_WEBHOOK_SECRET = 'test-secret';
  });

  it('rejects a bad secret', async () => {
    const res = await POST(webhook({ model: 'news-article' }, 'wrong'));
    expect(res.status).toBe(401);
    expect(bumpTags).not.toHaveBeenCalled();
  });

  it('bumps only the written type\'s tags', async () => {
    const res = await POST(webhook({ event: 'entry.update', model: 'news-article', uid: 'api::news-article.news-article' }));
    expect(await res.json()).toEqual({ model: 'api::news-article.news-article', tags: ['news-article'], bumped: true });
    expect(bumpTags).toHaveBeenCalledWith(['news-article']);
  });

  it('builds the uid from `model` when the payload has none', async () => {
    await POST(webhook({ event: 'entry.update', model: 'match' }));
    expect(bumpTags).toHaveBeenCalledWith(['match']);
  });

  it('category-code writes bump match + standing (codes map competitions to categories)', async () => {
    await POST(webhook({ event: 'entry.update', model: 'category-code', uid: 'api::category-code.category-code' }));
    expect(bumpTags).toHaveBeenCalledWith(['match', 'standing']);
  });

  it.each(['deep-link-claim', 'social-export-state', 'comment', 'event'])('%s (not read by the web) bumps nothing', async (model) => {
    const res = await POST(webhook({ event: 'entry.create', model, uid: `api::${model}.${model}` }));
    expect((await res.json()).tags).toEqual([]);
    expect(bumpTags).toHaveBeenCalledWith([]);
  });

  it('an unmapped api:: type bumps `all`', async () => {
    await POST(webhook({ event: 'entry.create', uid: 'api::brand-new.brand-new' }));
    expect(bumpTags).toHaveBeenCalledWith(['all']);
  });

  it('an unparsable payload bumps `all`', async () => {
    await POST(webhook('not json'));
    expect(bumpTags).toHaveBeenCalledWith(['all']);
  });

  it('answers 503 when Redis is unavailable (the bump did not happen)', async () => {
    vi.mocked(bumpTags).mockResolvedValueOnce(false);
    const res = await POST(webhook({ uid: 'api::page.page' }));
    expect(res.status).toBe(503);
  });
});
