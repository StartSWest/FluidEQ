/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The scene's canvas stands on the app's floor, read from the compiled
 * stylesheet: a frame the worker has not committed yet showed as a solid
 * white box over the whole card in Ivan's window (2026-11-13), and jsdom
 * cannot show a compositor gap, so the rule itself is what is held.
 */

import { compileStylesheet, styleRules } from '../../utils/stylesheetRules';

const graphTheme = compileStylesheet('GraphTheme.scss');

const backgroundOf = (selector: string) =>
  styleRules(graphTheme)
    .filter(({ selectors }) => selectors.includes(selector))
    .map(({ declarations }) => declarations.get('background-color'))
    .find((value) => value !== undefined);

describe('the canvas a scene is drawn in', () => {
  it('has the floor behind it, so a missing frame is the app’s colour', () => {
    expect(backgroundOf('.chart-scene-canvas > canvas')).toBe(
      'var(--surface-base)',
    );
  });

  it('leaves the analyser’s own canvas see-through, which draws over the card (the control)', () => {
    expect(backgroundOf('.chart-live-canvas')).toBeUndefined();
  });
});
