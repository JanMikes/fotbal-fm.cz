import { describe, it, expect } from 'vitest';
import type { Match } from '@/types/match';
import type { TemplateInputDTO } from '@/lib/social-export/api-types';
import {
  normalizeName,
  extractMatchPrefill,
  getMatchChips,
} from '@/lib/social-export/prefill';

// ---------- Test fixture -----------------------------------------------------

const baseMatch: Match = {
  id: 'm1',
  homeTeam: 'FK Fotbal FM',
  awayTeam: 'SK Soupeř',
  homeTeamLogo: null,
  awayTeamLogo: null,
  homeScore: 2,
  awayScore: 1,
  homeGoalscorers: 'Novák 23., Dvořák 67.',
  awayGoalscorers: 'Kratochvíl 11.',
  matchReport: '',
  lineup: '',
  images: [],
  files: [],
  categories: [{ id: '1', name: 'Muži A', slug: 'muzi-a', sortOrder: 1 }],
  matchDate: '2026-06-03',
  imagesUrl: '',
  authorId: 1,
  facrId: undefined,
  round: 15,
  venue: 'Fotbalový stadion',
  matchTime: '17:00:00',
  competitionName: 'Krajský přebor',
  tournamentId: undefined,
  tournamentName: undefined,
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-06-01T10:00:00.000Z',
};

/** A match with the rich free-text fields populated (lineup, report, tournament…). */
const richMatch: Match = {
  ...baseMatch,
  matchReport: 'Skvělý týmový výkon.',
  lineup: 'Brankář: Svoboda; Obrana: Novák, Dvořák',
  tournamentName: 'Pohár FAČR',
  season: 2026,
  period: 'podzim',
  organizingBody: 'OFS Frýdek-Místek',
  competitionCode: '2025A1A',
  facrId: '12345',
  imagesUrl: 'https://example.com/fotky',
  author: { id: 1, firstName: 'Jan', lastName: 'Novák' },
};

function makeInput(overrides: Partial<TemplateInputDTO> = {}): TemplateInputDTO {
  return {
    id: 'inp-default',
    name: null,
    maxLength: null,
    locked: false,
    uppercase: false,
    description: null,
    hidable: false,
    frame: null,
    containerId: null,
    textStyle: null,
    richText: false,
    lists: false,
    listStyle: null,
    listCheckboxes: false,
    checklist: null,
    sampleValue: null,
    layerIndex: null,
    fontOptions: null,
    ...overrides,
  };
}

// ---------- normalizeName ----------------------------------------------------

describe('normalizeName', () => {
  it("normalizes 'Skóre domácí' to 'skore domaci'", () => {
    expect(normalizeName('Skóre domácí')).toBe('skore domaci');
  });

  it('lowercases ASCII', () => {
    expect(normalizeName('DATUM')).toBe('datum');
  });

  it('strips diacritics and trims', () => {
    expect(normalizeName('  Čas výkopu  ')).toBe('cas vykopu');
  });

  it('collapses non-alphanumeric sequences to single space', () => {
    expect(normalizeName('A  -  B')).toBe('a b');
  });
});

// ---------- extractMatchPrefill ----------------------------------------------

describe('extractMatchPrefill', () => {
  it("maps input named 'Domácí' to homeTeam value", () => {
    const inputs = [makeInput({ id: 'i1', name: 'Domácí' })];
    const prefill = extractMatchPrefill(baseMatch, inputs);
    expect(prefill['i1']).toBe('FK Fotbal FM');
  });

  it("maps input named 'domaci tym' to homeTeam value (alias)", () => {
    const inputs = [makeInput({ id: 'i2', name: 'Domácí tým' })];
    const prefill = extractMatchPrefill(baseMatch, inputs);
    expect(prefill['i2']).toBe('FK Fotbal FM');
  });

  it("maps input named 'Skóre' to '2 : 1'", () => {
    const inputs = [makeInput({ id: 'i3', name: 'Skóre' })];
    const prefill = extractMatchPrefill(baseMatch, inputs);
    expect(prefill['i3']).toBe('2 : 1');
  });

  it("maps input named 'Datum' to formatted date", () => {
    const inputs = [makeInput({ id: 'i4', name: 'Datum' })];
    const prefill = extractMatchPrefill(baseMatch, inputs);
    expect(prefill['i4']).toBe('3. 6. 2026');
  });

  it('skips locked inputs', () => {
    const inputs = [makeInput({ id: 'i5', name: 'Domácí', locked: true })];
    const prefill = extractMatchPrefill(baseMatch, inputs);
    expect(prefill['i5']).toBeUndefined();
  });

  it('skips inputs with no name', () => {
    const inputs = [makeInput({ id: 'i6', name: null })];
    const prefill = extractMatchPrefill(baseMatch, inputs);
    expect(prefill['i6']).toBeUndefined();
  });

  it('skips inputs with unmatched names', () => {
    const inputs = [makeInput({ id: 'i7', name: 'Neznámé pole' })];
    const prefill = extractMatchPrefill(baseMatch, inputs);
    expect(prefill['i7']).toBeUndefined();
  });

  it('handles multiple inputs, mapping each correctly', () => {
    const inputs = [
      makeInput({ id: 'i-home', name: 'Domácí' }),
      makeInput({ id: 'i-away', name: 'Hosté' }),
      makeInput({ id: 'i-score', name: 'Skóre' }),
    ];
    const prefill = extractMatchPrefill(baseMatch, inputs);
    expect(prefill['i-home']).toBe('FK Fotbal FM');
    expect(prefill['i-away']).toBe('SK Soupeř');
    expect(prefill['i-score']).toBe('2 : 1');
  });

  it("maps input named 'Sestava' to the lineup value", () => {
    const inputs = [makeInput({ id: 'i-lineup', name: 'Sestava' })];
    const prefill = extractMatchPrefill(richMatch, inputs);
    expect(prefill['i-lineup']).toBe('Brankář: Svoboda; Obrana: Novák, Dvořák');
  });

  it("maps input named 'Komentář trenéra' to the match report value", () => {
    const inputs = [makeInput({ id: 'i-report', name: 'Komentář trenéra' })];
    const prefill = extractMatchPrefill(richMatch, inputs);
    expect(prefill['i-report']).toBe('Skvělý týmový výkon.');
  });

  it("maps alias 'Zápis o utkání' to the match report value", () => {
    const inputs = [makeInput({ id: 'i-report2', name: 'Zápis o utkání' })];
    const prefill = extractMatchPrefill(richMatch, inputs);
    expect(prefill['i-report2']).toBe('Skvělý týmový výkon.');
  });
});

// ---------- getMatchChips ----------------------------------------------------

describe('getMatchChips', () => {
  it('returns only non-empty fields in order', () => {
    const chips = getMatchChips(baseMatch);
    // All populated fields should appear; none with empty value
    for (const chip of chips) {
      expect(chip.value).not.toBe('');
    }
  });

  it('includes home_team chip with correct value', () => {
    const chips = getMatchChips(baseMatch);
    const homeChip = chips.find((c) => c.key === 'home_team');
    expect(homeChip).toBeDefined();
    expect(homeChip!.value).toBe('FK Fotbal FM');
    expect(homeChip!.label).toBe('Domácí');
  });

  it('includes score chip with formatted value', () => {
    const chips = getMatchChips(baseMatch);
    const scoreChip = chips.find((c) => c.key === 'score');
    expect(scoreChip).toBeDefined();
    expect(scoreChip!.value).toBe('2 : 1');
  });

  it('includes date chip with formatted value', () => {
    const chips = getMatchChips(baseMatch);
    const dateChip = chips.find((c) => c.key === 'date');
    expect(dateChip).toBeDefined();
    expect(dateChip!.value).toBe('3. 6. 2026');
  });

  it('excludes fields with empty value', () => {
    const matchWithoutScores: Match = {
      ...baseMatch,
      homeScore: null,
      awayScore: null,
    };
    const chips = getMatchChips(matchWithoutScores);
    const scoreChip = chips.find((c) => c.key === 'score');
    expect(scoreChip).toBeUndefined();
  });

  it('includes lineup and coach-comment chips when populated', () => {
    const chips = getMatchChips(richMatch);
    const lineup = chips.find((c) => c.key === 'lineup');
    const report = chips.find((c) => c.key === 'match_report');
    expect(lineup?.label).toBe('Sestava');
    expect(lineup?.value).toBe('Brankář: Svoboda; Obrana: Novák, Dvořák');
    expect(report?.label).toBe('Komentář trenéra');
    expect(report?.value).toBe('Skvělý týmový výkon.');
  });

  it('includes tournament/season/period chips when populated', () => {
    const chips = getMatchChips(richMatch);
    expect(chips.find((c) => c.key === 'tournament')?.value).toBe('Pohár FAČR');
    expect(chips.find((c) => c.key === 'season')?.value).toBe('2026');
    // 'podzim' is capitalized for display.
    expect(chips.find((c) => c.key === 'period')?.value).toBe('Podzim');
  });

  it('includes organizing-body / FAČR id / competition code / author / gallery link chips', () => {
    const chips = getMatchChips(richMatch);
    expect(chips.find((c) => c.key === 'organizing_body')?.value).toBe('OFS Frýdek-Místek');
    expect(chips.find((c) => c.key === 'facr_id')?.value).toBe('12345');
    expect(chips.find((c) => c.key === 'competition_code')?.value).toBe('2025A1A');
    expect(chips.find((c) => c.key === 'author')?.value).toBe('Jan Novák');
    expect(chips.find((c) => c.key === 'images_url')?.value).toBe('https://example.com/fotky');
  });

  it('omits lineup and coach-comment chips when empty (baseMatch)', () => {
    const chips = getMatchChips(baseMatch);
    expect(chips.find((c) => c.key === 'lineup')).toBeUndefined();
    expect(chips.find((c) => c.key === 'match_report')).toBeUndefined();
  });
});
