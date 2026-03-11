'use client';

import { useCallback, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ComponentSlider } from '@/lib/types';
import { MarkdownContent } from '../ui/MarkdownContent';

interface SliderProps {
  data: ComponentSlider;
}

export function Slider({ data }: SliderProps) {
  const plugins = data.autoplay
    ? [Autoplay({ delay: data.autoplay_interval || 7000, stopOnInteraction: false })]
    : [];

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, plugins);

  const scrollPrev = useCallback(() => {
    if (!emblaApi) return;
    emblaApi.scrollPrev();
    emblaApi.plugins().autoplay?.reset();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (!emblaApi) return;
    emblaApi.scrollNext();
    emblaApi.plugins().autoplay?.reset();
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const resetAutoplay = () => emblaApi.plugins().autoplay?.reset();
    emblaApi.on('pointerUp', resetAutoplay);
    return () => {
      emblaApi.off('pointerUp', resetAutoplay);
    };
  }, [emblaApi]);

  if (!data.slides || data.slides.length === 0) return null;

  return (
    <div className="relative group">
      <div className="overflow-hidden rounded-lg" ref={emblaRef}>
        <div className="flex">
          {data.slides.map((slide, i) => (
            <div key={i} className="flex-[0_0_100%] min-w-0 relative aspect-[16/9]">
              {slide.background_image && (
                <Image
                  src={slide.background_image.url}
                  alt=""
                  fill
                  className="object-cover"
                />
              )}
              {slide.image && !slide.background_image && (
                <Image
                  src={slide.image.url}
                  alt={slide.title || ''}
                  fill
                  className="object-cover"
                />
              )}
              <div className="absolute inset-0 p-6 lg:p-10 flex flex-col justify-end">
                {slide.title && (
                  <h3 className="text-xl lg:text-3xl font-bold text-white mb-2">{slide.title}</h3>
                )}
                {slide.description && (
                  <MarkdownContent
                    content={slide.description}
                    className="text-white/80 text-sm lg:text-base mb-4 max-w-2xl prose-invert prose-sm"
                  />
                )}
                {slide.link && (
                  <Link
                    href={slide.link.href}
                    className="inline-block px-6 py-2 bg-accent text-white font-medium rounded hover:bg-accent/90 transition-colors self-start"
                    {...(slide.link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  >
                    {slide.link.text || 'Více'}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {data.slides.length > 1 && (
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
