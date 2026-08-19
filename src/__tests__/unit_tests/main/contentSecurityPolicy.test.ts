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

import { contentSecurityPolicy } from 'main/contentSecurityPolicy';

/** The policy as a map of directive to its source list. */
const directives = (isDebug: boolean): Record<string, string[]> =>
  Object.fromEntries(
    contentSecurityPolicy(isDebug)
      .split('; ')
      .map((entry) => {
        const [name, ...sources] = entry.split(' ');
        return [name, sources];
      }),
  );

/**
 * What the policy must permit, and what it must refuse.
 *
 * A CSP is the one piece of hardening that does not fail loudly. Too strict and
 * the window comes up blank, or a feature stops working with nothing in the log
 * anyone reads; too loose and it protects nothing while looking as though it
 * does. Neither shows up in a type check, and the only other way to find out is
 * to open the app and try every feature the policy touches.
 *
 * So each expectation below names the thing that breaks. A failure here should
 * read as "the Whisper model can no longer be fetched", not as "a string
 * changed".
 */
describe('the app window content security policy', () => {
  it('refuses the things nothing here needs', () => {
    (['object-src', 'form-action', 'frame-src'] as const).forEach((name) => {
      // Plugins, form posts and frames: no feature uses any of them, so an
      // injected one is never legitimate.
      expect(directives(false)[name]).toEqual(["'none'"]);
      expect(directives(true)[name]).toEqual(["'none'"]);
    });
  });

  it('pins the document base so relative URLs cannot be re-pointed', () => {
    expect(directives(false)['base-uri']).toEqual(["'self'"]);
  });

  it('never allows inline script, in either build', () => {
    // The whole point of script-src. An injected <script> tag must not run.
    expect(directives(false)['script-src']).not.toContain("'unsafe-inline'");
    expect(directives(true)['script-src']).not.toContain("'unsafe-inline'");
  });

  it('allows eval only while developing', () => {
    // Webpack's hot reload compiles modules with eval. A packaged build has no
    // dev server, so it has no reason to permit it — and this is the assertion
    // that stops the development policy being shipped by accident.
    expect(directives(true)['script-src']).toContain("'unsafe-eval'");
    expect(directives(false)['script-src']).not.toContain("'unsafe-eval'");
  });

  it('lets the speech and separation models be fetched', () => {
    // Both models download from huggingface, from inside their workers.
    // Without this the Karaoke features fail with a network error that looks
    // like a broken connection and is a policy refusal.
    ['https://huggingface.co'].forEach((host) => {
      expect(directives(false)['connect-src']).toContain(host);
      expect(directives(true)['connect-src']).toContain(host);
    });
  });

  it('allows the large-file hosts the model downloads redirect to', () => {
    // The failure this prevents is the nastiest of the set: a request to
    // huggingface.co is permitted, answered with a redirect to a CDN host, and
    // the redirect is refused. The download starts, shows progress, and dies —
    // which reads as a flaky mirror rather than as policy. The separation
    // model is ~700MB, so it is always served this way.
    const sources = directives(false)['connect-src'];
    // Named hosts were tried and shipped broken: the policy listed
    // `cdn-lfs-us-1.hf.co` while the redirect actually landed on
    // `us.aws.cdn.hf.co`, so the download began and was then refused. The
    // hosts are per-region and per-provider and Hugging Face adds them as it
    // likes, so the assertion is that the wildcard is there — an enumeration
    // passing this test would mean nothing.
    expect(sources).toContain('https://*.hf.co');
    expect(sources).toContain('https://*.huggingface.co');
    // A representative sample of the hosts seen in the wild, all of which the
    // wildcards must admit.
    const matches = (host: string) =>
      sources.some((source) => {
        const pattern = source.replace('https://', '');
        return pattern.startsWith('*.')
          ? host.endsWith(pattern.slice(1))
          : host === pattern;
      });
    [
      'us.aws.cdn.hf.co',
      'cdn-lfs-us-1.hf.co',
      'cas-bridge.xethub.hf.co',
      'huggingface.co',
    ].forEach((host) => expect(matches(host)).toBe(true));
  });

  it('lets the dev server talk to its own hot reload', () => {
    expect(directives(true)['connect-src']).toContain('ws:');
    expect(directives(true)['connect-src']).toContain('http://localhost:1212');
    // And not in a packaged build, which has neither.
    expect(directives(false)['connect-src']).not.toContain('ws:');
  });

  it('allows the object URLs every worker and media file arrives as', () => {
    // The Whisper worker, the analysis worker, every audio file the user opens
    // and the look designer's previews are all blob: URLs.
    expect(directives(false)['worker-src']).toContain('blob:');
    expect(directives(false)['media-src']).toContain('blob:');
    expect(directives(false)['img-src']).toContain('blob:');
  });

  it('allows the inline styles React writes', () => {
    // A style prop is an inline style, and a dozen components use them.
    expect(directives(false)['style-src']).toContain("'unsafe-inline'");
  });

  it('lets the library serve its own media and covers', () => {
    // Without this on img-src every cover in the library is silently blank
    // while the rest of the app looks perfectly fine — the exact failure a
    // policy change is most likely to cause and least likely to be blamed for.
    expect(directives(false)['img-src']).toContain('fluideq-media:');
    expect(directives(false)['media-src']).toContain('fluideq-media:');
    expect(directives(true)['img-src']).toContain('fluideq-media:');
  });

  it('states every directive it relies on rather than leaning on the default', () => {
    // default-src is a fallback, and a directive that is merely absent is easy
    // to believe is set. Each of these is written out.
    const named = Object.keys(directives(false));
    [
      'default-src',
      'script-src',
      'style-src',
      'img-src',
      'media-src',
      'font-src',
      'worker-src',
      'connect-src',
      'object-src',
      'base-uri',
      'form-action',
      'frame-src',
    ].forEach((name) => expect(named).toContain(name));
  });
});
