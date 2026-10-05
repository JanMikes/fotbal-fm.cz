import { describe, it, expect } from 'vitest';
import { detectImageType } from '../../lib/media.js';

describe('detectImageType', () => {
  it.each([
    ['jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]), { mime: 'image/jpeg', ext: 'jpg' }],
    ['png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]), { mime: 'image/png', ext: 'png' }],
    ['gif', Buffer.from('GIF89a', 'ascii'), { mime: 'image/gif', ext: 'gif' }],
    ['webp', Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'ascii'), { mime: 'image/webp', ext: 'webp' }],
  ])('recognises %s', (_name, buffer, expected) => {
    expect(detectImageType(buffer)).toEqual(expected);
  });

  it('rejects an HTML page served instead of a photo', () => {
    expect(detectImageType(Buffer.from('<!DOCTYPE html><html>', 'utf-8'))).toBeNull();
  });

  it('rejects an empty response', () => {
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});
