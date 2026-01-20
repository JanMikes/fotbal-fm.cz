'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Facebook, Instagram, Youtube, Twitter, Mail, Phone, MapPin, ArrowRight } from 'lucide-react';
import Button from '../ui/Button';

const footerLinks = {
  klub: [
    { label: 'O nás', href: '/o-klubu' },
    { label: 'Historie', href: '/o-klubu/historie' },
    { label: 'Stadion', href: '/o-klubu/stadion' },
    { label: 'Vedení', href: '/o-klubu/vedeni' },
  ],
  zapasy: [
    { label: 'Kalendář', href: '/zapasy/kalendar' },
    { label: 'Výsledky', href: '/zapasy/vysledky' },
    { label: 'Tabulka', href: '/zapasy/tabulka' },
  ],
  kontakt: [
    { icon: MapPin, text: 'Sportovní 1234, 738 01 Frýdek-Místek' },
    { icon: Mail, text: 'info@fkfm.cz', href: 'mailto:info@fkfm.cz' },
    { icon: Phone, text: '+420 558 123 456', href: 'tel:+420558123456' },
  ],
};

const socialLinks = [
  { icon: Facebook, href: 'https://facebook.com', label: 'Facebook' },
  { icon: Instagram, href: 'https://instagram.com', label: 'Instagram' },
  { icon: Youtube, href: 'https://youtube.com', label: 'YouTube' },
  { icon: Twitter, href: 'https://twitter.com', label: 'X (Twitter)' },
];

export default function Footer() {
  const [email, setEmail] = useState('');

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle newsletter subscription
    console.log('Newsletter subscription:', email);
    setEmail('');
  };

  return (
    <footer className="bg-primary-500 text-white">
      {/* Main Footer Content */}
      <div className="container mx-auto px-4 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          {/* Logo & Description */}
          <div className="lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-3 mb-6">
              <div className="relative w-16 h-16">
                <Image
                  src="/logo.svg"
                  alt="FK Frýdek-Místek"
                  fill
                  className="object-contain"
                />
              </div>
            </Link>
            <p className="text-white/60 text-body mb-6 leading-relaxed">
              FK Frýdek-Místek - tradiční fotbalový klub s bohatou historií a vášní pro hru.
            </p>
            <div className="flex items-center gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-accent hover:text-white transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Links - Klub */}
          <div>
            <h4 className="font-bold uppercase tracking-wider text-small mb-6">
              Klub
            </h4>
            <ul className="space-y-3">
              {footerLinks.klub.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-white/60 hover:text-white transition-colors inline-flex items-center gap-2 group"
                  >
                    <span>{link.label}</span>
                    <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Links - Zápasy */}
          <div>
            <h4 className="font-bold uppercase tracking-wider text-small mb-6">
              Zápasy
            </h4>
            <ul className="space-y-3">
              {footerLinks.zapasy.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-white/60 hover:text-white transition-colors inline-flex items-center gap-2 group"
                  >
                    <span>{link.label}</span>
                    <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold uppercase tracking-wider text-small mb-6">
              Kontakt
            </h4>
            <ul className="space-y-4">
              {footerLinks.kontakt.map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <item.icon className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  {item.href ? (
                    <a
                      href={item.href}
                      className="text-white/60 hover:text-white transition-colors"
                    >
                      {item.text}
                    </a>
                  ) : (
                    <span className="text-white/60">{item.text}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Newsletter */}
        <div className="mt-16 pt-12 border-t border-white/10">
          <div className="max-w-xl">
            <h4 className="font-bold uppercase tracking-wider text-small mb-2">
              Newsletter
            </h4>
            <p className="text-white/60 mb-6">
              Přihlaste se k odběru novinek a nikdy nepropásněte důležité informace.
            </p>
            <form onSubmit={handleNewsletterSubmit} className="flex">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Váš e-mail"
                className="flex-1 px-4 py-3 bg-white/10 border border-white/20 border-r-0 text-white placeholder:text-white/40 focus:outline-none focus:bg-white/15 focus:border-accent transition-colors"
                required
              />
              <button
                type="submit"
                className="px-6 py-3 bg-accent text-white font-semibold uppercase tracking-wider text-small hover:bg-accent-dark transition-colors whitespace-nowrap"
              >
                Odebírat
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="container mx-auto px-4 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-small text-white/50">
            <p>&copy; 2026 FK Frýdek-Místek. Všechna práva vyhrazena.</p>
            <div className="flex items-center gap-6">
              <Link href="/ochrana-osobnich-udaju" className="hover:text-white transition-colors">
                Ochrana osobních údajů
              </Link>
              <Link href="/cookies" className="hover:text-white transition-colors">
                Cookies
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
