/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Words in a state colour are written in the state inks, never in the dark
 * window's lights (2026-11-24, the white theme). `$amber`, `$red` and
 * `$analogous-2` are lights: on a white window they stood at 1.8:1, 2.9:1
 * and 1.3:1, and every error, warning and "added" in the app's panes, menus,
 * dialogs and notices could hardly be read there. `$ink-caution`,
 * `$ink-removed` and `$ink-added` (`_color.scss`) fall back to exactly those
 * lights on a dark window and are deep inks of the same meaning on a white
 * one, so the swap moves nothing on a dark window.
 *
 * Held on the source, where a new rule would bring a light back: no
 * stylesheet gives `color` one of the three lights outright, except those
 * whose words stand on a dark picture of their own whatever the window -
 * What's New's slides, the desktop's controls over the wallpaper, the
 * rhythm game and the support celebration.
 */

import fs from 'fs';
import path from 'path';
import { compileStylesheet, styleRules } from '../../utils/stylesheetRules';

const STYLES = path.join(__dirname, '..', '..', '..', 'renderer', 'styles');
const OWN_DARK_STAGE = /^(_tour-|Wallpaper|RhythmGame|Support\.scss)/;
const LIGHT_AS_WORDS = /^\s*color: (\$amber|\$red|\$analogous-2);/gm;
const INK_AS_WORDS = /^\s*color: (\$ink-caution|\$ink-removed|\$ink-added);/gm;

const sheets = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const at = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return sheets(at);
    }
    return entry.name.endsWith('.scss') ? [at] : [];
  });

describe('words in a state colour', () => {
  const all = sheets(STYLES);

  it('are written in the state inks, never the dark window’s lights', () => {
    const found = all
      .filter((file) => !OWN_DARK_STAGE.test(path.basename(file)))
      .flatMap((file) =>
        [...fs.readFileSync(file, 'utf8').matchAll(LIGHT_AS_WORDS)].map(
          (match) => `${path.relative(STYLES, file)}: ${match[0].trim()}`,
        ),
      );
    expect(found).toEqual([]);
  });

  // Positive control: the scan reads the sheets - the inks are there, in
  // many of them.
  it('finds the inks themselves', () => {
    const inks = all.flatMap((file) => [
      ...fs.readFileSync(file, 'utf8').matchAll(INK_AS_WORDS),
    ]);
    expect(inks.length).toBeGreaterThan(100);
  });
});

// The same lights worn with an alpha, which the source scan above does not
// read: each has a light window's rule of its own.
describe('words in a state light worn with an alpha, on a white window', () => {
  const LIGHT = ':root[data-window-ink=dark]';
  const colourOf = (sheet: string, selector: string) =>
    styleRules(compileStylesheet(sheet))
      .filter((rule) => rule.selectors.includes(selector))
      .map((rule) => rule.declarations.get('color'))
      .filter(Boolean);

  it.each([
    ['Dsp.scss', '.dsp-de-esser-status .is-cut', 'var(--ink-caution'],
    ['ErrorBoundary.scss', '.crash-screen__detail', 'var(--ink-removed'],
  ])('%s %s takes a readable ink', (sheet, selector, ink) => {
    // Positive control: the dark window's rule is the light with an alpha.
    expect(colourOf(sheet, selector).join(' ')).toMatch(/rgba\(/);
    expect(colourOf(sheet, `${LIGHT} ${selector}`).join(' ')).toContain(ink);
  });
});
