'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import Button from './ui/Button';
import { useState, useRef, useEffect } from 'react';

export default function Navbar() {
  const { user, loading, logout } = useUser();
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', isActive: pathname === '/dashboard' },
    { href: '/vysledky', label: 'Výsledky', isActive: pathname === '/vysledky' || pathname.startsWith('/vysledek/') },
    { href: '/udalosti', label: 'Události', isActive: pathname === '/udalosti' || pathname.startsWith('/udalost/') },
    { href: '/turnaje', label: 'Turnaje', isActive: pathname === '/turnaje' || pathname.startsWith('/turnaj/') },
  ];

  return (
    <nav className="bg-primary border-b border-primary-dark sticky top-0 z-50 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo / Brand */}
          <div className="absolute top-[5px] left-4 sm:left-6 lg:left-8 z-10">
            <Link
              href="/"
              className="block hover:opacity-80 transition-opacity"
            >
              <Image
                src="/logo.svg"
                alt="MFK Frýdek-Místek"
                width={75}
                height={90}
                className="h-[90px] w-auto"
                priority
              />
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          {!loading && (
            <div className="hidden md:flex items-center space-x-4 ml-auto">
              {user ? (
                <>
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        link.isActive
                          ? 'text-white bg-white/20 font-semibold'
                          : 'text-white/80 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}

                  {/* User Menu Dropdown */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      className="flex items-center space-x-2 text-white/80 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-white/10"
                    >
                      <span>
                        {user.firstName} {user.lastName}
                      </span>
                      <svg
                        className={`w-4 h-4 transition-transform duration-200 ${
                          dropdownOpen ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {dropdownOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg py-1 z-10 border border-border animate-in fade-in slide-in-from-top-2 duration-200">
                        <Link
                          href="/nastaveni"
                          className={`block px-4 py-2 text-sm transition-colors ${
                            pathname === '/nastaveni'
                              ? 'text-primary bg-accent/10 font-semibold'
                              : 'text-text-primary hover:bg-surface-hover'
                          }`}
                          onClick={() => setDropdownOpen(false)}
                        >
                          Nastavení
                        </Link>
                        <div className="my-1 border-t border-border"></div>
                        <button
                          onClick={() => {
                            setDropdownOpen(false);
                            logout();
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-danger hover:bg-danger-bg transition-colors"
                        >
                          Odhlásit se
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Link href="/prihlaseni">
                    <Button variant="secondary" size="sm">
                      Přihlášení
                    </Button>
                  </Link>
                  <Link href="/registrace">
                    <Button variant="primary" size="sm">
                      Registrace
                    </Button>
                  </Link>
                </>
              )}
            </div>
          )}

          {/* Mobile Menu Button */}
          {!loading && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden ml-auto p-2 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              aria-label={mobileMenuOpen ? 'Zavřít menu' : 'Otevřít menu'}
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && !loading && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Menu Panel */}
          <div className="fixed top-16 left-0 right-0 bg-primary border-b border-primary-dark z-50 md:hidden animate-in slide-in-from-top duration-200">
            <div className="px-4 py-4 space-y-2">
              {user ? (
                <>
                  {/* User Info */}
                  <div className="px-3 py-2 text-white/60 text-sm border-b border-white/10 mb-2">
                    {user.firstName} {user.lastName}
                  </div>

                  {/* Navigation Links */}
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`block px-3 py-3 rounded-md text-base font-medium transition-colors ${
                        link.isActive
                          ? 'text-white bg-white/20 font-semibold'
                          : 'text-white/80 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}

                  {/* Settings Link */}
                  <Link
                    href="/nastaveni"
                    className={`block px-3 py-3 rounded-md text-base font-medium transition-colors ${
                      pathname === '/nastaveni'
                        ? 'text-white bg-white/20 font-semibold'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Nastavení
                  </Link>

                  {/* Logout Button */}
                  <div className="pt-2 border-t border-white/10">
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        logout();
                      }}
                      className="block w-full text-left px-3 py-3 rounded-md text-base font-medium text-red-300 hover:text-red-200 hover:bg-white/10 transition-colors"
                    >
                      Odhlásit se
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col space-y-2">
                  <Link href="/prihlaseni" className="w-full">
                    <Button variant="secondary" size="md" className="w-full">
                      Přihlášení
                    </Button>
                  </Link>
                  <Link href="/registrace" className="w-full">
                    <Button variant="primary" size="md" className="w-full">
                      Registrace
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
