import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import {
  appStoreUrl,
  parseUpfanReturnPath,
  playStoreUrl,
  upfanReturnAndroidIntentUrl,
  upfanReturnQuery,
  upfanReturnSchemeUrl,
} from '@/lib/app-links';

/**
 * Return pages of the Upfan ticket checkout: /upfan[/test]/{buyer-return,payment-return}.
 *
 * Upfan redirects the buyer here after its verification panel and after the payment page.
 * On a phone with the app these URLs are Universal Links / App Links and the app opens
 * directly — this page is only the fallback when that did not happen (link opened inside
 * another browser, app not installed). It never confirms anything: the app checks the
 * purchase with our API. The query (Upfan order id) must not leak — no referrer, no cache.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Návrat do aplikace | FK Frýdek-Místek',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

interface UpfanReturnPageProps {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const COPY = {
  'buyer-return': {
    title: 'Ověření dokončeno',
    text: 'Vraťte se do aplikace FK Frýdek-Místek a dokončete nákup vstupenek.',
  },
  'payment-return': {
    title: 'Platba odeslána',
    text: 'Vraťte se do aplikace FK Frýdek-Místek – tam uvidíte výsledek platby a své vstupenky.',
  },
} as const;

const primaryButton =
  'inline-flex w-full items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent-dark sm:w-auto';

export default async function UpfanReturnPage({ params, searchParams }: UpfanReturnPageProps) {
  const { path } = await params;
  const ret = parseUpfanReturnPath(path);
  if (!ret) notFound();

  const query = upfanReturnQuery(await searchParams);
  const isAndroid = /android/i.test((await headers()).get('user-agent') ?? '');
  const openAppUrl = isAndroid ? upfanReturnAndroidIntentUrl(ret, query) : upfanReturnSchemeUrl(ret, query);
  const copy = COPY[ret.kind];

  return (
    <main className="bg-surface-light pt-[72px] lg:pt-(--header-h)">
      <section className="pb-section pt-10">
        <div className="container mx-auto max-w-2xl px-4 lg:px-8">
          <h1 className="text-section text-primary uppercase accent-underline mb-8">{copy.title}</h1>
          {ret.sandbox && (
            <p className="mb-4 inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase text-accent">
              Testovací nákup
            </p>
          )}
          <p className="mb-8 text-lg text-primary">{copy.text}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a href={openAppUrl} className={primaryButton}>
              Pokračovat v aplikaci
            </a>
          </div>
          <p className="mt-10 text-sm text-text-muted">
            Nemáte aplikaci? Stáhněte si ji v{' '}
            <a href={appStoreUrl()} className="font-semibold text-primary underline">
              App Store
            </a>{' '}
            nebo na{' '}
            <a href={playStoreUrl()} className="font-semibold text-primary underline">
              Google Play
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
