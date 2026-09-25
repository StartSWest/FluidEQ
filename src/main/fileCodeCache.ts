/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * `file:` as a scheme whose scripts keep their compiled code between launches.
 *
 * A packaged window is a `file://` page, and Chromium keeps V8's compiled code
 * for http(s) and for schemes registered with `codeCache` — and then only
 * when the PAGE is on one of them: Electron 43's own patch
 * (`feat_allow_code_cache_in_custom_schemes.patch`) admits a code-cache
 * scheme's script only in a renderer whose process lock is a code-cache
 * scheme too. So every launch compiled `renderer.js` and every page chunk
 * from nothing, and serving the scripts from a privileged scheme of our own,
 * with the page left on `file://`, changes nothing. Measured in Electron
 * 43.2.0 by V8's own compile events, four launches each:
 *
 *  - a `file://` page, its script from a `codeCache` custom scheme: never
 *    consumed;
 *  - the page itself on that scheme (the control): consumed from launch 3;
 *  - `file` registered here, page and script both still `file://`: consumed
 *    from launch 3 (Chromium marks a script on its first run, stores its code
 *    on the second and reads it from the third), and `location.origin` still
 *    `file://` — localStorage, IndexedDB and Cache Storage written before the
 *    registration all read back after it. Workers, audio worklets, `fetch` of
 *    a local file, WebAssembly and the production CSP behaved identically,
 *    inline script still refused.
 *
 * The page's origin had to stay: localStorage holds saved DSP chains, the
 * disclaimer and every setting, and Cache Storage the speech model, all keyed
 * by it. The cache is checked against a hash of the script's text
 * (`RegisterURLSchemeAsCodeCacheWithHashing`), so an update never runs code
 * compiled from the build before it. It lives in `Code Cache` under userData,
 * Chromium's default, so nothing else is set.
 *
 * What `standard` costs, which Electron requires beside `codeCache`: URL
 * parsing is untouched (`file` is already standard inside Chromium), but it is
 * also made web-safe, so the browser process stops refusing a renderer's
 * request for a `file:` URL by itself. The app's own guards still refuse it —
 * the video player's navigation allow-list (`videoHardening.ts`), the main
 * window never navigating off its own document (`mainWindow.ts`),
 * `openExternalIfSafe` opening only http(s) —
 * and a web page has no `file:` loader to ask with: Electron hands one only to
 * frames Chromium already lets read files.
 */
export const FILE_CODE_CACHE_SCHEME: Electron.CustomScheme = {
  scheme: 'file',
  privileges: { standard: true, codeCache: true },
};

export default FILE_CODE_CACHE_SCHEME;
