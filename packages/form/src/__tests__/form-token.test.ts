import { describe, it, expect } from 'vitest';
import { createFormToken, verifyFormToken } from '../form-token';

const SECRET = 'test-secret-at-least-32-characters-long';

describe('form-token', () => {
  describe('createFormToken', () => {
    it('creates a base64url-encoded token', () => {
      const token = createFormToken(['a@b.com'], SECRET);
      expect(token).toBeTruthy();
      // Should be valid base64url (no +, /, or =)
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('creates different tokens for different recipients', () => {
      const t1 = createFormToken(['a@b.com'], SECRET);
      const t2 = createFormToken(['c@d.com'], SECRET);
      expect(t1).not.toBe(t2);
    });

    it('creates different tokens for different secrets', () => {
      const t1 = createFormToken(['a@b.com'], 'secret-one-at-least-32-chars!!!!');
      const t2 = createFormToken(['a@b.com'], 'secret-two-at-least-32-chars!!!!');
      expect(t1).not.toBe(t2);
    });
  });

  describe('verifyFormToken', () => {
    it('returns recipients for a valid token', () => {
      const recipients = ['a@b.com', 'c@d.com'];
      const token = createFormToken(recipients, SECRET);
      const result = verifyFormToken(token, SECRET);
      expect(result).toEqual(recipients);
    });

    it('returns null for a tampered token', () => {
      const token = createFormToken(['a@b.com'], SECRET);
      const tampered = token.slice(0, -2) + 'XX';
      expect(verifyFormToken(tampered, SECRET)).toBeNull();
    });

    it('returns null for a wrong secret', () => {
      const token = createFormToken(['a@b.com'], SECRET);
      expect(verifyFormToken(token, 'wrong-secret-at-least-32-chars!!')).toBeNull();
    });

    it('returns null for garbage input', () => {
      expect(verifyFormToken('not-a-token', SECRET)).toBeNull();
      expect(verifyFormToken('', SECRET)).toBeNull();
    });

    it('returns null for malformed JSON', () => {
      const bad = Buffer.from('{"not":"valid"}').toString('base64url');
      expect(verifyFormToken(bad, SECRET)).toBeNull();
    });
  });
});
