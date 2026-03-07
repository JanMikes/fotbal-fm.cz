'use client';

import { useCallback } from 'react';
import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ComponentGallerySlider } from '@/lib/types';

interface GallerySliderProps {
  data: ComponentGallerySlider;
}

export function GallerySlider({ data }: GallerySliderProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: 'start',
    slidesToScroll: 1,
    containScroll: 'trimSnaps',
  });

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const photos = data.photos?.filter((p) => p.image) ?? [];
  if (photos.length === 0) return null;

  return (
    <div className="relative group">
      <div className="overflow-hidden rounded-lg" ref={emblaRef}>
        <div className="flex gap-4">
          {photos.map((photo, i) => (
            <div key={i} className="flex-[0_0_80%] sm:flex-[0_0_45%] lg:flex-[0_0_30%] min-w-0">
              <div className="relative aspect-[4/3] rounded-lg overflow-hidden">
                <Image
                  src={photo.image!.url}
                  alt={photo.image!.alternativeText || ''}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 80vw, (max-width: 1024px) 45vw, 30vw"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      {photos.length > 1 && (
        <>
          <button
            onClick={scrollPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Předchozí"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={scrollNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Další"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}
    </div>
  );
}
