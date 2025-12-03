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

          {/* Navigation Links */}
          {!loading && (
            <div className="flex items-center space-x-4 ml-auto">
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname === '/dashboard'
                        ? 'text-white bg-white/20 font-semibold'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/vysledky"
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname === '/vysledky' || pathname.startsWith('/vysledek/')
                        ? 'text-white bg-white/20 font-semibold'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Výsledky
                  </Link>
                  <Link
                    href="/udalosti"
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname === '/udalosti' || pathname.startsWith('/udalost/')
                        ? 'text-white bg-white/20 font-semibold'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Události
                  </Link>
                  <Link
                    href="/turnaje"
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname === '/turnaje' || pathname.startsWith('/turnaj/')
                        ? 'text-white bg-white/20 font-semibold'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Turnaje
                  </Link>

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
        </div>
      </div>
    </nav>
  );
}
