/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The desktop wallpaper surfaces' content security policy: nothing but the
 * app's own files, and nothing fetched.
 *
 * Delivered twice, as the main window's is (`contentSecurityPolicy.ts`), and
 * both are needed. The header set on the wallpaper's session (`window.ts`)
 * reaches documents served over HTTP — the development server — but Electron
 * never calls `onHeadersReceived` for `file://`, which is how a packaged
 * build loads the page: there the meta tag in `wallpaper/index.ejs`, written
 * by the renderer's webpack configs from this same function, is the only
 * policy. Until 2026-09-26 the wallpaper had the header alone, so every
 * packaged build ran its surfaces — somebody else's scenes among them — with
 * no policy at all.
 *
 * `'unsafe-eval'` and the development server's socket only in development,
 * where webpack's hot reload needs them.
 */
const wallpaperContentSecurityPolicy = (isDebug: boolean): string =>
  [
    "default-src 'none'",
    isDebug ? "script-src 'self' 'unsafe-eval'" : "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "worker-src 'self' blob:",
    isDebug
      ? "connect-src 'self' ws://localhost:* ws://127.0.0.1:*"
      : "connect-src 'self'",
  ].join('; ');

export default wallpaperContentSecurityPolicy;
