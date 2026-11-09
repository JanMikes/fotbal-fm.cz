import { describe, expect, it } from 'vitest';
import {
  contentDisposition,
  decodeExportFilenameHeader,
  encodeExportFilenameHeader,
  exportFilename,
  filenameFromDisposition,
} from '@/lib/social-export/download-filename';

describe('filenameFromDisposition', () => {
  it('prefers the UTF-8 filename* over the ASCII fallback', () => {
    expect(
      filenameFromDisposition(
        "inline; filename=\"Uvodni strana - 9x16.png\"; filename*=utf-8''%C3%9Avodn%C3%AD%20strana%20-%209x16.png"
      )
    ).toBe('Úvodní strana - 9x16.png');
  });

  it('reads a quoted and an unquoted plain filename', () => {
    expect(filenameFromDisposition('attachment; filename="Group Campaign.zip"')).toBe('Group Campaign.zip');
    expect(filenameFromDisposition('attachment; filename=Nabidka.pdf')).toBe('Nabidka.pdf');
  });

  it('falls back to filename when filename* is malformed, null when absent', () => {
    expect(filenameFromDisposition("attachment; filename=\"a.png\"; filename*=utf-8''%E0%A4%A")).toBe('a.png');
    expect(filenameFromDisposition('attachment')).toBeNull();
    expect(filenameFromDisposition(null)).toBeNull();
  });
});

describe('contentDisposition', () => {
  it('sends an ASCII fallback plus the UTF-8 name', () => {
    expect(contentDisposition('Úvodní strana - 9x16.png')).toBe(
      "attachment; filename=\"Uvodni strana - 9x16.png\"; filename*=UTF-8''%C3%9Avodn%C3%AD%20strana%20-%209x16.png"
    );
  });

  it('is a header-safe (Latin-1) value whatever the name', () => {
    const value = contentDisposition('Sleva 50 % „nejlepší“ – 210 × 297 mm.pdf');
    expect(value).toMatch(/^[\x20-\x7E]+$/);
    expect(filenameFromDisposition(value)).toBe('Sleva 50 % „nejlepší“ – 210 × 297 mm.pdf');
  });
});

describe('X-Export-Filename', () => {
  it('round-trips a Czech name through an ASCII header', () => {
    const header = encodeExportFilenameHeader('Cenová nabídka - Říjen.pdf');
    expect(header).toMatch(/^[\x20-\x7E]+$/);
    expect(decodeExportFilenameHeader(header)).toBe('Cenová nabídka - Říjen.pdf');
    expect(decodeExportFilenameHeader(null)).toBeNull();
  });
});

describe('exportFilename', () => {
  it('mirrors the WBoost scheme: parts joined by " - ", diacritics kept', () => {
    expect(exportFilename(['Úvodní strana', '9:16'], 'png')).toBe('Úvodní strana - 9x16.png');
    expect(exportFilename(['Výsledek', null, ''], 'zip')).toBe('Výsledek.zip');
  });

  it('strips characters no OS accepts and falls back when nothing is left', () => {
    expect(exportFilename(['Akce 1/2: "finále"?'], 'png')).toBe('Akce 1-2 finále.png');
    expect(exportFilename(['///'], 'pdf', 'dokument')).toBe('dokument.pdf');
  });
});
