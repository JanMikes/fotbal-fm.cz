'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from '../ui/Button';
import { heroSlides } from '@/data/mockData';

export default function Hero() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, duration: 30 },
    [Autoplay({ delay: 6000, stopOnInteraction: false })]
  );

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const scrollTo = useCallback(
    (index: number) => {
      if (emblaApi) emblaApi.scrollTo(index);
    },
    [emblaApi]
  );

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <section className="relative h-[calc(100vh-7rem)] lg:h-[calc(100vh-8rem)] min-h-[500px] mt-28 lg:mt-32 clip-diagonal-bottom">
      {/* Carousel Container */}
      <div className="embla h-full" ref={emblaRef}>
        <div className="embla__container h-full">
          {heroSlides.map((slide, index) => (
            <div key={slide.id} className="embla__slide relative h-full min-h-[500px] bg-primary">
              {/* Background Image */}
              {slide.image && (
                <Image
                  src={slide.image}
                  alt={slide.title}
                  fill
                  className="object-cover"
                  priority={index === 0}
                  sizes="100vw"
                />
              )}

              {/* Overlay Gradient */}
              <div className="absolute inset-0 bg-gradient-hero" />

              {/* Content */}
              <div className="absolute inset-0 flex items-center">
                <div className="container mx-auto px-4 lg:px-8">
                  <AnimatePresence mode="wait">
                    {selectedIndex === index && (
                      <motion.div
                        key={slide.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="max-w-4xl"
                      >
                        {/* Match Slide */}
                        {slide.type === 'match' && slide.match && (
                          <div className="text-center lg:text-left">
                            <motion.p
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.1 }}
                              className="text-accent font-semibold uppercase tracking-wider mb-4"
                            >
                              {slide.subtitle}
                            </motion.p>

                            {/* Match Display */}
                            <motion.div
                              initial={{ opacity: 0, y: 30 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.2 }}
                              className="flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-6 lg:gap-12 mb-8"
                            >
                              {/* Home Team */}
                              <div className="flex flex-col items-center gap-3">
                                <div className="w-20 h-20 lg:w-28 lg:h-28 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
                                  <span className="text-2xl lg:text-3xl font-bold text-white">FM</span>
                                </div>
                                <span className="text-white font-semibold text-lg">
                                  {slide.match.homeTeam.name}
                                </span>
                              </div>

                              {/* VS */}
                              <div className="flex flex-col items-center">
                                <span className="text-5xl lg:text-7xl font-black text-white/30">VS</span>
                              </div>

                              {/* Away Team */}
                              <div className="flex flex-col items-center gap-3">
                                <div className="w-20 h-20 lg:w-28 lg:h-28 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
                                  <span className="text-2xl lg:text-3xl font-bold text-white/70">
                                    {slide.match.awayTeam.name.substring(0, 2).toUpperCase()}
                                  </span>
                                </div>
                                <span className="text-white/80 font-semibold text-lg">
                                  {slide.match.awayTeam.name}
                                </span>
                              </div>
                            </motion.div>

                            {/* Match Info */}
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.3 }}
                              className="text-white/70 mb-8 space-y-1"
                            >
                              <p className="text-lg">{slide.match.date} &bull; {slide.match.time}</p>
                              <p>{slide.match.venue}</p>
                            </motion.div>

                            {slide.ctaText && (
                              <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                              >
                                <Button variant="primary" size="lg">
                                  {slide.ctaText}
                                </Button>
                              </motion.div>
                            )}
                          </div>
                        )}

                        {/* News/Promo Slide */}
                        {(slide.type === 'news' || slide.type === 'promo') && (
                          <div className="text-center lg:text-left">
                            {slide.subtitle && (
                              <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="text-accent font-semibold uppercase tracking-wider mb-4"
                              >
                                {slide.subtitle}
                              </motion.p>
                            )}

                            <motion.h1
                              initial={{ opacity: 0, y: 30 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.2 }}
                              className="text-hero text-white uppercase mb-6"
                            >
                              {slide.title}
                            </motion.h1>

                            {slide.description && (
                              <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="text-white/70 text-body-lg max-w-2xl mb-8"
                              >
                                {slide.description}
                              </motion.p>
                            )}

                            {slide.ctaText && (
                              <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                              >
                                <Button variant="outline" size="lg">
                                  {slide.ctaText}
                                </Button>
                              </motion.div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Arrows */}
      <div className="absolute bottom-32 lg:bottom-40 left-4 lg:left-8 flex items-center gap-3 z-10">
        <button
          onClick={scrollPrev}
          className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          aria-label="Předchozí"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={scrollNext}
          className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          aria-label="Další"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Dot Indicators */}
      <div className="absolute bottom-32 lg:bottom-40 right-4 lg:right-8 flex items-center gap-2 z-10">
        {heroSlides.map((_, index) => (
          <button
            key={index}
            onClick={() => scrollTo(index)}
            className={clsx(
              'h-2 rounded-full transition-all duration-300',
              selectedIndex === index
                ? 'w-8 bg-accent'
                : 'w-2 bg-white/30 hover:bg-white/50'
            )}
            aria-label={`Přejít na slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-2"
        >
          <motion.div className="w-1.5 h-1.5 rounded-full bg-white/50" />
        </motion.div>
      </motion.div>
    </section>
  );
}
