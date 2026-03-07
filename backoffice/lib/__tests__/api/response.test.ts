import { describe, it, expect, vi } from 'vitest';

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      body,
      status: init?.status ?? 200,
      headers: init?.headers,
      async json() { return this.body; },
    }),
  },
}));

const {
  apiSuccess,
  apiError,
  apiErrorFromAppError,
  handleApiError,
  ApiErrors,
} = await import('../../api/response');
const { AppError, ErrorCode, ValidationError } = await import('../../core/errors');

describe('apiSuccess', () => {
  it('creates success response with data', async () => {
    const res = apiSuccess({ items: [1, 2, 3] });
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toEqual({ items: [1, 2, 3] });
    expect(res.status).toBe(200);
  });

  it('includes warnings when provided', async () => {
    const res = apiSuccess('ok', { warnings: ['Warning 1'] });
    const json = await res.json();
    expect(json.warnings).toEqual(['Warning 1']);
  });

  it('omits warnings when array is empty', async () => {
    const res = apiSuccess('ok', { warnings: [] });
    const json = await res.json();
    expect(json.warnings).toBeUndefined();
  });

  it('uses custom status code', async () => {
    const res = apiSuccess('created', { status: 201 });
    expect(res.status).toBe(201);
  });
});

describe('apiError', () => {
  it('creates error response', async () => {
    const res = apiError('Something went wrong');
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe('Something went wrong');
    expect(res.status).toBe(500);
  });

  it('includes code when provided', async () => {
    const res = apiError('Not found', { code: ErrorCode.NOT_FOUND, status: 404 });
    const json = await res.json();
    expect(json.code).toBe(ErrorCode.NOT_FOUND);
    expect(res.status).toBe(404);
  });

  it('includes details when provided', async () => {
    const details = { field: 'email' };
    const res = apiError('Validation failed', { details });
    const json = await res.json();
    expect(json.details).toEqual(details);
  });
});

describe('apiErrorFromAppError', () => {
  it('maps AppError to response', async () => {
    const error = new ValidationError('Neplatná data', { field: 'name' });
    const res = apiErrorFromAppError(error);
    const json = await res.json();

    expect(json.success).toBe(false);
    expect(json.error).toBe('Neplatná data');
    expect(json.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(res.status).toBe(400);
  });
});

describe('handleApiError', () => {
  it('handles AppError', async () => {
    const error = new ValidationError('Bad input');
    const res = handleApiError(error);
    const json = await res.json();

    expect(json.error).toBe('Bad input');
    expect(res.status).toBe(400);
  });

  it('handles standard Error', async () => {
    const res = handleApiError(new Error('Standard error'));
    const json = await res.json();

    expect(json.error).toBe('Standard error');
    expect(json.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(res.status).toBe(500);
  });

  it('handles unknown error types', async () => {
    const res = handleApiError('string error');
    const json = await res.json();

    expect(json.error).toBe('string error');
    expect(res.status).toBe(500);
  });

  it('handles null error', async () => {
    const res = handleApiError(null);
    const json = await res.json();

    expect(json.error).toBe('Nastala neočekávaná chyba');
  });
});

describe('ApiErrors', () => {
  it('unauthorized returns 401', async () => {
    const res = ApiErrors.unauthorized();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Nejste přihlášeni');
  });

  it('forbidden returns 403', async () => {
    const res = ApiErrors.forbidden();
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('Nemáte oprávnění k této akci');
  });

  it('notFound returns 404', async () => {
    const res = ApiErrors.notFound();
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('Záznam nebyl nalezen');
  });

  it('badRequest returns 400', async () => {
    const res = ApiErrors.badRequest('Invalid data');
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid data');
  });

  it('serverError returns 500', async () => {
    const res = ApiErrors.serverError();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Nastala neočekávaná chyba');
  });

  it('validationFailed returns 400 with details', async () => {
    const res = ApiErrors.validationFailed('Chyba validace', { fields: ['name'] });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.details).toEqual({ fields: ['name'] });
  });
});
