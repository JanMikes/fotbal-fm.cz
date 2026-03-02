import Image from 'next/image';
import type { ComponentImage } from '@/lib/types';

interface ImageBlockProps {
  data: ComponentImage;
}

export function ImageBlock({ data }: ImageBlockProps) {
  if (!data.image) return null;

  return (
    <div className="rounded-lg overflow-hidden">
      <Image
        src={data.image.url}
        alt={data.image.alternativeText || ''}
        width={data.image.width || 800}
        height={data.image.height || 600}
        className="w-full h-auto"
      />
    </div>
  );
}
