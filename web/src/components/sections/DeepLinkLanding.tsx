'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { DeepLink } from '@/lib/types';

interface DeepLinkLandingProps {
  link: DeepLink | null;
  /** null when the path did not even look like a code */
  formattedCode: string | null;
  url: string | null;
  qrSvg: string | null;
  appStoreUrl: string;
  playStoreUrl: string;
  androidIntentUrl: string | null;
  schemeUrl: string | null;
}

type Platform = 'ios' | 'android' | 'other';

const STATUS_MESSAGES: Record<Exclude<DeepLink['status'], 'valid'>, string> = {
  inactive: 'Tento odkaz už není aktivní.',
  expired: 'Platnost tohoto odkazu vypršela.',
};

function detectPlatform(userAgent: string): Platform {
  if (/android/i.test(userAgent)) return 'android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
  return 'other';
}

const subscribeNever = () => () => {};

/** null during SSR and hydration (generic layout), the real platform right after. */
function usePlatform(): Platform | null {
  return useSyncExternalStore(
    subscribeNever,
    () => detectPlatform(navigator.userAgent),
    () => null,
  );
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const primaryButton =
  'inline-flex w-full items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent-dark sm:w-auto';
const secondaryButton =
  'inline-flex w-full items-center justify-center rounded-full border-2 border-primary px-6 py-3 text-sm font-semibold uppercase tracking-wide text-primary transition-colors hover:bg-primary hover:text-white sm:w-auto';

export default function DeepLinkLanding({
  link,
  formattedCode,
  url,
  qrSvg,
  appStoreUrl,
  playStoreUrl,
  androidIntentUrl,
  schemeUrl,
}: DeepLinkLandingProps) {
  const platform = usePlatform();
  const [copied, setCopied] = useState(false);
  const claimable = link?.status === 'valid' && url !== null;

  // Android: the intent opens an installed app, otherwise lands on Google Play with the
  // install referrer. Chrome may require a tap for intents, hence the button below too.
  useEffect(() => {
    if (platform !== 'android' || !claimable || !androidIntentUrl) return undefined;
    const timer = window.setTimeout(() => window.location.replace(androidIntentUrl), 500);
    return () => window.clearTimeout(timer);
  }, [platform, androidIntentUrl, claimable]);

  // iOS has no install referrer: the link goes to the clipboard first, the app checks it on
  // first launch. Navigation happens after the copy so the user gesture covers both.
  async function handleAppStoreClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!claimable || !url) return;
    event.preventDefault();
    await copyToClipboard(url);
    window.location.href = appStoreUrl;
  }

  async function handleCopy() {
    if (!url) return;
    setCopied(await copyToClipboard(url));
    window.setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div>
        <h1 className="text-section text-primary uppercase accent-underline mb-8">Pozvánka do aplikace</h1>

        {link && claimable ? (
          <>
            <p className="mb-2 text-lg font-semibold text-primary">{link.name}</p>
            {link.audienceCategories.length > 0 && (
              <div className="mb-8">
                <p className="mb-3 text-text-muted">Po přihlášení v aplikaci vás zařadíme do skupin:</p>
                <ul className="flex flex-wrap gap-2">
                  {link.audienceCategories.map((category) => (
                    <li
                      key={category.slug}
                      className="rounded-full bg-surface-light px-4 py-1.5 text-sm font-semibold text-primary"
                      title={category.description ?? undefined}
                    >
                      {category.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <div className="mb-8 rounded-lg border border-accent/30 bg-surface-light p-4 text-primary">
            <p className="font-semibold">{link ? STATUS_MESSAGES[link.status as keyof typeof STATUS_MESSAGES] : 'Tento odkaz neexistuje.'}</p>
            <p className="mt-1 text-sm text-text-muted">
              Aplikaci si přesto můžete stáhnout a skupiny si zvolit v nastavení.
            </p>
          </div>
        )}

        {/* Platform-specific call to action; before hydration we show the generic version. */}
        {platform === 'android' && (
          <div className="flex flex-col gap-3 sm:flex-row">
            <a href={claimable && androidIntentUrl ? androidIntentUrl : playStoreUrl} className={primaryButton}>
              Otevřít nebo nainstalovat aplikaci
            </a>
            <a href={playStoreUrl} className={secondaryButton}>
              Google Play
            </a>
          </div>
        )}

        {platform === 'ios' && (
          <div className="flex flex-col gap-3 sm:flex-row">
            <a href={appStoreUrl} onClick={handleAppStoreClick} className={primaryButton}>
              Stáhnout v App Store
            </a>
            {schemeUrl && (
              <a href={schemeUrl} className={secondaryButton}>
                Mám aplikaci – otevřít
              </a>
            )}
          </div>
        )}

        {(platform === 'other' || platform === null) && (
          <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-start">
            {qrSvg && (
              <div
                className="mx-auto w-44 rounded-lg border border-surface-light bg-white p-2 shadow-sm md:mx-0"
                aria-label="QR kód s odkazem do aplikace"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            )}
            <div>
              <p className="mb-4 text-text-muted">
                Naskenujte QR kód telefonem, nebo si otevřete tento odkaz přímo v mobilu. Aplikace je k dispozici pro
                iPhone i Android.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <a href={appStoreUrl} className={primaryButton} target="_blank" rel="noopener noreferrer">
                  App Store
                </a>
                <a href={playStoreUrl} className={primaryButton} target="_blank" rel="noopener noreferrer">
                  Google Play
                </a>
              </div>
            </div>
          </div>
        )}

        {claimable && formattedCode && (
          <div className="mt-10 rounded-lg bg-surface-light p-5">
            <p className="text-sm text-text-muted">Kód pozvánky</p>
            <p className="my-1 font-mono text-3xl font-bold tracking-widest text-primary">{formattedCode}</p>
            <p className="text-sm text-text-muted">
              {platform === 'ios'
                ? 'Po instalaci aplikaci otevřete – pozvánka se načte sama. Když ne, klepněte na tento odkaz znovu nebo kód zadejte v aplikaci.'
                : 'Pokud se pozvánka v aplikaci nenačte sama, klepněte na tento odkaz znovu nebo zadejte kód v aplikaci.'}
            </p>
            <button type="button" onClick={handleCopy} className={`${secondaryButton} mt-4`}>
              {copied ? 'Odkaz zkopírován' : 'Kopírovat odkaz'}
            </button>
          </div>
        )}
    </div>
  );
}
