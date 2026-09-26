/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every menu stands on one floor at 95% (Ivan, 2026-09-26: "make sure all
 * menus has no transparency like crazy just 95%").
 *
 * The Backdrop veils the panes by giving their surfaces an alpha, under the
 * surfaces' own names (`SceneCover.scss`), and a menu opened from a pane
 * inherited those: the actions menu in the titlebar measured 76% at the
 * thinnest veil. The floor is resolved on `:root` from the root's own
 * surfaces and inherited as a colour, so nothing the Backdrop does to a pane
 * reaches it. jsdom lays nothing out, so what is held here is the shape of
 * the rules: the compiled menus paint the floor, the floor is declared on the
 * root at 95%, and the Backdrop never names it.
 *
 * The node environment, because Sass resolves its browser build under jsdom's
 * export conditions and that one cannot read files.
 */

import { compile } from 'sass';
import fs from 'fs';
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
    ['GraphTheme.scss', '.scene-look-menu'],
    ['BandMenu.scss', '.band-menu'],
    ['RichPick.scss', '.rich-pick__menu'],
  ])('%s paints %s on it', (sheet, selector) => {
    expect(declarationsOf(compiledCss(sheet), selector)).toContain(
      'background: var(--surface-menu-floor)',
    );
  });

  it('is declared on the root, from the root’s surfaces, at 95%', () => {
    const css = compiledCss('App.scss');
    const at = css.indexOf('--surface-menu-floor:');
    // The rule it is declared in: the selector before the nearest brace.
    const open = css.lastIndexOf('{', at);
    const selector = css.slice(css.lastIndexOf('}', open) + 1, open).trim();
    // As written, over several lines; read as one.
    const floor = css.slice(at, css.indexOf(';', at)).replace(/\s+/g, ' ');
    expect(selector).toBe(':root');
    expect(floor).toContain('var(--surface-base) 70%, var(--surface-panel)');
    expect(floor).toMatch(/\) 95%, transparent ?\)/);
  });

  it('is never named by the Backdrop, which veils the panes', () => {
    const cover = fs.readFileSync(
      path.join(STYLES_DIR, 'SceneCover.scss'),
      'utf8',
    );
    // Positive control: the Backdrop does veil the panes' surfaces by name.
    expect(cover).toContain('--surface-panel: var(--veiled-surface-panel)');
    expect(cover).not.toContain('--surface-menu-floor');
  });
});
