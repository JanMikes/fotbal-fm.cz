import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFormToken } from '@fotbal-fm/form';

vi.mock('../../lib/strapi.js', () => ({
  strapiGet: vi.fn(),
  strapiPost: vi.fn(),
  strapiGetSingle: vi.fn(),
  strapiPut: vi.fn(),
  strapiDelete: vi.fn(),
}));

vi.mock('@fotbal-fm/form', async (importOriginal) => {
  const original = await importOriginal<typeof import('@fotbal-fm/form')>();
  return {
    ...original,
    sendEmail: vi.fn().mockResolvedValue(true),
  };
});

const { strapiGet } = await import('../../lib/strapi.js');
const { sendEmail } = await import('@fotbal-fm/form');
const { app } = await import('../../app.js');

const FORM_TOKEN_SECRET = process.env.FORM_TOKEN_SECRET || 'dev-form-token-secret-at-least-32-chars';

function makeToken(recipients: string[]) {
  return createFormToken(recipients, FORM_TOKEN_SECRET);
}

function buildFormData(entries: Record<string, string | File>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.append(key, value);
  }
  return fd;
}

describe('GET /api/v1/forms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns forms extracted from pages', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce({
      data: [
        {
          id: 1,
          documentId: 'page-1',
          title: 'Contact',
          slug: 'contact',
          content: [
            {
              id: 1,
              __component: 'components.form',
              form: {
                id: 1,
                documentId: 'form-1',
                name: 'Contact Form',
                submitButtonText: 'Send',
                successMessage: 'Thanks!',
                inputGroups: [
                  {
                    id: 1,
                    title: null,
                    inputs: [
                      {
                        id: 1,
                        name: 'email',
                        label: 'Email',
                        type: 'email',
                        placeholder: 'you@example.com',
                        required: true,
                        helpText: null,
                        options: null,
                        width: 'full',
                      },
                    ],
                  },
                ],
              },
              recipients: [{ id: 1, email: 'admin@test.com' }],
            },
          ],
          sidebar: null,
        },
      ],
      meta: {},
    });

    const res = await app.request('/api/v1/forms');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].token).toBeTruthy();
    expect(json.data[0].form.documentId).toBe('form-1');
    expect(json.data[0].form.name).toBe('Contact Form');
    expect(json.data[0].form.inputGroups[0].inputs[0].name).toBe('email');
    expect(json.data[0].form.inputGroups[0].inputs[0].type).toBe('email');
    expect(json.data[0].form.inputGroups[0].inputs[0].required).toBe(true);
  });

  it('returns empty array when no pages have forms', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce({
      data: [
        { id: 1, documentId: 'page-1', title: 'About', slug: 'about', content: [], sidebar: null },
      ],
      meta: {},
    });

    const res = await app.request('/api/v1/forms');
    const json = await res.json();
    expect(json.data).toEqual([]);
  });

  it('skips forms without recipients', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce({
      data: [
        {
          id: 1,
          documentId: 'page-1',
          title: 'Page',
          slug: 'page',
          content: [
            {
              id: 1,
              __component: 'components.form',
              form: { id: 1, documentId: 'form-1', name: 'F', submitButtonText: 'Go', successMessage: 'OK', inputGroups: [] },
              recipients: [],
            },
          ],
          sidebar: null,
        },
      ],
      meta: {},
    });

    const res = await app.request('/api/v1/forms');
    const json = await res.json();
    expect(json.data).toEqual([]);
  });

  it('parses options into array', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce({
      data: [
        {
          id: 1,
          documentId: 'page-1',
          title: 'Page',
          slug: 'page',
          content: [
            {
              id: 1,
              __component: 'components.form',
              form: {
                id: 1,
                documentId: 'form-1',
                name: 'F',
                submitButtonText: 'Go',
                successMessage: 'OK',
                inputGroups: [
                  {
                    id: 1,
                    title: null,
                    inputs: [
                      { id: 1, name: 'pos', label: 'Position', type: 'select', placeholder: null, required: false, helpText: null, options: 'GK\nDF\nMF\nFW', width: 'full' },
                    ],
                  },
                ],
              },
              recipients: [{ id: 1, email: 'a@b.com' }],
            },
          ],
          sidebar: null,
        },
      ],
      meta: {},
    });

    const res = await app.request('/api/v1/forms');
    const json = await res.json();
    expect(json.data[0].form.inputGroups[0].inputs[0].options).toEqual(['GK', 'DF', 'MF', 'FW']);
  });
});

describe('POST /api/v1/forms/submit', () => {
  let testIpCounter = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sendEmail).mockResolvedValue(true);
    testIpCounter++;
  });

  function submitRequest(fd: FormData) {
    return app.request('/api/v1/forms/submit', {
      method: 'POST',
      body: fd,
      headers: { 'X-Forwarded-For': `10.0.0.${testIpCounter}` },
    });
  }

  it('submits form successfully', async () => {
    const token = makeToken(['admin@test.com']);
    const fd = buildFormData({
      _token: token,
      _formName: 'Test',
      name: 'Jan',
      email: 'jan@test.com',
    });

    const res = await submitRequest(fd);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.ok).toBe(true);

    expect(sendEmail).toHaveBeenCalledOnce();
    const [, emailOpts] = vi.mocked(sendEmail).mock.calls[0];
    expect(emailOpts.to).toEqual(['admin@test.com']);
    expect(emailOpts.subject).toBe('Nový formulář: Test');
    expect(emailOpts.html).toContain('Jan');
  });

  it('rejects missing token', async () => {
    const fd = buildFormData({ _formName: 'Test', name: 'Jan' });
    const res = await submitRequest(fd);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('_token');
  });

  it('rejects invalid token', async () => {
    const fd = buildFormData({ _token: 'bad-token', _formName: 'Test', name: 'Jan' });
    const res = await submitRequest(fd);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('token');
  });

  it('rejects empty form', async () => {
    const token = makeToken(['a@b.com']);
    const fd = buildFormData({ _token: token, _formName: 'Test' });
    const res = await submitRequest(fd);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('prázdný');
  });

  it('returns 500 when email fails', async () => {
    vi.mocked(sendEmail).mockResolvedValueOnce(false);
    const token = makeToken(['a@b.com']);
    const fd = buildFormData({ _token: token, _formName: 'Test', name: 'Jan' });

    const res = await submitRequest(fd);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain('e-mailu');
  });

  it('rejects blocked file extensions', async () => {
    const token = makeToken(['a@b.com']);
    const fd = new FormData();
    fd.append('_token', token);
    fd.append('_formName', 'Test');
    fd.append('file', new File(['code'], 'hack.exe', { type: 'application/octet-stream' }));

    const res = await submitRequest(fd);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('.exe');
  });
});
