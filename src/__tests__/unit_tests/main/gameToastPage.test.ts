/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * The card a game's sound is announced on has one inline script and a content
 * policy that admits exactly it, by the hash of its own text.
 *
 * The first version shipped with `default-src 'none'` and no `script-src` at
 * all, so the browser refused that script: the card drew its icon, its rule
 * and its brand mark, and said nothing — every word on it comes from the
 * address bar and is written in by that script. It also never closed itself,
 * because the listener that closes it is in there too. Both failures are
 * invisible in the markup, which is why they are a test's job.
 */
const PAGE = path.join(__dirname, '../../../../assets/game-toast.html');

const page = fs.readFileSync(PAGE, 'utf8');

const scriptText = (html: string): string => {
  const found = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!found) {
    throw new Error('the card has no inline script');
  }
  return found[1];
};

const hashOf = (text: string): string =>
  `sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}`;

const policy = (html: string): string => {
  const found = html.match(
    /http-equiv="Content-Security-Policy"\s*\n?\s*content="([^"]*)"/,
  );
  if (!found) {
    throw new Error('the card has no content policy');
  }
  return found[1];
};

describe('the game card the desktop shows', () => {
  it('admits its own script, so the card can say anything at all', () => {
    expect(policy(page)).toContain(`'${hashOf(scriptText(page))}'`);
  });

  // The positive control: without it, a page whose script was emptied would
  // pass the check above by hashing to whatever it declared.
  it('would notice a script the policy does not admit', () => {
    const edited = page.replace(
      '</script>',
      '  window.somethingElse = true;\n    </script>',
    );
    expect(edited).not.toEqual(page);
    expect(policy(edited)).not.toContain(`'${hashOf(scriptText(edited))}'`);
  });

  it('lets in nothing else: no network, no files, pictures in the address', () => {
    const said = policy(page);
    expect(said).toContain("default-src 'none'");
    expect(said).toContain('img-src data:');
    expect(said).not.toContain("script-src 'unsafe-inline'");
    expect(said).not.toContain('http:');
    expect(said).not.toContain('https:');
  });

  /**
   * The card's colours are the window's, written into its stylesheet from
   * its address — so the one script on the page is also the thing standing
   * between a URL and the page's CSS. Run for real here, in a document with
   * the card's own markup, rather than read as text.
   */
  it('takes the window’s colours from its address, and only colours', () => {
    const body = page.match(/<body>([\s\S]*)<\/body>/);
    if (!body) {
      throw new Error('the card has no body');
    }
    document.body.innerHTML = body[1].replace(/<script>[\s\S]*<\/script>/, '');
    const address = new URLSearchParams({
      what: 'Loaded Gaming',
      game: 'for Overwatch',
      accent: '#fab1fb',
      panel: 'rgb(27, 2, 28)',
      base: 'red; background: url(https://example.com/)',
      text: 'var(--anything)',
    });
    window.history.replaceState(null, '', `/?${address.toString()}`);
    const root = document.documentElement.style;
    ['accent', 'panel', 'base', 'text', 'muted'].forEach((name) =>
      root.removeProperty(`--${name}`),
    );
    // eslint-disable-next-line no-new-func -- the page's own script, run as the page runs it
    new Function(scriptText(page))();

    expect(root.getPropertyValue('--accent')).toBe('#fab1fb');
    expect(root.getPropertyValue('--panel')).toBe('rgb(27, 2, 28)');
    expect(root.getPropertyValue('--base')).toBe('');
    expect(root.getPropertyValue('--text')).toBe('');
    expect(root.getPropertyValue('--muted')).toBe('');
    // And the words still arrive beside them.
    expect(document.getElementById('what')?.textContent).toBe('Loaded Gaming');
  });

  it('closes itself on an animation rather than on a clock', () => {
    const script = scriptText(page);
    expect(script).toContain('animationend');
    expect(script).toContain('window.close()');
    expect(script).not.toContain('setTimeout');
    expect(script).not.toContain('setInterval');
  });
});
