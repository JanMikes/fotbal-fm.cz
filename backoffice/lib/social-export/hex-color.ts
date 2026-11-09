/**
 * Free-colour hex entry (the "Vlastní barva" fields). Safari's native
 * `<input type="color">` has no hex field, so every free picker also takes a
 * typed / pasted hex: `#RRGGBB`, `RRGGBB`, `#RGB` or `RGB` (surrounding spaces
 * ok) → lower-case `#rrggbb`; anything else → null.
 */
export function parseHexColor(value: string): string | null {
  let hex = value.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toLowerCase()}` : null;
}
