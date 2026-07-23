/**
 * Parse an optional `--season 2025` / `--season=2025` CLI argument.
 * The value is the season start year (2025 = season 2025/2026).
 * Returns undefined when the flag is absent (= current season).
 */
export function parseSeasonArg(argv: string[]): number | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    let value: string | undefined;
    if (arg === '--season') {
      value = argv[i + 1];
    } else if (arg.startsWith('--season=')) {
      value = arg.substring('--season='.length);
    } else {
      continue;
    }

    const year = Number(value);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new Error(`Invalid --season value: ${value ?? '(missing)'} (expected a start year, e.g. 2026)`);
    }
    return year;
  }
  return undefined;
}
