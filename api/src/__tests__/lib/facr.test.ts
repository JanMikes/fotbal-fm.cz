import { describe, it, expect } from 'vitest';
import { parseRocnikOptions, resolveRocnikValue, getSeasonStartDate } from '../../lib/facr.js';
import { parseSeasonArg } from '../../lib/cli-args.js';

const ROCNIK_HTML = `
<form>
<select name="ctl00$MainContent$listSearchRocnik" id="MainContent_listSearchRocnik">
  <option selected="selected" value="19">2026</option>
  <option value="18">2025</option>
  <option value="16">2024</option>
  <option value="14">2023</option>
</select>
</form>
`;

describe('parseRocnikOptions', () => {
  it('parses dropdown options with selected flag', () => {
    const options = parseRocnikOptions(ROCNIK_HTML);
    expect(options).toEqual([
      { value: '19', text: '2026', selected: true },
      { value: '18', text: '2025', selected: false },
      { value: '16', text: '2024', selected: false },
      { value: '14', text: '2023', selected: false },
    ]);
  });

  it('returns empty array when select is missing', () => {
    expect(parseRocnikOptions('<html><body>nothing</body></html>')).toEqual([]);
  });
});

describe('resolveRocnikValue', () => {
  it('returns the selected option without explicit season', () => {
    expect(resolveRocnikValue(ROCNIK_HTML)).toBe('19');
  });

  it('resolves a specific season start year to its dropdown value', () => {
    expect(resolveRocnikValue(ROCNIK_HTML, 2025)).toBe('18');
    expect(resolveRocnikValue(ROCNIK_HTML, 2024)).toBe('16');
  });

  it('throws for a season missing from the dropdown', () => {
    expect(() => resolveRocnikValue(ROCNIK_HTML, 2010)).toThrow(/not found/);
  });

  it('throws when the dropdown cannot be parsed', () => {
    expect(() => resolveRocnikValue('<html></html>')).toThrow(/dropdown/);
  });
});

describe('getSeasonStartDate', () => {
  it('formats an explicit season start year as 1st July', () => {
    expect(getSeasonStartDate(2026)).toBe('01.07.2026');
    expect(getSeasonStartDate(2025)).toBe('01.07.2025');
  });
});

describe('parseSeasonArg', () => {
  it('parses --season with space-separated value', () => {
    expect(parseSeasonArg(['node', 'script.ts', '--season', '2026'])).toBe(2026);
  });

  it('parses --season=YYYY form', () => {
    expect(parseSeasonArg(['node', 'script.ts', '--season=2025'])).toBe(2025);
  });

  it('returns undefined when flag is absent', () => {
    expect(parseSeasonArg(['node', 'script.ts', '--from-file'])).toBeUndefined();
  });

  it('throws on invalid values', () => {
    expect(() => parseSeasonArg(['node', 'script.ts', '--season', 'abc'])).toThrow(/Invalid/);
    expect(() => parseSeasonArg(['node', 'script.ts', '--season'])).toThrow(/Invalid/);
  });
});
