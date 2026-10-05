import { describe, it, expect, vi } from 'vitest';

// Every page must stay request-rendered. Before Phase 0 that followed implicitly from each
// render making a `no-store` Strapi fetch; the data layer can now answer from memory
// (single-flight, failure memo), and a build without Strapi then prerendered `/` statically
// with the empty fallback baked in. The root layout pins it explicitly.

vi.mock('next/font/google', () => ({ Montserrat: () => ({ variable: '--font-montserrat' }) }));
vi.mock('next/script', () => ({ default: () => null }));
vi.mock('@/components/layout', () => ({ Header: () => null, Footer: () => null }));
vi.mock('@/components/ScrollToTop', () => ({ ScrollToTop: () => null }));
vi.mock('@/lib/strapi/data', () => ({}));

describe('root layout', () => {
  it('forces dynamic rendering for every page', async () => {
    const layout = await import('@/app/layout');
    expect(layout.dynamic).toBe('force-dynamic');
  });
});
