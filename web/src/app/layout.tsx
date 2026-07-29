import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import Script from 'next/script';
import { Header, Footer } from '@/components/layout';
import { ScrollToTop } from '@/components/ScrollToTop';
import { getCategoryGroups, getFooter, getNavigation, getNavigationPages } from '@/lib/strapi/data';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/seo';
import './globals.css';

const GA_ID = 'G-5P268SSMFT';

const montserrat = Montserrat({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-montserrat',
  weight: ['400', '500', '600', '700', '800', '900'],
});

const SITE_TITLE = `${SITE_NAME} | Oficiální web fotbalového klubu`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: [
    'FK Frýdek-Místek',
    'Fotbal Frýdek-Místek',
    'Válcovny',
    'Lipina',
    'fotbal',
    'MSFL',
    'Frýdek-Místek',
    'fotbalový klub',
    'moravskoslezská fotbalová liga',
  ],
  authors: [{ name: SITE_NAME }],
  openGraph: {
    type: 'website',
    locale: 'cs_CZ',
    url: '/',
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
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
  const [categoryGroups, navigation, navigationPages, footer] = await Promise.all([
    getCategoryGroups(),
    getNavigation(),
    getNavigationPages(),
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
        <Header categoryGroups={categoryGroups} navigation={navigation} navigationPages={navigationPages} />
        {children}
        <Footer footer={footer} />
      </body>
    </html>
  );
}
