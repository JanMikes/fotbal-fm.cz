import { describe, it, expect } from 'vitest';
import { processFormData, buildEmailHtml, escapeHtml, FormValidationError } from '../form-processing';

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
  });

  it('escapes ampersands and single quotes', () => {
    expect(escapeHtml("Tom & Jerry's")).toBe('Tom &amp; Jerry&#x27;s');
  });
});

describe('buildEmailHtml', () => {
  it('includes form name and fields in the output', () => {
    const html = buildEmailHtml('Test Form', [
      { name: 'name', value: 'Jan' },
      { name: 'email', value: 'jan@test.com' },
    ], 0);

    expect(html).toContain('Test Form');
    expect(html).toContain('name');
    expect(html).toContain('Jan');
    expect(html).toContain('jan@test.com');
  });

  it('shows attachment note when attachments exist', () => {
    const html = buildEmailHtml('Form', [], 2);
    expect(html).toContain('Přílohy: 2 soubory');
  });

  it('does not show attachment note when zero', () => {
    const html = buildEmailHtml('Form', [{ name: 'a', value: 'b' }], 0);
    expect(html).not.toContain('Přílohy');
  });

  it('escapes HTML in field values', () => {
    const html = buildEmailHtml('Form', [
      { name: 'input', value: '<script>alert(1)</script>' },
    ], 0);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('processFormData', () => {
  it('extracts string fields', async () => {
    const fd = new FormData();
    fd.append('_token', 'skip-me');
    fd.append('name', 'Jan');
    fd.append('email', 'jan@test.com');

    const result = await processFormData(fd);
    expect(result.fields).toEqual([
      { name: 'name', value: 'Jan' },
      { name: 'email', value: 'jan@test.com' },
    ]);
    expect(result.attachments).toEqual([]);
  });

  it('skips underscore-prefixed fields', async () => {
    const fd = new FormData();
    fd.append('_internal', 'hidden');
    fd.append('visible', 'shown');

    const result = await processFormData(fd);
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0].name).toBe('visible');
  });

  it('throws FormValidationError for empty form', async () => {
    const fd = new FormData();
    fd.append('_token', 'only-internal');

    await expect(processFormData(fd)).rejects.toThrow(FormValidationError);
    await expect(processFormData(fd)).rejects.toThrow('Formulář je prázdný.');
  });

  it('processes file attachments', async () => {
    const fd = new FormData();
    const file = new File(['hello world'], 'test.pdf', { type: 'application/pdf' });
    fd.append('file', file);

    const result = await processFormData(fd);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].filename).toBe('test.pdf');
    expect(result.attachments[0].content).toBeInstanceOf(Buffer);
  });

  it('rejects blocked file extensions', async () => {
    const fd = new FormData();
    const file = new File(['echo pwned'], 'hack.exe', { type: 'application/octet-stream' });
    fd.append('file', file);

    await expect(processFormData(fd)).rejects.toThrow(FormValidationError);
    await expect(processFormData(fd)).rejects.toThrow('.exe');
  });

  it('rejects files exceeding 10MB', async () => {
    const fd = new FormData();
    const bigContent = new Uint8Array(11 * 1024 * 1024); // 11MB
    const file = new File([bigContent], 'big.pdf', { type: 'application/pdf' });
    fd.append('file', file);

    await expect(processFormData(fd)).rejects.toThrow(FormValidationError);
    await expect(processFormData(fd)).rejects.toThrow('příliš velký');
  });

  it('skips zero-size files', async () => {
    const fd = new FormData();
    const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' });
    fd.append('file', emptyFile);
    fd.append('name', 'Jan');

    const result = await processFormData(fd);
    expect(result.attachments).toHaveLength(0);
    expect(result.fields).toHaveLength(1);
  });
});
