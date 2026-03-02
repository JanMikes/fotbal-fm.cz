import { describe, it, expect } from 'vitest';

// Import zod-init to set Czech locale before validation module
await import('../zod-init');

const {
  normalizeTimeForStrapi,
  loginSchema,
  registerSchema,
  matchSchema,
  changePasswordSchema,
  commentSchema,
} = await import('../validation');

describe('normalizeTimeForStrapi', () => {
  it('converts HH:mm to HH:mm:ss.000', () => {
    expect(normalizeTimeForStrapi('14:30')).toBe('14:30:00.000');
  });

  it('converts HH:mm:ss to HH:mm:ss.000', () => {
    expect(normalizeTimeForStrapi('14:30:45')).toBe('14:30:45.000');
  });

  it('converts 12h AM format', () => {
    expect(normalizeTimeForStrapi('2:30 PM')).toBe('14:30:00.000');
    expect(normalizeTimeForStrapi('12:00 AM')).toBe('00:00:00.000');
    expect(normalizeTimeForStrapi('12:00 PM')).toBe('12:00:00.000');
  });

  it('handles AM/PM with seconds', () => {
    expect(normalizeTimeForStrapi('2:30:15 pm')).toBe('14:30:15.000');
  });

  it('pads single-digit hours', () => {
    expect(normalizeTimeForStrapi('9:05')).toBe('09:05:00.000');
  });

  it('returns undefined for null', () => {
    expect(normalizeTimeForStrapi(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(normalizeTimeForStrapi(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(normalizeTimeForStrapi('')).toBeUndefined();
  });

  it('returns trimmed value for unrecognized format', () => {
    expect(normalizeTimeForStrapi('  invalid  ')).toBe('invalid');
  });
});

describe('loginSchema', () => {
  it('validates correct login data', () => {
    const result = loginSchema.safeParse({
      email: 'test@test.cz',
      password: 'heslo123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'invalid',
      password: 'heslo123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({
      email: 'test@test.cz',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('registerSchema', () => {
  const validData = {
    email: 'test@test.cz',
    password: 'Heslo123',
    firstName: 'Jan',
    lastName: 'Novák',
    jobTitle: 'Trenér',
  };

  it('validates correct registration data', () => {
    const result = registerSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('rejects short password', () => {
    const result = registerSchema.safeParse({ ...validData, password: 'Aa1' });
    expect(result.success).toBe(false);
  });

  it('rejects password without uppercase', () => {
    const result = registerSchema.safeParse({ ...validData, password: 'heslo123' });
    expect(result.success).toBe(false);
  });

  it('rejects password without lowercase', () => {
    const result = registerSchema.safeParse({ ...validData, password: 'HESLO123' });
    expect(result.success).toBe(false);
  });

  it('rejects password without digit', () => {
    const result = registerSchema.safeParse({ ...validData, password: 'HesloAbc' });
    expect(result.success).toBe(false);
  });

  it('rejects empty firstName', () => {
    const result = registerSchema.safeParse({ ...validData, firstName: '' });
    expect(result.success).toBe(false);
  });
});

describe('matchSchema', () => {
  const validMatch = {
    homeTeam: 'FK FM',
    awayTeam: 'Baník',
    homeScore: 2,
    awayScore: 1,
    categoryIds: ['cat-1'],
    matchDate: '2025-03-15',
  };

  it('validates correct match data', () => {
    const result = matchSchema.safeParse(validMatch);
    expect(result.success).toBe(true);
  });

  it('rejects negative scores', () => {
    const result = matchSchema.safeParse({ ...validMatch, homeScore: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects empty categoryIds', () => {
    const result = matchSchema.safeParse({ ...validMatch, categoryIds: [] });
    expect(result.success).toBe(false);
  });

  it('accepts optional fields', () => {
    const result = matchSchema.safeParse({
      ...validMatch,
      homeGoalscorers: 'Novák 15\', Dvořák 78\'',
      matchReport: 'Výborný zápas',
      imagesUrl: 'https://example.com/photos',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty string for imagesUrl', () => {
    const result = matchSchema.safeParse({ ...validMatch, imagesUrl: '' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid imagesUrl', () => {
    const result = matchSchema.safeParse({ ...validMatch, imagesUrl: 'not-a-url' });
    expect(result.success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('validates matching passwords', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'oldPass1',
      newPassword: 'NewPass1',
      confirmPassword: 'NewPass1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'oldPass1',
      newPassword: 'NewPass1',
      confirmPassword: 'Different1',
    });
    expect(result.success).toBe(false);
  });
});

describe('commentSchema', () => {
  it('validates valid comment', () => {
    const result = commentSchema.safeParse({ content: 'Great match!' });
    expect(result.success).toBe(true);
  });

  it('rejects empty comment', () => {
    const result = commentSchema.safeParse({ content: '' });
    expect(result.success).toBe(false);
  });

  it('rejects too long comment', () => {
    const result = commentSchema.safeParse({ content: 'a'.repeat(2001) });
    expect(result.success).toBe(false);
  });
});
