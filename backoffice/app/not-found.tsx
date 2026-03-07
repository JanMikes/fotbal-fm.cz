'use client';

export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>404 - Stránka nenalezena</h2>
      <p>Požadovaná stránka nebyla nalezena.</p>
      <a href="/" style={{ color: '#0070f3', textDecoration: 'underline' }}>
        Zpět na hlavní stránku
      </a>
    </div>
  );
}
