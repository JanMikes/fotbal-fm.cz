'use client';

import { useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { StrapiImage } from '@/types/match-result';

interface ImageGalleryProps {
  images: StrapiImage[];
  className?: string;
}

export default function ImageGallery({ images, className = '' }: ImageGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const slides = images.map((image) => ({
    src: image.url,
    alt: image.alternativeText || '',
    width: image.width,
    height: image.height,
  }));

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <>
      <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 ${className}`}>
        {images.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => openLightbox(index)}
            className="block group cursor-pointer"
          >
            <img
              src={
                image.formats?.thumbnail
                  ? image.formats.thumbnail.url
                  : image.url
              }
              alt={image.alternativeText || `Fotografie ${index + 1}`}
              className="w-full h-28 object-cover rounded-lg border-2 border-border group-hover:border-primary transition-all duration-200 group-hover:shadow-lg group-hover:shadow-primary/20"
            />
          </button>
        ))}
      </div>

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={slides}
      />
    </>
  );
}
