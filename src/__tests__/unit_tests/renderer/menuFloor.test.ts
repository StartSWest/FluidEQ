/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every menu stands on one floor at 98% (Ivan, 2026-09-26: "make sure all
 * menus has no transparency like crazy just 95%"; 2026-11-15: "all menus need
 * to be like 98% opaque").
 *
 * The app's Backdrop used to veil the panes by giving their surfaces an
 * alpha under the surfaces' own names, and a menu opened from a pane
 * inherited those: the actions menu in the titlebar measured 76% at the
 * thinnest veil. The floor is resolved on `:root` from the root's own
 * surfaces and inherited as a colour, so nothing done to a pane reaches it.
 * The app's Backdrop was taken out on 2026-11-16, and since 2026-11-15
 * neither it nor the amp turned the menus into a glass of their own. jsdom
 * lays nothing out, so what is held here is the shape of the rules: the
 * compiled menus paint the floor, the floor is declared on the root at 98%,
 * and the amp declares no floor of its own.
 *
 * The node environment, because Sass resolves its browser build under jsdom's
 * export conditions and that one cannot read files.
 */

import { compile } from 'sass';
import path from 'path';

const STYLES_DIR = path.join(__dirname, '..', '..', '..', 'renderer', 'styles');

const compiledCss = (sheet: string) =>
  compile(path.join(STYLES_DIR, sheet), {
    loadPaths: [STYLES_DIR],
    quietDeps: true,
  }).css;

/** The declarations of the first rule whose selector is exactly `selector`. */
const declarationsOf = (css: string, selector: string) => {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) {
    throw new Error(`no rule for ${selector}`);
  }
  const open = css.indexOf('{', at);
  return css.slice(open + 1, css.indexOf('}', open));
};

describe('the menus’ floor', () => {
  it.each([
    ['List.scss', '.list-wrapper'],
    ['BandMenu.scss', '.band-menu'],
    ['RichPick.scss', '.rich-pick__menu'],
    ['MiniPlayer.scss', '.player-menu'],
  ])('%s paints %s on it', (sheet, selector) => {
    expect(declarationsOf(compiledCss(sheet), selector)).toContain(
      'background: var(--surface-menu-floor)',
    );
  });

  // The card's own colour, as a card on the floor shows it (Ivan,
  // 2026-09-27: "all dropdown menu need to ... have card bg color").
  it('is declared on the root, from the root’s surfaces, at 98%', () => {
    const css = compiledCss('App.scss');
    const at = css.indexOf('--surface-menu-floor:');
    // The rule it is declared in: the selector before the nearest brace.
    const open = css.lastIndexOf('{', at);
    const selector = css.slice(css.lastIndexOf('}', open) + 1, open).trim();
    // As written, over several lines; read as one.
    const floor = css.slice(at, css.indexOf(';', at)).replace(/\s+/g, ' ');
    expect(selector).toBe(':root');
    expect(floor).toContain(
      'color-mix(in srgb, var(--surface-panel) 85%, var(--surface-base)) 98%',
    );
    expect(floor).toMatch(/\) 98%, transparent ?\)/);
  });

  // The amp's menus stand on the same floor: it names the floor and never
  // declares one of its own (2026-11-15: "nor does the amp").
  it('is the same floor under the amp, which declares none of its own', () => {
    const amp = compiledCss('MiniPlayer.scss');
    // Positive control: the amp's sheet does paint its menu with the floor.
    expect(amp).toContain('background: var(--surface-menu-floor)');
    expect(amp).not.toContain('--surface-menu-floor:');
  });
});
