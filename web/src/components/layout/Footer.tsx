import Link from 'next/link';
import Image from 'next/image';
import { Facebook, Instagram, Mail, Phone, MapPin, ArrowRight } from 'lucide-react';
import type { Footer as FooterType } from '@/lib/types';

const socialLinks = [
  { icon: Facebook, href: 'https://www.facebook.com/fotbalfm', label: 'Facebook' },
  { icon: Instagram, href: 'https://www.instagram.com/fotbal_fm/', label: 'Instagram' },
  // { icon: Youtube, href: 'https://youtube.com', label: 'YouTube' },
  // { icon: Twitter, href: 'https://twitter.com', label: 'X (Twitter)' },
];

interface FooterProps {
  footer: FooterType | null;
}

export default function Footer({ footer }: FooterProps) {
  const contactItems = [
    footer?.address ? { icon: MapPin, text: footer.address } : null,
    footer?.mail ? { icon: Mail, text: footer.mail, href: `mailto:${footer.mail}` } : null,
    footer?.phone ? { icon: Phone, text: footer.phone, href: `tel:${footer.phone.replace(/\s/g, '')}` } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  const linkSections = footer?.linkSections ?? [];
  const bottomLinks = footer?.bottomLinks ?? [];

  return (
    <footer className="bg-primary-500 text-white">
      {/* Main Footer Content */}
      <div className="container mx-auto px-4 lg:px-8 py-16">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-10 lg:gap-8">
          {/* Logo & Description - takes 2 cols on small screens */}
          <div className="col-span-2">
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
            {footer?.text && (
              <p className="text-white/60 text-body mb-6 leading-relaxed">
                {footer.text}
              </p>
            )}
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

          {/* Dynamic Link Sections from Strapi */}
          {linkSections.map((section, index) => (
            <div key={index}>
              <h4 className="font-bold uppercase tracking-wider text-small mb-6">
                {section.title}
              </h4>
              <ul className="space-y-3">
                {section.links.map((link, linkIndex) => {
                  const props = link.external
                    ? { target: '_blank' as const, rel: 'noopener noreferrer' }
                    : {};
                  return (
                    <li key={linkIndex}>
                      <Link
                        href={link.href}
                        className="text-white/60 hover:text-white transition-colors inline-flex items-center gap-2 group"
                        {...props}
                      >
                        <span>{link.text}</span>
                        <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {/* Contact */}
          {contactItems.length > 0 && (
            <div className="col-span-2">
              <h4 className="font-bold uppercase tracking-wider text-small mb-6">
                Kontakt
              </h4>
              <ul className="space-y-4">
                {contactItems.map((item, index) => (
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
          )}
        </div>

        {/* Partners */}
        {footer?.partnerSections && footer.partnerSections.length > 0 && (
          <div className="mt-16 pt-12 border-t border-white/10">
            <div className="flex flex-wrap gap-12">
              {footer.partnerSections.map((section, index) => (
                <div key={index}>
                  <h4 className="font-bold uppercase tracking-wider text-small text-accent mb-4">
                    {section.title}
                  </h4>
                  <div className="flex flex-wrap items-center gap-6">
                    {section.partners.map((partner, partnerIndex) => {
                      const content = partner.logo ? (
                        <Image
                          src={partner.logo.url}
                          alt={partner.logo.alternativeText || partner.name}
                          width={partner.logo.width}
                          height={partner.logo.height}
                          className="h-10 w-auto object-contain brightness-0 invert opacity-70 hover:opacity-100 transition-opacity"
                        />
                      ) : (
                        <span className="text-white/60 text-small">{partner.name}</span>
                      );

                      return partner.link ? (
                        <a
                          key={partnerIndex}
                          href={partner.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={partner.name}
                        >
                          {content}
                        </a>
                      ) : (
                        <span key={partnerIndex} title={partner.name}>
                          {content}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="container mx-auto px-4 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-small text-white/50">
            <p>&copy; 2026 FK Frýdek-Místek. Všechna práva vyhrazena.</p>
            {bottomLinks.length > 0 && (
              <div className="flex items-center gap-6">
                {bottomLinks.map((link, index) => {
                  const props = link.external
                    ? { target: '_blank' as const, rel: 'noopener noreferrer' }
                    : {};
                  return (
                    <Link
                      key={index}
                      href={link.href}
                      className="hover:text-white transition-colors"
                      {...props}
                    >
                      {link.text}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
