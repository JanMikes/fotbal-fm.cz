'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { CategoryGroup, NavigationItem, SocialLink } from '@/lib/types';
import SocialIcon from '@/components/ui/SocialIcon';

interface NavigationPage {
  title: string;
  slug: string;
}

interface HeaderProps {
  categoryGroups: CategoryGroup[];
  navigation?: NavigationItem[];
  navigationPages?: NavigationPage[];
  socialLinks?: SocialLink[];
}

export default function Header({ categoryGroups, navigation = [], navigationPages = [], socialLinks = [] }: HeaderProps) {
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
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  const primaryNav = useMemo(() => navigation.filter((item) => item.level === 1), [navigation]);
  const secondaryNav = useMemo(() => navigation.filter((item) => item.level === 2), [navigation]);
  const isNavItemActive = (item: NavigationItem) => !item.external && pathname.startsWith(item.href);

  const activeGroup = useMemo(() => {
    return categoryGroups.find((g) => g.slug === activeGroupSlug);
  }, [categoryGroups, activeGroupSlug]);

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

  // Close category dropdown on outside click
  useEffect(() => {
    if (!isCategoryDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isCategoryDropdownOpen]);

  return (
    <>
      <header
        className={clsx(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-[#0d1727] shadow-lg'
        )}
      >
        {/* Level 1 - full-width top row above the logo, social icons on the right (desktop only;
            40px + border — keep --header-h in globals.css in sync) */}
        <div className="hidden lg:flex items-center gap-6 h-10 px-8 border-b border-primary-border">
          <nav className="flex items-center gap-6 min-w-0 overflow-x-auto scrollbar-hide" aria-label="Hlavní menu">
            {primaryNav.map((item, index) => (
              <Link
                key={`${index}-${item.href}`}
                href={item.href}
                {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className={clsx(
                  'text-xs tracking-wide uppercase whitespace-nowrap transition-colors',
                  isNavItemActive(item)
                    ? 'font-bold text-accent'
                    : 'font-medium text-white/70 hover:text-white',
                  'link-hover'
                )}
              >
                {item.title}
              </Link>
            ))}
          </nav>

          {socialLinks.length > 0 && (
            <div className="flex items-center gap-1 ml-auto shrink-0">
              {socialLinks.map((social) => (
                <a
                  key={`${social.network}-${social.href}`}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors text-white/60 hover:text-white hover:bg-white/10"
                  aria-label={social.label}
                  title={social.label}
                >
                  <SocialIcon network={social.network} className="w-4 h-4" />
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="w-full px-4 lg:px-8">
          <div className="flex items-stretch">
            {/* Logo - spans the level 2 row and the category row */}
            <Link href="/" className="flex items-center shrink-0 z-20 group py-2 pr-6 lg:border-r lg:border-primary-border">
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

            {/* Right side: level 2 + category rows */}
            <div className="flex flex-col flex-1 min-w-0 lg:justify-center">
              {/* Mobile: category dropdown & menu button */}
              <div className="flex lg:hidden items-center justify-end gap-3 flex-1 py-2.5 pl-6">
                <div ref={categoryDropdownRef} className="relative">
                  <button
                    onClick={() => setIsCategoryDropdownOpen((v) => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white border border-white/30 rounded-full uppercase transition-colors hover:bg-white/10"
                  >
                    {activeGroup?.name ?? 'Týmy'}
                    <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', isCategoryDropdownOpen && 'rotate-180')} />
                  </button>

                  <AnimatePresence>
                    {isCategoryDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 min-w-[10rem] bg-[#0d1727] border border-white/20 rounded-xl p-2 shadow-xl z-50"
                      >
                        {categoryGroups.map((group) => (
                          <Link
                            key={group.slug}
                            href={`/kategorie/${group.firstCategorySlug}`}
                            onClick={() => setIsCategoryDropdownOpen(false)}
                            className={clsx(
                              'block px-3 py-2 text-xs font-medium uppercase rounded-lg transition-colors',
                              activeGroupSlug === group.slug
                                ? 'bg-accent text-white'
                                : 'text-white/70 hover:text-white hover:bg-white/10'
                            )}
                          >
                            {group.name}
                          </Link>
                        ))}
                        {navigationPages.map((page) => (
                          <Link
                            key={`page-${page.slug}`}
                            href={`/${page.slug}`}
                            onClick={() => setIsCategoryDropdownOpen(false)}
                            className={clsx(
                              'block px-3 py-2 text-xs font-medium uppercase rounded-lg transition-colors',
                              pathname === `/${page.slug}`
                                ? 'bg-accent text-white'
                                : 'text-white/70 hover:text-white hover:bg-white/10'
                            )}
                          >
                            {page.title}
                          </Link>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center transition-colors text-white hover:bg-white/10"
                  aria-label="Otevřít menu"
                >
                  <Menu className="w-6 h-6" />
                </button>
              </div>

              {/* Level 2 - beside the logo (desktop only, 56px + border — keep --header-h in globals.css in sync) */}
              {secondaryNav.length > 0 && (
                <nav className="hidden lg:flex items-center gap-6 h-14 pl-6 border-b border-primary-border overflow-x-auto scrollbar-hide" aria-label="Vedlejší menu">
                  {secondaryNav.map((item, index) => (
                    <Link
                      key={`${index}-${item.href}`}
                      href={item.href}
                      {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className={clsx(
                        'flex items-center gap-1 py-2 text-sm tracking-wide uppercase whitespace-nowrap transition-colors',
                        isNavItemActive(item)
                          ? 'font-bold text-accent'
                          : 'font-medium text-white/80 hover:text-white',
                        'link-hover'
                      )}
                    >
                      {item.title}
                    </Link>
                  ))}
                </nav>
              )}

              {/* Level 3 - Category Tabs (hidden on mobile, shown in hamburger menu) */}
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
                  {navigationPages.map((page) => (
                    <Link
                      key={`page-${page.slug}`}
                      href={`/${page.slug}`}
                      data-active={pathname === `/${page.slug}`}
                      className={clsx(
                        'px-3.5 py-1.5 text-xs whitespace-nowrap rounded-full border uppercase transition-all duration-300',
                        pathname === `/${page.slug}`
                          ? 'font-bold bg-accent text-white border-accent'
                          : 'font-medium text-white/80 border-white/30 hover:text-white hover:border-white/60'
                      )}
                    >
                      {page.title}
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
                {primaryNav.map((item, index) => (
                  <motion.div
                    key={`${index}-${item.href}`}
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

              {secondaryNav.length > 0 && (
                <nav className="space-y-1 mb-8 pt-6 border-t border-white/10">
                  {secondaryNav.map((item, index) => (
                    <motion.div
                      key={`${index}-${item.href}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: (primaryNav.length + index) * 0.1 }}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                        className="block py-2 text-base font-medium text-white/70 hover:text-accent transition-colors"
                      >
                        {item.title}
                      </Link>
                    </motion.div>
                  ))}
                </nav>
              )}

              {/* Mobile Social Links */}
              {socialLinks.length > 0 && (
              <div>
                <p className="text-small text-white/50 uppercase tracking-wider mb-3">
                  Sledujte nás
                </p>
                <div className="flex gap-3">
                  {socialLinks.map((social) => (
                    <a
                      key={`${social.network}-${social.href}`}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-accent transition-colors"
                      aria-label={social.label}
                    >
                      <SocialIcon network={social.network} className="w-5 h-5" />
                    </a>
                  ))}
                </div>
              </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
