'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ChevronLeft, ChevronRight, Facebook, Instagram, Youtube, Twitter } from 'lucide-react';
import type { CategoryGroup, NavigationItem } from '@/lib/types';

const socialLinks = [
  { icon: Facebook, href: 'https://facebook.com', label: 'Facebook' },
  { icon: Instagram, href: 'https://instagram.com', label: 'Instagram' },
  { icon: Youtube, href: 'https://youtube.com', label: 'YouTube' },
  { icon: Twitter, href: 'https://twitter.com', label: 'X (Twitter)' },
];

interface HeaderProps {
  categoryGroups: CategoryGroup[];
  navigation?: NavigationItem[];
}

export default function Header({ categoryGroups, navigation = [] }: HeaderProps) {
  const pathname = usePathname();
  const activeCategorySlug = useMemo(() => {
    const match = pathname.match(/^\/kategorie\/([^/]+)/);
    return match ? match[1] : '';
  }, [pathname]);
  const activeGroupSlug = useMemo(() => {
    return categoryGroups.find((g) =>
      g.categories.some((c) => c.slug === activeCategorySlug)
    )?.slug ?? '';
  }, [categoryGroups, activeCategorySlug]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const updateScrollIndicators = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  const scrollCategories = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.6;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  }, []);



  // Track category scroll state & auto-scroll active item into view
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollIndicators();
    el.addEventListener('scroll', updateScrollIndicators, { passive: true });

    const resizeObserver = new ResizeObserver(updateScrollIndicators);
    resizeObserver.observe(el);

    // Scroll active group into view
    const activeLink = el.querySelector('[data-active="true"]') as HTMLElement | null;
    if (activeLink) {
      const elRect = el.getBoundingClientRect();
      const linkRect = activeLink.getBoundingClientRect();
      if (linkRect.left < elRect.left || linkRect.right > elRect.right) {
        activeLink.scrollIntoView({ inline: 'center', behavior: 'smooth' });
      }
    }

    return () => {
      el.removeEventListener('scroll', updateScrollIndicators);
      resizeObserver.disconnect();
    };
  }, [categoryGroups, activeGroupSlug, updateScrollIndicators]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isMobileMenuOpen]);

  return (
    <>
      <header
        className={clsx(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-[#0d1727] shadow-lg'
        )}
      >
        <div className="w-full px-4 lg:px-8">
          <div className="flex items-stretch">
            {/* Logo - spans both nav levels via row-span */}
            <Link href="/" className="flex items-center shrink-0 z-20 group py-2 pr-6 border-r border-primary-border">
              <div className="relative w-14 h-14 lg:w-24 lg:h-24">
                <Image
                  src="/logo.svg"
                  alt="FK Frýdek-Místek"
                  fill
                  className="object-contain drop-shadow-lg"
                  priority
                />
              </div>
            </Link>

            {/* Right side: two rows */}
            <div className="flex flex-col flex-1 min-w-0">
              {/* Level 1 - Main Navigation */}
              <div className="flex items-center flex-1 lg:flex-none py-2.5 lg:py-3.5 pl-6 lg:border-b lg:border-primary-border">
                {/* Desktop Navigation (left-aligned) */}
                <nav className="hidden lg:flex items-center gap-6">
                  {navigation.map((item) => {
                    const linkProps = item.external
                      ? { target: '_blank' as const, rel: 'noopener noreferrer' }
                      : {};
                    const isActive = !item.external && pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        {...linkProps}
                        className={clsx(
                          'flex items-center gap-1 py-2 text-base tracking-wide uppercase transition-colors',
                          isActive
                            ? 'font-bold text-accent'
                            : 'font-medium text-white/80 hover:text-white',
                          'link-hover'
                        )}
                      >
                        {item.title}
                      </Link>
                    );
                  })}
                </nav>

                {/* Social Icons & Mobile Menu Button */}
                <div className="flex items-center gap-4 ml-auto">
                  {/* Desktop Social Links */}
                  <div className="hidden lg:flex items-center gap-2">
                    {socialLinks.map((social) => (
                      <a
                        key={social.label}
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-9 h-9 rounded-full flex items-center justify-center transition-colors text-white/60 hover:text-white hover:bg-white/10"
                        aria-label={social.label}
                      >
                        <social.icon className="w-4 h-4" />
                      </a>
                    ))}
                  </div>

                  {/* Mobile Menu Button */}
                  <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="lg:hidden w-10 h-10 rounded-full border border-white/30 flex items-center justify-center transition-colors text-white hover:bg-white/10"
                    aria-label="Otevřít menu"
                  >
                    <Menu className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Level 2 - Category Tabs (hidden on mobile, shown in hamburger menu) */}
              <div className="relative hidden lg:block pl-6">
                {/* Left scroll indicator */}
                <div
                  className={clsx(
                    'absolute left-0 top-0 bottom-0 z-10 flex items-center transition-opacity duration-200',
                    canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  )}
                >
                  <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#0d1727] to-transparent pointer-events-none" />
                  <button
                    onClick={() => scrollCategories('left')}
                    className="relative w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all"
                    aria-label="Posunout kategorie doleva"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>

                {/* Scrollable category groups */}
                <div
                  ref={scrollRef}
                  className="flex items-center gap-3 overflow-x-auto scrollbar-hide py-4"
                >
                  {categoryGroups.map((group) => (
                    <Link
                      key={group.slug}
                      href={`/kategorie/${group.firstCategorySlug}`}
                      data-active={activeGroupSlug === group.slug}
                      className={clsx(
                        'px-3.5 py-1.5 text-xs whitespace-nowrap rounded-full border uppercase transition-all duration-300',
                        activeGroupSlug === group.slug
                          ? 'font-bold bg-accent text-white border-accent'
                          : 'font-medium text-white/80 border-white/30 hover:text-white hover:border-white/60'
                      )}
                    >
                      {group.name}
                    </Link>
                  ))}
                </div>

                {/* Right scroll indicator */}
                <div
                  className={clsx(
                    'absolute right-0 top-0 bottom-0 z-10 flex items-center transition-opacity duration-200',
                    canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  )}
                >
                  <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#0d1727] to-transparent pointer-events-none" />
                  <button
                    onClick={() => scrollCategories('right')}
                    className="relative w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all"
                    aria-label="Posunout kategorie doprava"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] lg:hidden"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-primary/95 backdrop-blur-lg"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Menu Content */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-primary p-6 overflow-y-auto"
            >
              {/* Close Button */}
              <div className="flex justify-end mb-8">
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                  aria-label="Zavřít menu"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Mobile Navigation */}
              <nav className="space-y-2 mb-8">
                {navigation.map((item, index) => (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Link
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className="block py-3 text-xl font-semibold text-white hover:text-accent transition-colors"
                    >
                      {item.title}
                    </Link>
                  </motion.div>
                ))}
              </nav>

              {/* Mobile Category Groups */}
              <div className="mb-8">
                <p className="text-small text-white/50 uppercase tracking-wider mb-3">
                  Týmy
                </p>
                <div className="flex flex-wrap gap-2">
                  {categoryGroups.map((group) => (
                    <Link
                      key={group.slug}
                      href={`/kategorie/${group.firstCategorySlug}`}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={clsx(
                        'px-4 py-2 text-sm font-medium transition-colors',
                        activeGroupSlug === group.slug
                          ? 'bg-accent text-white'
                          : 'bg-white/10 text-white/70 hover:text-white'
                      )}
                    >
                      {group.name}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Mobile Social Links */}
              <div>
                <p className="text-small text-white/50 uppercase tracking-wider mb-3">
                  Sledujte nás
                </p>
                <div className="flex gap-3">
                  {socialLinks.map((social) => (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-accent transition-colors"
                      aria-label={social.label}
                    >
                      <social.icon className="w-5 h-5" />
                    </a>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
