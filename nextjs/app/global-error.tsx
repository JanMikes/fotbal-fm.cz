'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="cs">
      <body>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Něco se pokazilo!</h2>
          <button
            onClick={() => reset()}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
            }}
          >
            Zkusit znovu
          </button>
        </div>
      </body>
    </html>
  );
}
