import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="bg-surface-light min-h-screen flex items-center justify-center mt-22 lg:mt-24">
      <div className="text-center px-4">
        <h1 className="text-8xl font-black text-primary/10 mb-4">404</h1>
        <h2 className="text-2xl font-bold text-primary mb-4">Stránka nenalezena</h2>
        <p className="text-primary/60 mb-8 max-w-md mx-auto">
          Omlouváme se, ale požadovaná stránka neexistuje nebo byla přesunuta.
        </p>
        <Link
          href="/"
          className="inline-block px-8 py-3 bg-accent text-white font-semibold uppercase tracking-wide hover:bg-accent-dark transition-colors"
        >
          Zpět na úvodní stránku
        </Link>
      </div>
    </main>
  );
}
