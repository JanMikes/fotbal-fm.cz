'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ChevronDown, Facebook, Instagram, Youtube, Twitter } from 'lucide-react';

const mainNavItems = [
  {
    label: 'O klubu',
    href: '/o-klubu',
    dropdown: [
      { label: 'Historie', href: '/o-klubu/historie' },
      { label: 'Vedení', href: '/o-klubu/vedeni' },
      { label: 'Stadion', href: '/o-klubu/stadion' },
    ],
  },
  { label: 'Novinky', href: '/novinky' },
  { label: 'Fotogalerie', href: '/fotogalerie' },
  { label: 'Kontakt', href: '/kontakt' },
];

const categoryTabs = [
  { label: 'Muži', id: 'muzi' },
  { label: 'Dorostenci', id: 'dorostenci' },
  { label: 'Ženy', id: 'zeny' },
  { label: 'Mladší žáci', id: 'mladsi-zaci' },
  { label: 'Starší žáci', id: 'starsi-zaci' },
];

const socialLinks = [
  { icon: Facebook, href: 'https://facebook.com', label: 'Facebook' },
  { icon: Instagram, href: 'https://instagram.com', label: 'Instagram' },
  { icon: Youtube, href: 'https://youtube.com', label: 'YouTube' },
  { icon: Twitter, href: 'https://twitter.com', label: 'X (Twitter)' },
];

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('muzi');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white shadow-lg'
        )}
      >
        {/* Level 1 - Main Navigation */}
        <div className={clsx(
          'transition-all duration-300',
          isScrolled ? 'py-2' : 'py-4'
        )}>
          <div className="container mx-auto px-4 lg:px-8">
            <div className="flex items-center justify-between">
              {/* Logo */}
              <Link href="/" className="flex items-center gap-3 group">
                <div className={clsx(
                  'relative transition-all duration-300',
                  isScrolled ? 'w-10 h-10' : 'w-14 h-14'
                )}>
                  <Image
                    src="/logo.svg"
                    alt="FK Frýdek-Místek"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
                <span className={clsx(
                  'font-bold uppercase tracking-tight transition-all duration-300 text-primary',
                  isScrolled ? 'text-sm' : 'text-base',
                  'hidden sm:block'
                )}>
                  FK Frýdek-Místek
                </span>
              </Link>

              {/* Desktop Navigation */}
              <nav className="hidden lg:flex items-center gap-1">
                {mainNavItems.map((item) => (
                  <div
                    key={item.label}
                    className="relative"
                    onMouseEnter={() => item.dropdown && setOpenDropdown(item.label)}
                    onMouseLeave={() => setOpenDropdown(null)}
                  >
                    <Link
                      href={item.href}
                      className={clsx(
                        'flex items-center gap-1 px-4 py-2 font-medium text-sm uppercase tracking-wide transition-colors',
                        'text-primary hover:text-accent',
                        'link-hover'
                      )}
                    >
                      {item.label}
                      {item.dropdown && (
                        <ChevronDown className={clsx(
                          'w-4 h-4 transition-transform',
                          openDropdown === item.label && 'rotate-180'
                        )} />
                      )}
                    </Link>

                    {/* Dropdown */}
                    {item.dropdown && (
                      <AnimatePresence>
                        {openDropdown === item.label && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            transition={{ duration: 0.2 }}
                            className="absolute top-full left-0 mt-2 w-48 py-2 bg-white shadow-card-hover"
                          >
                            {item.dropdown.map((subItem) => (
                              <Link
                                key={subItem.label}
                                href={subItem.href}
                                className="block px-4 py-2 text-sm text-primary hover:bg-surface-light hover:text-accent transition-colors"
                              >
                                {subItem.label}
                              </Link>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )}
                  </div>
                ))}
              </nav>

              {/* Social Icons & Mobile Menu Button */}
              <div className="flex items-center gap-4">
                {/* Desktop Social Links */}
                <div className="hidden lg:flex items-center gap-2">
                  {socialLinks.map((social) => (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 rounded-full flex items-center justify-center transition-colors text-primary/60 hover:text-accent hover:bg-surface-light"
                      aria-label={social.label}
                    >
                      <social.icon className="w-4 h-4" />
                    </a>
                  ))}
                </div>

                {/* Mobile Menu Button */}
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="lg:hidden w-10 h-10 rounded-full flex items-center justify-center transition-colors text-primary hover:bg-surface-light"
                  aria-label="Otevřít menu"
                >
                  <Menu className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Level 2 - Category Tabs */}
        <div className="border-t transition-all duration-300 border-primary/10">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-2">
              {categoryTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={clsx(
                    'px-4 py-2 text-sm font-medium whitespace-nowrap transition-all duration-300',
                    activeCategory === tab.id
                      ? 'bg-accent text-white'
                      : 'text-primary/70 hover:text-primary hover:bg-surface-light'
                  )}
                >
                  {tab.label}
                </button>
              ))}
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
                {mainNavItems.map((item, index) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Link
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block py-3 text-xl font-semibold text-white hover:text-accent transition-colors"
                    >
                      {item.label}
                    </Link>
                    {item.dropdown && (
                      <div className="pl-4 space-y-1">
                        {item.dropdown.map((subItem) => (
                          <Link
                            key={subItem.label}
                            href={subItem.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="block py-2 text-white/70 hover:text-white transition-colors"
                          >
                            {subItem.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </nav>

              {/* Mobile Category Tabs */}
              <div className="mb-8">
                <p className="text-small text-white/50 uppercase tracking-wider mb-3">
                  Týmy
                </p>
                <div className="flex flex-wrap gap-2">
                  {categoryTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveCategory(tab.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={clsx(
                        'px-4 py-2 text-sm font-medium transition-colors',
                        activeCategory === tab.id
                          ? 'bg-accent text-white'
                          : 'bg-white/10 text-white/70 hover:text-white'
                      )}
                    >
                      {tab.label}
                    </button>
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
