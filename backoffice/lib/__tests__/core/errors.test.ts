import { describe, it, expect } from 'vitest';
import {
  AppError,
  ErrorCode,
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  NetworkError,
  TimeoutError,
  StrapiError,
  UploadError,
  isAppError,
  getErrorMessage,
  toAppError,
} from '../../core/errors';

describe('Error classes', () => {
  describe('AppError', () => {
    it('creates with message, code, and status', () => {
      const error = new AppError('Test error', ErrorCode.INTERNAL_ERROR, 500);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('AppError');
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('defaults statusCode to 500', () => {
      const error = new AppError('Test', ErrorCode.UNKNOWN_ERROR);
      expect(error.statusCode).toBe(500);
    });

    it('stores details', () => {
      const details = { field: 'email', reason: 'invalid' };
      const error = new AppError('Test', ErrorCode.VALIDATION_FAILED, 400, details);
      expect(error.details).toEqual(details);
    });

    it('serializes to JSON', () => {
      const error = new AppError('Test', ErrorCode.INTERNAL_ERROR, 500, { key: 'val' });
      const json = error.toJSON();
      expect(json.name).toBe('AppError');
      expect(json.message).toBe('Test');
      expect(json.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(json.statusCode).toBe(500);
      expect(json.details).toEqual({ key: 'val' });
      expect(json.timestamp).toBeDefined();
    });
  });

  describe('ValidationError', () => {
    it('has correct defaults', () => {
      const error = new ValidationError('Neplatná data');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(error.name).toBe('ValidationError');
    });
  });

  describe('AuthError', () => {
    it('has correct defaults', () => {
      const error = new AuthError();
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(error.message).toBe('Nejste přihlášeni');
      expect(error.name).toBe('AuthError');
    });

    it('accepts custom message and code', () => {
      const error = new AuthError('Session expired', ErrorCode.SESSION_EXPIRED);
      expect(error.message).toBe('Session expired');
      expect(error.code).toBe(ErrorCode.SESSION_EXPIRED);
    });
  });

  describe('ForbiddenError', () => {
    it('has correct defaults', () => {
      const error = new ForbiddenError();
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe(ErrorCode.FORBIDDEN);
      expect(error.message).toBe('Nemáte oprávnění k této akci');
    });
  });

  describe('NotFoundError', () => {
    it('has correct defaults', () => {
      const error = new NotFoundError();
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.message).toBe('Záznam nebyl nalezen');
    });
  });

  describe('NetworkError', () => {
    it('has correct defaults', () => {
      const error = new NetworkError();
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(error.message).toBe('Chyba připojení k serveru');
    });
  });

  describe('TimeoutError', () => {
    it('has correct defaults', () => {
      const error = new TimeoutError();
      expect(error.statusCode).toBe(504);
      expect(error.code).toBe(ErrorCode.TIMEOUT);
      expect(error.message).toBe('Požadavek vypršel, zkuste to znovu');
    });
  });

  describe('StrapiError', () => {
    it('accepts custom statusCode', () => {
      const error = new StrapiError('Strapi down', 502);
      expect(error.statusCode).toBe(502);
      expect(error.code).toBe(ErrorCode.STRAPI_ERROR);
    });
  });

  describe('UploadError', () => {
    it('has correct defaults', () => {
      const error = new UploadError();
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe(ErrorCode.UPLOAD_FAILED);
      expect(error.message).toBe('Nahrávání souborů selhalo');
    });
  });
});

describe('isAppError', () => {
  it('returns true for AppError instances', () => {
    expect(isAppError(new AppError('test', ErrorCode.UNKNOWN_ERROR))).toBe(true);
    expect(isAppError(new ValidationError('test'))).toBe(true);
    expect(isAppError(new AuthError())).toBe(true);
  });

  it('returns false for non-AppError', () => {
    expect(isAppError(new Error('test'))).toBe(false);
    expect(isAppError('string')).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError(undefined)).toBe(false);
  });
});

describe('getErrorMessage', () => {
  it('returns message from AppError', () => {
    expect(getErrorMessage(new AppError('Custom error', ErrorCode.UNKNOWN_ERROR))).toBe('Custom error');
  });

  it('returns message from standard Error', () => {
    expect(getErrorMessage(new Error('Standard error'))).toBe('Standard error');
  });

  it('returns string directly', () => {
    expect(getErrorMessage('String error')).toBe('String error');
  });

  it('returns default for unknown types', () => {
    expect(getErrorMessage(42)).toBe('Nastala neočekávaná chyba');
    expect(getErrorMessage(null)).toBe('Nastala neočekávaná chyba');
  });
});

describe('toAppError', () => {
  it('returns AppError as-is', () => {
    const original = new ValidationError('test');
    expect(toAppError(original)).toBe(original);
  });

  it('wraps standard Error', () => {
    const result = toAppError(new Error('test'));
    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toBe('test');
    expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
  });

  it('wraps unknown types', () => {
    const result = toAppError('string error');
    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toBe('string error');
  });

  it('wraps null/undefined', () => {
    const result = toAppError(null);
    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toBe('Nastala neočekávaná chyba');
  });
});
