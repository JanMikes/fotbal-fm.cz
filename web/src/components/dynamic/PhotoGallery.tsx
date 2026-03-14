import Image from 'next/image';
import { clsx } from 'clsx';
import type { ComponentPhotoGallery } from '@/lib/types';

interface PhotoGalleryProps {
  data: ComponentPhotoGallery;
  sidebar?: boolean;
}

const colClasses: Record<string, string> = {
  '2': 'grid-cols-1 sm:grid-cols-2',
  '3': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  '4': 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
};

export function PhotoGallery({ data, sidebar }: PhotoGalleryProps) {
  const photos = data.photos?.filter((p) => p.image) ?? [];
  if (photos.length === 0) return null;

  return (
    <div className={clsx('grid gap-4', sidebar ? 'grid-cols-2' : (colClasses[data.columns] || colClasses['3']))}>
      {photos.map((photo, i) => (
        <div key={i} className="relative aspect-[4/3] rounded-lg overflow-hidden">
          <Image
            src={photo.image!.url}
            alt={photo.image!.alternativeText || ''}
            fill
            className="object-cover hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
      ))}
    </div>
  );
}
