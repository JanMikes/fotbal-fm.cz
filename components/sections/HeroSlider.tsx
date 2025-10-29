'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar, MapPin } from 'lucide-react';
import type { Match } from '@/types';

interface HeroSliderProps {
  nextMatch?: Match;
  category: string;
}

export default function HeroSlider({ nextMatch, category }: HeroSliderProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      id: 1,
      type: 'match',
      title: nextMatch ? 'Příští zápas' : 'Fotbal Frýdek-Místek',
      subtitle: nextMatch
        ? `${nextMatch.homeTeam} vs ${nextMatch.awayTeam}`
        : 'Sledujte naše zápasy',
      data: nextMatch,
    },
    {
      id: 2,
      type: 'team',
      title: 'Náš tým',
      subtitle: 'Podpořte naše hráče',
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <section className="relative min-h-[600px] md:h-[600px] overflow-hidden bg-gradient-to-br from-primary via-primary/95 to-secondary/20">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.5 }}
          className="relative min-h-[600px] md:h-full flex items-center py-12 md:py-0"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="text-center text-white">
              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-3xl md:text-6xl font-bold mb-3 md:mb-4"
              >
                {slides[currentSlide].title}
              </motion.h1>

              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-lg md:text-2xl text-gray-200 mb-6 md:mb-8"
              >
                {slides[currentSlide].subtitle}
              </motion.p>

              {slides[currentSlide].type === 'match' && nextMatch && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="bg-white/10 backdrop-blur-md rounded-2xl p-4 md:p-8 max-w-2xl mx-auto border border-white/20"
                >
                  <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-8 mb-3 md:mb-4">
                    <div className="text-center flex-1">
                      <div className="w-16 h-16 md:w-24 md:h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                        <span className="text-xl md:text-2xl font-bold">FM</span>
                      </div>
                      <p className="font-semibold text-sm md:text-lg">{nextMatch.homeTeam}</p>
                    </div>

                    <div className="text-2xl md:text-4xl font-bold text-secondary">VS</div>

                    <div className="text-center flex-1">
                      <div className="w-16 h-16 md:w-24 md:h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                        <span className="text-xl md:text-2xl font-bold">?</span>
                      </div>
                      <p className="font-semibold text-sm md:text-lg">{nextMatch.awayTeam}</p>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-6 text-xs md:text-base">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 md:w-5 md:h-5 text-secondary" />
                      <span>{formatDate(nextMatch.date)} v {nextMatch.time}</span>
                    </div>
                    {nextMatch.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 md:w-5 md:h-5 text-secondary" />
                        <span>{nextMatch.location}</span>
                      </div>
                    )}
                  </div>

                  {nextMatch.competition && (
                    <div className="mt-3 md:mt-4 text-secondary font-semibold text-sm md:text-base">
                      {nextMatch.competition} - {nextMatch.round}
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Arrows */}
      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full p-2 md:p-3 transition-colors"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-6 h-6 text-white" />
      </button>

      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full p-2 md:p-3 transition-colors"
        aria-label="Next slide"
      >
        <ChevronRight className="w-6 h-6 text-white" />
      </button>

      {/* Dots Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentSlide ? 'bg-secondary w-8' : 'bg-white/50'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
