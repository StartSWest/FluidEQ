/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { BRAND_MARK, PRODUCT_NAME } from '../../common/branding';

/**
 * The app icon's wave colours, first stop to last: Lagoon, as every still
 * mark of the app draws them (`rainbowPalette.ts`' `LAGOON`, which lives on
 * the renderer's side and cannot be imported into main).
 */
const LAGOON = [
  '#72f7dd',
  '#00e5cf',
  '#00dbe6',
  '#00ccf5',
  '#27b8ff',
  '#51a3ff',
  '#7a95ff',
] as const;

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] ?? character,
  );

const stops = LAGOON.map(
  (colour, index) =>
    `<stop offset="${(index / (LAGOON.length - 1)).toFixed(3)}" stop-color="${colour}"/>`,
).join('');

/**
 * The app icon as the window's header draws it: the icon's dark face inside
 * a Lagoon edge, the wave across it at the icon's weight. Vector, so it is
 * sharp at any zoom and on any screen.
 */
const logoTile = `<svg class="tile" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
<defs>
<linearGradient id="face" x1="0" y1="0" x2=".55" y2="1"><stop stop-color="#101722"/><stop offset=".5" stop-color="#080b11"/><stop offset="1" stop-color="#030508"/></linearGradient>
<linearGradient id="edge" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>
<linearGradient id="wave" x1="0" y1="0" x2="1" y2="0">${stops}</linearGradient>
</defs>
<rect x=".75" y=".75" width="46.5" height="46.5" rx="12" fill="url(#face)" stroke="url(#edge)" stroke-width="1.5"/>
<path d="${BRAND_MARK.path}" transform="translate(4.8 4.8) scale(.8)" fill="none" stroke="url(#wave)" stroke-width="5.6" stroke-linecap="round"/>
</svg>`;

/** "Fluid" in white and "EQ" in Lagoon, as the header spells the name. */
const wordmark = PRODUCT_NAME.endsWith('EQ')
  ? `<span class="word">${escapeHtml(PRODUCT_NAME.slice(0, -2))}<span class="eq">EQ</span></span>`
  : `<span class="word">${escapeHtml(PRODUCT_NAME)}</span>`;

const GLYPHS = {
  // A tick in a ring: done.
  done: '<path d="M8 12.4l2.7 2.7L16.2 9.4"/>',
  // A bar and a dot in a ring: something to read.
  failed: '<path d="M12 7.6v5.2"/><path d="M12 16.3v.1"/>',
} as const;

export type TOAuthPageTone = keyof typeof GLYPHS;

/**
 * The browser tab's last page after Google: FluidEQ's logo and name, what
 * happened and what to do, in the reader's language and the app's own dark
 * glass. Served by the app's loopback server (`oauthLoopback.ts`), never by
 * the sign-in service, in one file with nothing to fetch, so the page's own
 * policy can refuse everything. Ivan, 2026-11-13: it was a plain card that
 * read as a stub; "we need a nice fluid logo there too".
 */
export const oauthPage = (
  lang: string,
  tone: TOAuthPageTone,
  title: string,
  body: string,
): string => `<!doctype html>
<html lang="${escapeHtml(lang)}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>${escapeHtml(title)} · ${escapeHtml(PRODUCT_NAME)}</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;min-height:100%}
body{display:grid;place-items:center;min-height:100vh;padding:24px;color:#e8f4f6;
background:radial-gradient(60% 50% at 30% 18%,rgba(0,204,245,.16),transparent 70%),
radial-gradient(55% 45% at 78% 88%,rgba(122,149,255,.14),transparent 70%),#060a0f;
font:15px/1.55 -apple-system,"Segoe UI",Ubuntu,Cantarell,"Noto Sans","DejaVu Sans",sans-serif;
font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}
main{width:min(460px,100%);padding:40px 36px 30px;border-radius:22px;text-align:center;
background:linear-gradient(180deg,rgba(0,204,245,.07),transparent 42%) padding-box,
linear-gradient(#0b1219,#0b1219) padding-box,
linear-gradient(135deg,rgba(114,247,221,.5),rgba(39,184,255,.16) 45%,rgba(122,149,255,.45)) border-box;
border:1px solid transparent;
box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 0 1px rgba(0,0,0,.4)}
.brand{display:flex;flex-direction:column;align-items:center;gap:12px;margin-bottom:30px}
.tile{width:64px;height:64px;filter:drop-shadow(0 10px 24px rgba(39,184,255,.3))}
.tile path{filter:drop-shadow(0 0 1.5px rgba(0,204,245,.7))}
.word{font-size:26px;font-weight:700;letter-spacing:-.01em;line-height:1}
.eq{background:linear-gradient(90deg,#00e5cf,#27b8ff 60%,#7a95ff);-webkit-background-clip:text;background-clip:text;color:transparent}
.state{display:flex;flex-direction:column;align-items:center;gap:12px;padding-top:26px;border-top:1px solid rgba(255,255,255,.07)}
.glyph{width:40px;height:40px;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.glyph circle{stroke-width:1.5}
.done .glyph{stroke:#00e5cf}.done .glyph circle{fill:rgba(0,229,207,.12)}
.failed .glyph{stroke:#ffb86b}.failed .glyph circle{fill:rgba(255,184,107,.12)}
h1{margin:0 0 6px;font-size:22px;font-weight:700;line-height:1.3;text-wrap:balance}
p{margin:0 auto;max-width:40ch;color:#a7bfc6;text-wrap:pretty}
.wave{display:block;width:100%;height:24px;margin-top:30px;opacity:.45}
</style></head>
<body><main class="${tone}">
<div class="brand">${logoTile}${wordmark}</div>
<div class="state"><svg class="glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10.25"/>${GLYPHS[tone]}</svg>
<div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p></div></div>
<svg class="wave" viewBox="0 0 440 28" preserveAspectRatio="none" aria-hidden="true" focusable="false"><defs><linearGradient id="line" x1="0" y1="0" x2="1" y2="0">${stops}</linearGradient></defs>
<path d="M0 14C18 2 37 2 55 14S92 26 110 14 147 2 165 14 202 26 220 14 257 2 275 14 312 26 330 14 367 2 385 14 422 26 440 14" fill="none" stroke="url(#line)" stroke-width="1.5" stroke-linecap="round"/></svg>
</main></body></html>`;
