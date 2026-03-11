import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import Script from 'next/script';
import { Header, Footer } from '@/components/layout';
import { ScrollToTop } from '@/components/ScrollToTop';
import { getCategoryGroups, getFooter, getNavigation } from '@/lib/strapi/data';
import './globals.css';

const GA_ID = 'G-5P268SSMFT';

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
  other: {
    'msapplication-TileColor': '#0a1e44',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [categoryGroups, navigation, footer] = await Promise.all([
    getCategoryGroups(),
    getNavigation(),
    getFooter(),
  ]);

  return (
    <html lang="cs" className={montserrat.variable}>
      {process.env.NODE_ENV === 'production' && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="google-analytics" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
          </Script>
        </>
      )}
      <body className="font-sans">
        <ScrollToTop />
        <Header categoryGroups={categoryGroups} navigation={navigation} />
        {children}
        <Footer footer={footer} />
      </body>
    </html>
  );
}
