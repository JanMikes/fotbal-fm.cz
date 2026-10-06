/**
 * Metrics label for a Strapi path: its first segment, the content type ("pages", "upload" for
 * "upload/files") — never ids or queries. Shared by the client (which counts every request) and
 * the metrics server (which pre-creates the auth-failure series per type).
 */
export function typeLabel(label: string): string {
  return label.split('/')[0];
}
