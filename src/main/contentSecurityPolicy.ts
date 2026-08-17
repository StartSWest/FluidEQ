/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * Where the on-demand models are fetched from, by their workers.
 *
 * Two models now: the speech model for lyric timing and the vocal separation
 * model that feeds it a clean voice. Both are hosted on huggingface, and both
 * are served the same way — a request to `huggingface.co` answers with a
 * redirect to a large-file host, so allowing only the first one produces a
 * download that begins and then fails. The CDN hostnames have moved over time
 * (`cdn-lfs.huggingface.co`, then the `hf.co` variants, then the Xet bridge),
 * so all of them are listed rather than the one that happens to answer today.
 */
const MODEL_HOSTS = [
  'https://huggingface.co',
  'https://*.huggingface.co',
  // Wildcards rather than a list, and that is a correction rather than
  // laziness. The list was tried first and shipped broken: it named
  // `cdn-lfs-us-1.hf.co` and the Xet bridge, and the download was refused
  // because the redirect actually landed on `us.aws.cdn.hf.co`. Hugging Face
  // routes large files through per-region, per-provider hosts it invents as it
  // needs them, so any enumeration is a guess that fails on somebody else's
  // machine — the one place it is most expensive to discover.
  'https://*.hf.co',
  'https://*.xethub.hf.co',
].join(' ');

/**
 * The Content-Security-Policy for FluidEQ's own window.
 *
 * A function of one boolean so it can be tested, which matters more here than
 * it looks. A CSP that is too strict does not fail loudly — it produces a blank
 * window, or a feature that silently stops working, and neither the type
 * checker nor a health check can see it. Written inline it could only be
 * checked by opening the app and trying every feature it touches.
 *
 * Deliberately not the strictest policy that can be written, because a policy
 * that breaks the app gets deleted by the next person who needs the app to
 * work. This is the strictest one that leaves every existing feature running,
 * and each loosening below names the feature that needs it.
 *
 * What it buys:
 *
 *  - `object-src 'none'` — no plugins, ever. Nothing here uses them and it
 *    closes the oldest hole in the list.
 *  - `base-uri 'self'` — an injected `<base>` cannot re-point every relative
 *    URL in the document somewhere else.
 *  - `form-action 'none'` — nothing in this app submits a form, so nothing
 *    injected into it should be able to either.
 *  - `frame-src 'none'` — the video browser is a `<webview>` on its own
 *    locked-down session, not a frame in this one.
 *  - script-src without `'unsafe-inline'` — an injected `<script>` tag does not
 *    run.
 *
 * What it allows, and why:
 *
 *  - `'unsafe-eval'` in development only. Webpack's hot reload compiles modules
 *    with eval; a packaged build has no dev server and no reason to permit it.
 *  - `style-src 'unsafe-inline'` — React style props are inline styles, and a
 *    dozen components use them.
 *  - `blob:` for workers, media and images. The Whisper worker, the analysis
 *    worker, every audio file the user opens and the look designer's previews
 *    are all object URLs.
 *  - the model hosts in connect-src, because that is where the speech and
 *    vocal separation models come from, including the redirect targets their
 *    large files are actually served by.
 */
export const contentSecurityPolicy = (isDebug: boolean): string =>
  [
    "default-src 'self'",
    isDebug ? "script-src 'self' 'unsafe-eval'" : "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob: data: file:",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    isDebug
      ? `connect-src 'self' ws: http://localhost:1212 ${MODEL_HOSTS}`
      : `connect-src 'self' ${MODEL_HOSTS}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-src 'none'",
  ].join('; ');
