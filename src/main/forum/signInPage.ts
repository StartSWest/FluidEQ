import { BRAND_MARK, PRODUCT_NAME } from '../../common/branding';

/**
 * The page the browser lands on when GitHub sends it back.
 *
 * The person has just been in their browser and the app is behind it, so the
 * page's one job is to say what happened and that the rest continues in
 * FluidEQ. Self-contained — no script, no request, nothing to load — and it
 * forbids itself anything else, since the only thing the browser will ever
 * fetch from this address is this one answer.
 */

export type TSignInPageTone = 'success' | 'failure';

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });

const signInPage = (
  lang: string,
  tone: TSignInPageTone,
  title: string,
  body: string,
): string => {
  const accent = tone === 'success' ? '#19f2d0' : '#ff8a9c';
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(PRODUCT_NAME)} — ${escapeHtml(title)}</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    background: radial-gradient(circle at 50% 30%, #0f2a33 0, #071217 60%, #04090c 100%);
    color: #ecf5fb;
    font: 15px/1.6 -apple-system, "Segoe UI", Ubuntu, Cantarell, "Noto Sans", "DejaVu Sans", sans-serif;
  }
  main {
    max-width: 420px; padding: 40px 36px; text-align: center;
    border: 1px solid rgba(214, 233, 247, 0.1); border-radius: 18px;
    background: rgba(12, 30, 38, 0.72);
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45), 0 0 60px ${accent}14;
  }
  svg { width: 56px; height: 56px; color: ${accent}; filter: drop-shadow(0 0 14px ${accent}66); }
  h1 { margin: 18px 0 8px; font-size: 20px; font-weight: 600; }
  p { margin: 0; color: #bfd3e3; }
</style>
</head>
<body>
<main>
  <svg viewBox="${BRAND_MARK.viewBox}" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" aria-hidden="true"><path d="${BRAND_MARK.path}"/></svg>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(body)}</p>
</main>
</body>
</html>`;
};

export default signInPage;
