import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/config', () => ({
  config: {
    strapi: { url: 'http://strapi:1337', apiToken: 'test-token' },
    publicUploadsUrl: 'http://uploads.test',
    internalUploadsUrl: 'http://uploads.test',
    formTokenSecret: 'test-form-token-secret-for-signing',
    smtp: { host: 'localhost', port: 1025, user: '', password: '', secure: false, from: 'test@test.cz' },
  },
}));

import { createFormToken, verifyFormToken } from '@/lib/form-token';

describe('form-token', () => {
  it('creates and verifies a valid token', () => {
    const recipients = ['a@test.cz', 'b@test.cz'];
    const token = createFormToken(recipients);
    const result = verifyFormToken(token);
    expect(result).toEqual(recipients);
  });

  it('returns null for tampered token', () => {
    const token = createFormToken(['a@test.cz']);
    // Tamper with the token
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString());
    decoded.r = ['evil@hacker.com'];
    const tampered = Buffer.from(JSON.stringify(decoded)).toString('base64url');
    expect(verifyFormToken(tampered)).toBeNull();
  });

  it('returns null for invalid token format', () => {
    expect(verifyFormToken('not-a-valid-token')).toBeNull();
    expect(verifyFormToken('')).toBeNull();
  });

  it('returns null for token with wrong types', () => {
    const fakeToken = Buffer.from(JSON.stringify({ r: 'not-array', s: 'sig' })).toString('base64url');
    expect(verifyFormToken(fakeToken)).toBeNull();
  });

  it('handles empty recipients array', () => {
    const token = createFormToken([]);
    const result = verifyFormToken(token);
    expect(result).toEqual([]);
  });

  it('handles single recipient', () => {
    const token = createFormToken(['single@test.cz']);
    const result = verifyFormToken(token);
    expect(result).toEqual(['single@test.cz']);
  });
});
