import { marked } from 'marked';
import { resolveMediaUrl } from './media.js';

marked.setOptions({
  breaks: true,
});

function transformContentUrls(html: string): string {
  return html.replace(/(src|href)="(\/uploads\/[^"]+)"/g, (_match, attr, path) => {
    return `${attr}="${resolveMediaUrl(path)}"`;
  });
}

export function markdownToHtml(markdown: string): string {
  const html = marked.parse(markdown, { async: false }) as string;
  return transformContentUrls(html);
}
