import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-montserrat',
  weight: ['400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: 'FK Frýdek-Místek | Oficiální web fotbalového klubu',
  description:
    'Oficiální webové stránky fotbalového klubu FK Frýdek-Místek. Novinky, zápasy, tým a vše o klubu.',
  keywords: [
    'FK Frýdek-Místek',
    'fotbal',
    'MSFL',
    'Frýdek-Místek',
    'fotbalový klub',
    'moravskoslezská fotbalová liga',
  ],
  authors: [{ name: 'FK Frýdek-Místek' }],
  openGraph: {
    type: 'website',
    locale: 'cs_CZ',
    url: 'https://fkfm.cz',
    siteName: 'FK Frýdek-Místek',
    title: 'FK Frýdek-Místek | Oficiální web fotbalového klubu',
    description:
      'Oficiální webové stránky fotbalového klubu FK Frýdek-Místek. Novinky, zápasy, tým a vše o klubu.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FK Frýdek-Místek | Oficiální web fotbalového klubu',
    description:
      'Oficiální webové stránky fotbalového klubu FK Frýdek-Místek. Novinky, zápasy, tým a vše o klubu.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs" className={montserrat.variable}>
      <body className="font-sans">
        {children}
      </body>
    </html>
  );
}
