import type { ComponentText } from '@/lib/types';

interface RichTextProps {
  data: ComponentText;
}

export function RichText({ data }: RichTextProps) {
  if (!data.text) return null;

  return (
    <div
      className="prose prose-primary max-w-none prose-headings:text-primary prose-a:text-accent prose-a:no-underline hover:prose-a:underline"
      dangerouslySetInnerHTML={{ __html: data.text }}
    />
  );
}
