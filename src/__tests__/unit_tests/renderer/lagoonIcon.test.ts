/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One set of colours for the icon and the app (Ivan, 2026-09-26: "wave
 * lagoon", "the icon remain the same", "i wanna see app colors match more the
 * icon"). Lagoon is written in four places — the palette the scripts draw
 * with, the stylesheet's root tokens, the logo tile's edge and the icon file
 * — and nothing makes them agree but this.
 *
 * The node environment, because Sass resolves its browser build under jsdom's
 * export conditions and that one cannot read files.
 */

import fs from 'fs';
import path from 'path';
import { compile } from 'sass';
import { LAGOON } from '../../../renderer/utils/rainbowPalette';

const ROOT = path.join(__dirname, '..', '..', '..', '..');
const STYLES_DIR = path.join(ROOT, 'src', 'renderer', 'styles');

const css = (file: string) =>
  compile(path.join(STYLES_DIR, file), {
    loadPaths: [STYLES_DIR],
    quietDeps: true,
  }).css;

/** The body of the first top-level rule whose selector is exactly `selector`. */
const ruleBody = (sheet: string, selector: string): string => {
  const at = `\n${sheet}`.indexOf(`\n${selector} {`);
  if (at < 0) {
    throw new Error(`no ${selector} rule`);
  }
  return sheet.slice(at, sheet.indexOf('}', at));
};

describe('Lagoon, everywhere it is written', () => {
  it('is what the stylesheet puts on the root, stop for stop', () => {
    const root = ruleBody(css('Rainbow.scss'), ':root');
    LAGOON.forEach((stop, index) => {
      expect(root).toContain(`--rainbow-${index + 1}: ${stop};`);
    });
  });

  it('edges every logo tile, the header’s and the dialogs’, in order', () => {
    const mark = ruleBody(css('App.scss'), '.brand-mark');
    expect(mark).toContain(`linear-gradient(135deg, ${LAGOON.join(', ')})`);
  });

  it('is the icon file’s edge', () => {
    const svg = fs.readFileSync(path.join(ROOT, 'assets', 'icon.svg'), 'utf8');
    const edge = svg.slice(svg.indexOf('id="edge"'));
    const stops = [...edge.matchAll(/stop-color="(#[0-9a-f]{6})"/g)]
      .slice(0, LAGOON.length)
      .map((match) => match[1]);
    expect(stops).toEqual([...LAGOON]);
  });
});

describe('the filled controls', () => {
  it('are painted with the accent’s span, not the accent alone', () => {
    const app = ruleBody(css('App.scss'), ':root');
    expect(app).toMatch(/--accent-fill: linear-gradient\(/);
    expect(ruleBody(css('Button.scss'), '.button')).toContain(
      'var(--accent-fill)',
    );
  });

  // The control: the quiet button stays an outline, so the fill is the loud
  // one's alone.
  it('leave the quiet button its outline', () => {
    expect(ruleBody(css('Button.scss'), '.button.subtle')).not.toContain(
      '--accent-fill',
    );
  });
});
