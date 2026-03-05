'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight, Mouse, ChevronDown } from 'lucide-react';
import Button from '../ui/Button';
import TeamLogo from '../ui/TeamLogo';
import type { CategoryHeroData, Match, MediaImage } from '@/lib/types';

interface HeroSlide {
  id: string;
  type: 'match-upcoming' | 'match-result' | 'news' | 'promo';
  image: MediaImage | null;
  title: string;
  subtitle?: string;
  round?: string;
  description?: string;
  match?: Match;
  link?: string;
  ctaText?: string;
}

interface HeroProps {
  upcomingMatch: Match | null;
  lastResult: Match | null;
  heroData: CategoryHeroData;
  categorySlug: string;
  categorySwitcher?: React.ReactNode;
}

function buildSlides(
  upcomingMatch: Match | null,
  lastResult: Match | null,
  heroData: CategoryHeroData,
  categorySlug: string,
): HeroSlide[] {
  const slides: HeroSlide[] = [];

  if (upcomingMatch) {
    slides.push({
      id: 'upcoming',
      type: 'match-upcoming',
      image: heroData.heroSlide1Image,
      title: 'Nadcházející zápas',
      subtitle: upcomingMatch.competitionName || undefined,
      round: upcomingMatch.round ? `${upcomingMatch.round}. kolo` : undefined,
      match: upcomingMatch,
    });
  }

  if (lastResult) {
    slides.push({
      id: 'result',
      type: 'match-result',
      image: heroData.heroSlide2Image,
      title: 'Poslední výsledek',
      subtitle: lastResult.competitionName || undefined,
      round: lastResult.round ? `${lastResult.round}. kolo` : undefined,
      match: lastResult,
    });
  }

  if (heroData.heroSlide3NewsArticle) {
    const article = heroData.heroSlide3NewsArticle;
    slides.push({
      id: 'slide3-article',
      type: 'news',
      image: heroData.heroSlide3Image ?? article.mainPhoto,
      title: article.title,
      subtitle: 'Článek',
      description: article.description ?? undefined,
      link: `/${categorySlug}/clanek/${article.slug}`,
      ctaText: 'Číst více',
    });
  } else if (heroData.heroSlide3Title && heroData.heroSlide3Text) {
    slides.push({
      id: 'slide3-custom',
      type: 'promo',
      image: heroData.heroSlide3Image,
      title: heroData.heroSlide3Title,
      description: heroData.heroSlide3Text,
      link: heroData.heroSlide3Link ?? undefined,
      ctaText: heroData.heroSlide3Link ? 'Zjistit více' : undefined,
    });
  }

  return slides;
}

function getSlideLabel(type: HeroSlide['type']): string {
  switch (type) {
    case 'match-upcoming': return 'Další zápas';
    case 'match-result': return 'Poslední zápas';
    case 'news': return 'Nejnovější aktualita';
    case 'promo': return '';
  }
}

export default function Hero({ upcomingMatch, lastResult, heroData, categorySlug, categorySwitcher }: HeroProps) {
  const slides = buildSlides(upcomingMatch, lastResult, heroData, categorySlug);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: slides.length > 1, duration: 30 },
    slides.length > 1 ? [Autoplay({ delay: 6000, stopOnInteraction: false })] : []
  );

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

  const scrollTo = useCallback(
    (index: number) => {
      if (!emblaApi) return;
      emblaApi.scrollTo(index);
      emblaApi.plugins().autoplay?.reset();
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

  if (slides.length === 0) return null;

  return (
    <section className="relative h-[820px] lg:h-[1000px] mt-0 clip-diagonal-bottom">
      {/* Carousel Container */}
      <div className="embla h-full" ref={emblaRef}>
        <div className="embla__container h-full">
          {slides.map((slide, index) => (
            <div key={slide.id} className="embla__slide relative h-full bg-primary">
              {/* Background Image */}
              {slide.image && (
                <Image
                  src={slide.image.url}
                  alt={slide.image.alternativeText ?? slide.title}
                  fill
                  className="object-cover"
                  priority={index === 0}
                  sizes="100vw"
                />
              )}

              {/* Overlay Gradient (only when no image) */}
              {!slide.image && <div className="absolute inset-0 bg-gradient-hero" />}

              {/* Content */}
              <div className="absolute top-[72px] lg:top-[130px] bottom-0 left-0 right-0 flex items-center">
                <div className="container mx-auto px-4 lg:px-8">
                  {/* Slide Label & Category Switcher */}
                  <div className="w-fit mb-6 lg:mb-10">
                    <p className="text-white/80 text-base lg:text-lg font-bold tracking-[0.15em] mb-3">
                      {getSlideLabel(slide.type)}
                    </p>
                    {categorySwitcher}
                  </div>
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
                        {/* Upcoming Match Slide */}
                        {slide.type === 'match-upcoming' && slide.match && (
                          <MatchSlide slide={slide} />
                        )}

                        {/* Last Result Slide */}
                        {slide.type === 'match-result' && slide.match && (
                          <ResultSlide slide={slide} />
                        )}

                        {/* News/Promo Slide */}
                        {(slide.type === 'news' || slide.type === 'promo') && (
                          <ContentSlide slide={slide} />
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

      {/* Navigation Arrows & Dot Indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-32 lg:bottom-40 inset-x-0 z-10">
          <div className="container mx-auto px-4 lg:px-8 flex items-center gap-3">
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
            <div className="flex items-center gap-2 ml-2">
              {slides.map((_, index) => (
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
          </div>
        </div>
      )}

      {/* Scroll Indicator */}
      <div className="absolute bottom-20 lg:bottom-24 right-6 lg:right-10 z-10 flex flex-col items-center gap-1 text-white/40 animate-bounce">
        <Mouse className="w-8 h-8" />
        <ChevronDown className="w-6 h-6 -mt-1" />
      </div>

    </section>
  );
}

function MatchSlide({ slide }: { slide: HeroSlide }) {
  const match = slide.match!;
  return (
    <div className="text-center lg:text-left">
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-accent text-xs uppercase tracking-[0.2em] mb-6"
      >
        {slide.subtitle}{slide.round && <>{' • '}<span className="font-extrabold">{slide.round}</span></>}
      </motion.p>

      {/* Match Display */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-4 lg:gap-10 mb-6"
      >
        {/* Home Team */}
        <div className="flex flex-col items-center gap-2">
          <TeamLogo
            name={match.homeTeam}
            logo={match.homeTeamLogo}
            size={80}
            className="w-16 h-16 lg:w-20 lg:h-20 rounded-full flex items-center justify-center"
            bgClassName="bg-white/10 backdrop-blur-sm border border-white/10"
            fallbackClassName="text-lg lg:text-xl font-black text-white"
          />
          <span className="text-white font-bold text-sm uppercase tracking-wide">
            {match.homeTeam}
          </span>
        </div>

        {/* VS */}
        <div className="flex flex-col items-center px-4">
          <span className="text-3xl lg:text-4xl font-black text-white">VS</span>
        </div>

        {/* Away Team */}
        <div className="flex flex-col items-center gap-2">
          <TeamLogo
            name={match.awayTeam}
            logo={match.awayTeamLogo}
            size={80}
            className="w-16 h-16 lg:w-20 lg:h-20 rounded-full flex items-center justify-center"
            bgClassName="bg-white/10 backdrop-blur-sm border border-white/10"
            fallbackClassName="text-lg lg:text-xl font-black text-white/60"
          />
          <span className="text-white/70 font-bold text-sm uppercase tracking-wide">
            {match.awayTeam}
          </span>
        </div>
      </motion.div>

      {/* Match Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="inline-flex flex-col items-center lg:items-start mb-6"
      >
        <span className="inline-block -ml-4 bg-white/15 backdrop-blur-sm rounded-full px-4 py-1.5 text-white text-sm font-semibold">
          {match.matchDate} &bull; {match.matchTime}
        </span>
        {match.venue && <p className="text-white/60 text-xs mt-4">{match.venue}</p>}
      </motion.div>
    </div>
  );
}

function ResultSlide({ slide }: { slide: HeroSlide }) {
  const match = slide.match!;
  return (
    <div className="text-center lg:text-left">
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-accent text-xs uppercase tracking-[0.2em] mb-6"
      >
        {slide.subtitle}{slide.round && <>{' • '}<span className="font-extrabold">{slide.round}</span></>}
      </motion.p>

      {/* Result Display */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-4 lg:gap-10 mb-6"
      >
        {/* Home Team */}
        <div className="flex flex-col items-center gap-2">
          <TeamLogo
            name={match.homeTeam}
            logo={match.homeTeamLogo}
            size={80}
            className="w-16 h-16 lg:w-20 lg:h-20 rounded-full flex items-center justify-center"
            bgClassName="bg-white/10 backdrop-blur-sm border border-white/10"
            fallbackClassName="text-lg lg:text-xl font-black text-white"
          />
          <span className="text-white font-bold text-sm uppercase tracking-wide">
            {match.homeTeam}
          </span>
        </div>

        {/* Score */}
        <div className="flex flex-col items-center px-4">
          <span className="text-4xl lg:text-5xl font-black text-white">
            {match.homeScore} : {match.awayScore}
          </span>
        </div>

        {/* Away Team */}
        <div className="flex flex-col items-center gap-2">
          <TeamLogo
            name={match.awayTeam}
            logo={match.awayTeamLogo}
            size={80}
            className="w-16 h-16 lg:w-20 lg:h-20 rounded-full flex items-center justify-center"
            bgClassName="bg-white/10 backdrop-blur-sm border border-white/10"
            fallbackClassName="text-lg lg:text-xl font-black text-white/60"
          />
          <span className="text-white/70 font-bold text-sm uppercase tracking-wide">
            {match.awayTeam}
          </span>
        </div>
      </motion.div>

      {/* Match Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="inline-flex flex-col items-center lg:items-start mb-6"
      >
        <span className="inline-block -ml-4 bg-white/15 backdrop-blur-sm rounded-full px-4 py-1.5 text-white text-sm font-semibold">
          {match.matchDate}
        </span>
        {match.venue && <p className="text-white/60 text-xs mt-4">{match.venue}</p>}
      </motion.div>
    </div>
  );
}

function ContentSlide({ slide }: { slide: HeroSlide }) {
  return (
    <div className="text-center lg:text-left max-w-3xl">
      {slide.subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-accent text-xs font-bold uppercase tracking-[0.2em] mb-4"
        >
          {slide.subtitle}
        </motion.p>
      )}

      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-3xl md:text-4xl lg:text-5xl text-white font-black uppercase leading-tight mb-4"
      >
        {slide.title}
      </motion.h1>

      {slide.description && (
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-white/60 text-sm lg:text-base font-medium max-w-xl mb-6 leading-relaxed"
        >
          {slide.description}
        </motion.p>
      )}

      {slide.ctaText && slide.link && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Link href={slide.link}>
            <Button variant="outline" size="md">
              {slide.ctaText}
            </Button>
          </Link>
        </motion.div>
      )}
    </div>
  );
}
