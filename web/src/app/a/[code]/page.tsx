import type { Metadata } from 'next';
import QRCode from 'qrcode';
import { Breadcrumb } from '@/components/ui';
import DeepLinkLanding from '@/components/sections/DeepLinkLanding';
import {
  androidIntentUrl,
  appSchemeUrl,
  appStoreUrl,
  deepLinkUrl,
  formatDeepLinkCode,
  isValidDeepLinkCode,
  normalizeDeepLinkCode,
  playStoreUrl,
} from '@/lib/app-links';
import { config } from '@/lib/config';
import { pageMetadata } from '@/lib/seo';
import { getDeepLinkByCode } from '@/lib/strapi/data';

/**
 * Landing page of a deep link (fotbal-fm.cz/a/<code>). Phones with the app installed never
 * see it — Universal Links / App Links open the app directly. Everyone else gets routed to
 * the right store with the code kept in tow, or a QR code on desktop.
 */

interface DeepLinkPageProps {
  params: Promise<{ code: string }>;
}

const DESCRIPTION = 'Pozvánka do mobilní aplikace FK Frýdek-Místek. Stáhněte si aplikaci a zůstaňte v obraze.';

/**
 * The code we build URLs from: the stored one when the link exists, otherwise the visitor's
 * input only if it has the code shape. Anything else (garbage in the path) yields null and
 * the page shows the "unknown link" state without a QR code or a Smart App Banner argument.
 */
async function resolveCode(rawCode: string) {
  const link = await getDeepLinkByCode(rawCode);
  const normalized = normalizeDeepLinkCode(rawCode);
  const canonicalCode = link?.code ?? (isValidDeepLinkCode(normalized) ? normalized : null);
  return { link, canonicalCode };
}

export async function generateMetadata({ params }: DeepLinkPageProps): Promise<Metadata> {
  const { code } = await params;
  const { canonicalCode } = await resolveCode(code);

  return {
    ...pageMetadata({
      title: 'Pozvánka do aplikace',
      description: DESCRIPTION,
      path: canonicalCode ? `/a/${canonicalCode}` : '/a',
      noIndex: true,
    }),
    // Smart App Banner: "Open" on phones with the app, "View" (App Store) without it.
    itunes: {
      appId: config.mobileApp.iosAppStoreId,
      ...(canonicalCode ? { appArgument: deepLinkUrl(canonicalCode) } : {}),
    },
  };
}

export default async function DeepLinkPage({ params }: DeepLinkPageProps) {
  const { code } = await params;
  const { link, canonicalCode } = await resolveCode(code);
  const claimable = link?.status === 'valid';
  const url = canonicalCode ? deepLinkUrl(canonicalCode) : null;

  const qrSvg = url
    ? await QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#081E44', light: '#FFFFFF' } })
    : null;

  return (
    <main className="bg-surface-light pt-[72px] lg:pt-[126px]">
      <section className="pb-section">
        <div className="container mx-auto max-w-2xl px-4 lg:px-8">
          <Breadcrumb items={[{ label: 'Pozvánka do aplikace', href: canonicalCode ? `/a/${canonicalCode}` : '/a' }]} />
          <DeepLinkLanding
            link={link}
            formattedCode={canonicalCode ? formatDeepLinkCode(canonicalCode) : null}
            url={url}
            qrSvg={qrSvg}
            appStoreUrl={appStoreUrl()}
            playStoreUrl={playStoreUrl(claimable && canonicalCode ? canonicalCode : undefined)}
            androidIntentUrl={canonicalCode ? androidIntentUrl(canonicalCode) : null}
            schemeUrl={canonicalCode ? appSchemeUrl(canonicalCode) : null}
          />
        </div>
      </section>
    </main>
  );
}
