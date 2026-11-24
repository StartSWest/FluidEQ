/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The words on a filled accent on the white window are the panes' white, not
 * the floor's grey (Ivan, 2026-11-24: "also the gray text / icon on green
 * button"). The floor there is #ececec, and on the deep teal every loud
 * button's glyph read as grey - the amp's play key worst. On a dark window
 * the floor is the dark label and stays it.
 */

import { filledFace, labOf } from 'renderer/utils/windowFill';
import {
  contrast,
  parseCssColour,
  toLinear,
  luminance,
} from 'renderer/utils/oklab';
import { compileStylesheet, styleRules } from '../../utils/stylesheetRules';

const TEAL = '#00777d';
const WHITE_GROUND = {
  floor: '#ececec',
  pane: '#ffffff',
  ink: '#1b1b1b',
  isLight: true,
};

const lum = (hex: string) =>
  luminance((parseCssColour(hex)?.rgb ?? [0, 0, 0]).map(toLinear));

describe('the label on a filled accent', () => {
  it('is the panes’ white on the white window', () => {
    const teal = labOf(TEAL);
    if (!teal) {
      throw new Error('no teal');
    }
    const face = filledFace(teal, WHITE_GROUND);
    expect(face.label).toBe('#ffffff');
    // And it reads at least as well as the floor it was solved against.
    expect(contrast(lum(face.label), lum(face.fill))).toBeGreaterThanOrEqual(
      contrast(lum('#ececec'), lum(face.fill)),
    );
  });

  it('keeps the window’s dark ink on a light colour somebody picked', () => {
    const pink = labOf('#ffaaa4');
    if (!pink) {
      throw new Error('no pink');
    }
    expect(filledFace(pink, WHITE_GROUND).label).toBe('#1b1b1b');
  });

  // Where the window's painter writes no label of its own, the stylesheet's
  // stands: the floor on the root, the panes' white on a light window.
  it('is the panes’ white in the stylesheet’s own light default', () => {
    const rules = styleRules(compileStylesheet('App.scss'));
    const onAccent = (selector: string) =>
      rules
        .filter((rule) => rule.selectors.includes(selector))
        .map((rule) => rule.declarations.get('--on-accent'))
        .filter(Boolean);
    expect(onAccent(':root')).toEqual(['var(--surface-base)']);
    expect(onAccent('html[data-window-ink=dark]')).toEqual([
      'var(--surface-panel)',
    ]);
  });

  it('stays the floor on a dark window', () => {
    const cyan = labOf('#32e1eb');
    if (!cyan) {
      throw new Error('no cyan');
    }
    const face = filledFace(cyan, {
      floor: '#0b1a22',
      pane: '#13232c',
      ink: '#ffffff',
      isLight: false,
    });
    expect(face.label).toBe('#0b1a22');
  });
});
