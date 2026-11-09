import { describe, it, expect, vi } from 'vitest';
import listing from '../fixtures/wboost-listing-rows.json';

vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('@/lib/config', () => ({
  getWboostConfig: vi.fn().mockReturnValue({
    apiBase: 'http://wboost.test',
    clientId: 'cid',
    clientSecret: 'secret',
    projectId: 'proj1',
    thumbnailsEnabled: false,
  }),
  isWboostConfigured: vi.fn().mockReturnValue(true),
}));

const { SocialExportService } = await import('@/lib/services/social-export.service');
const { unionHidableContainers, containerLabel } = await import('@/lib/social-export/container-hides');

/**
 * The fixture is the REAL prod listing (Fotbal FM, 2026-11-09) of the two
 * repeatable-row templates, store URLs scrubbed. Prod has no hidable
 * container yet, so the hide tests flip one on — the key set stays exactly
 * what WBoost sends.
 */
type RawTemplate = (typeof listing)[number];

function clone(): RawTemplate[] {
  return JSON.parse(JSON.stringify(listing)) as RawTemplate[];
}

async function mapped(raw: RawTemplate[]) {
  const client = { listTemplates: vi.fn().mockResolvedValue(raw) };
  const result = await new SocialExportService(client as never).getTemplates();
  if (!result.success) throw new Error('getTemplates failed');
  return result.data;
}

describe('listing mapping against a real WBoost payload', () => {
  it('keeps a container\'s `hidable` + `name` so its "hide the whole group" toggle can appear', async () => {
    const raw = clone();
    const tournament = raw.find((t) => t.name === 'Výsledky turnaje')!;
    const block = tournament.variants[0].containers.find((c) => c.id === 'text-blok')!;
    block.hidable = true;
    (block as { name: string | null }).name = 'Sestava';

    const [variant] = (await mapped(raw)).find((t) => t.name === 'Výsledky turnaje')!.variants;
    const container = variant.containers.find((c) => c.id === 'text-blok')!;

    expect(container.hidable).toBe(true);
    expect(container.name).toBe('Sestava');
    // The toggle list the editor renders (ContainerHideToggles).
    const toggles = unionHidableContainers([variant]);
    expect(toggles.map((c) => c.id)).toEqual(['text-blok']);
    expect(containerLabel(toggles[0], 0)).toBe('Sestava');
  });

  it('maps `hidable: false` / `name: null` as sent (no toggle)', async () => {
    const [variant] = (await mapped(clone())).find((t) => t.name === 'Výsledky turnaje')!.variants;
    const block = variant.containers.find((c) => c.id === 'text-blok')!;
    expect(block.hidable).toBe(false);
    expect(block.name).toBeNull();
  });

  it('keeps the image-slot membership of a container', async () => {
    const raw = clone();
    const tournament = raw.find((t) => t.name === 'Výsledky turnaje')!;
    const block = tournament.variants[0].containers.find((c) => c.id === 'text-blok')!;
    (block as { memberImageInputIds: string[] }).memberImageInputIds = ['slot-x'];

    const [variant] = (await mapped(raw)).find((t) => t.name === 'Výsledky turnaje')!.variants;
    expect(variant.containers.find((c) => c.id === 'text-blok')!.memberImageInputIds).toEqual(['slot-x']);
  });
});
