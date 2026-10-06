/*
 * The "temporarily unavailable" page the record gate (src/proxy.ts) answers with 503 when a
 * route's own record cannot be loaded. Self-contained HTML (the proxy answers before Next.js
 * renders anything, so no layout, no bundles): the site's colours and type, the copy and buttons
 * of the 404 page's style. It retries by itself after RETRY_AFTER_S, matching `Retry-After`.
 */

export const RETRY_AFTER_S = 30;

export const UNAVAILABLE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Retry-After': String(RETRY_AFTER_S),
  'Cache-Control': 'no-store',
} as const;

export const UNAVAILABLE_HTML = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="${RETRY_AFTER_S}">
<title>Stránka je dočasně nedostupná | FK Frýdek-Místek</title>
<style>
  :root { --primary: #081E44; --accent: #149AD5; --accent-dark: #065A8F; --surface-light: #F5F7FA; }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  body {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: var(--surface-light); color: var(--primary);
    font-family: Montserrat, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  main { text-align: center; padding: 2rem 1rem; max-width: 34rem; }
  .code { font-size: 6rem; line-height: 1; font-weight: 900; color: rgba(8, 30, 68, 0.1); margin: 0 0 1rem; }
  h1 { font-size: 1.5rem; font-weight: 700; margin: 0 0 1rem; }
  p { color: rgba(8, 30, 68, 0.6); line-height: 1.6; margin: 0 0 2rem; }
  .actions { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
  a { display: inline-block; padding: 0.75rem 2rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.05em; text-decoration: none; transition: background-color 0.15s, color 0.15s; }
  .primary { background: var(--accent); color: #fff; }
  .primary:hover { background: var(--accent-dark); }
  .secondary { border: 2px solid var(--primary); color: var(--primary); padding: calc(0.75rem - 2px) calc(2rem - 2px); }
  .secondary:hover { background: var(--primary); color: #fff; }
</style>
</head>
<body>
<main>
  <p class="code" aria-hidden="true">503</p>
  <h1>Stránka je dočasně nedostupná</h1>
  <p>Omlouváme se, obsah této stránky se nám teď nepodařilo načíst. Zkuste to prosím za chvíli znovu&nbsp;— stránka se sama obnoví za ${RETRY_AFTER_S}&nbsp;sekund.</p>
  <div class="actions">
    <a class="primary" href="">Zkusit znovu</a>
    <a class="secondary" href="/">Úvodní stránka</a>
  </div>
</main>
</body>
</html>
`;
