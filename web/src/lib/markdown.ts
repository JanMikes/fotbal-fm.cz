import { marked } from 'marked';
import { transformContentUrls } from './strapi/mappers/shared';

marked.setOptions({
  breaks: true,
});

export function markdownToHtml(markdown: string): string {
  const html = marked.parse(markdown, { async: false }) as string;
  return transformContentUrls(html);
}

export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/[#*_~`>\[\]()!|-]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}
