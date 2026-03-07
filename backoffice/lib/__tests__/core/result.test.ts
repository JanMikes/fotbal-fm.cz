import { describe, it, expect } from 'vitest';
import {
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  map,
  mapErr,
  andThen,
  fromPromise,
  fromTry,
  all,
  okWithWarnings,
} from '../../core/result';

describe('Result type', () => {
  describe('ok / err', () => {
    it('creates successful result', () => {
      const result = ok(42);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(42);
      }
    });

    it('creates failed result', () => {
      const error = new Error('fail');
      const result = err(error);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(error);
      }
    });
  });

  describe('isOk / isErr', () => {
    it('identifies success', () => {
      expect(isOk(ok('hello'))).toBe(true);
      expect(isOk(err(new Error()))).toBe(false);
    });

    it('identifies error', () => {
      expect(isErr(err(new Error()))).toBe(true);
      expect(isErr(ok('hello'))).toBe(false);
    });
  });

  describe('unwrap', () => {
    it('returns data from success', () => {
      expect(unwrap(ok('value'))).toBe('value');
    });

    it('throws on error result', () => {
      expect(() => unwrap(err(new Error('fail')))).toThrow('fail');
    });
  });

  describe('unwrapOr', () => {
    it('returns data from success', () => {
      expect(unwrapOr(ok(42), 0)).toBe(42);
    });

    it('returns default from error', () => {
      expect(unwrapOr(err(new Error()), 0)).toBe(0);
    });
  });

  describe('map', () => {
    it('transforms successful result', () => {
      const result = map(ok(5), (n) => n * 2);
      expect(result).toEqual(ok(10));
    });

    it('passes through error result', () => {
      const error = new Error('fail');
      const result = map(err(error), (n: number) => n * 2);
      expect(result).toEqual(err(error));
    });
  });

  describe('mapErr', () => {
    it('transforms error result', () => {
      const result = mapErr(err('old'), (e) => `mapped: ${e}`);
      expect(result).toEqual(err('mapped: old'));
    });

    it('passes through success result', () => {
      const result = mapErr(ok(42), (e: string) => `mapped: ${e}`);
      expect(result).toEqual(ok(42));
    });
  });

  describe('andThen', () => {
    it('chains successful results', () => {
      const result = andThen(ok(5), (n) => ok(n * 2));
      expect(result).toEqual(ok(10));
    });

    it('short-circuits on error', () => {
      const error = new Error('fail');
      const result = andThen(err(error), (n: number) => ok(n * 2));
      expect(result).toEqual(err(error));
    });

    it('returns error from chain function', () => {
      const result = andThen(ok(5), () => err(new Error('chain fail')));
      expect(isErr(result)).toBe(true);
    });
  });

  describe('fromPromise', () => {
    it('wraps resolved promise', async () => {
      const result = await fromPromise(Promise.resolve(42));
      expect(result).toEqual(ok(42));
    });

    it('wraps rejected promise', async () => {
      const result = await fromPromise(Promise.reject(new Error('fail')));
      expect(isErr(result)).toBe(true);
    });

    it('uses error mapper', async () => {
      const result = await fromPromise(
        Promise.reject(new Error('original')),
        (e) => `mapped: ${(e as Error).message}`
      );
      expect(isErr(result)).toBe(true);
      if (!result.success) {
        expect(result.error).toBe('mapped: original');
      }
    });
  });

  describe('fromTry', () => {
    it('wraps successful function', () => {
      const result = fromTry(() => 42);
      expect(result).toEqual(ok(42));
    });

    it('wraps throwing function', () => {
      const result = fromTry(() => { throw new Error('fail'); });
      expect(isErr(result)).toBe(true);
    });

    it('uses error mapper', () => {
      const result = fromTry(
        () => { throw new Error('original'); },
        (e) => `mapped: ${(e as Error).message}`
      );
      if (!result.success) {
        expect(result.error).toBe('mapped: original');
      }
    });
  });

  describe('all', () => {
    it('combines all successes', () => {
      const result = all([ok(1), ok(2), ok(3)]);
      expect(result).toEqual(ok([1, 2, 3]));
    });

    it('returns first error', () => {
      const error = new Error('fail');
      const result = all([ok(1), err(error), ok(3)]);
      expect(result).toEqual(err(error));
    });

    it('handles empty array', () => {
      const result = all([]);
      expect(result).toEqual(ok([]));
    });
  });

  describe('okWithWarnings', () => {
    it('creates result with warnings', () => {
      const result = okWithWarnings(42, ['warning 1']);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(42);
        expect(result.warnings).toEqual(['warning 1']);
      }
    });

    it('creates result without warnings', () => {
      const result = okWithWarnings(42);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.warnings).toBeUndefined();
      }
    });
  });
});
