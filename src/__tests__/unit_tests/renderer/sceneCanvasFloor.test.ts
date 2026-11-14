/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A scene's canvas on the layers that stand on the window's floor has that
 * floor behind it, read from the compiled stylesheet: a frame the worker had
 * not committed showed as a solid white box over the whole card in Ivan's
 * window (2026-11-13), and jsdom cannot show a compositor gap, so the rule
 * itself is what is held. On the plot, where the card's translucent face
 * lies under the canvas, it stays clear.
 */

import { compileStylesheet, styleRules } from '../../utils/stylesheetRules';

const graphTheme = compileStylesheet('GraphTheme.scss');

/** The background-color given to exactly this selector, if any. */
const backgroundOf = (selector: string) =>
  styleRules(graphTheme)
    .filter(({ selectors }) => selectors.includes(selector))
    .map(({ declarations }) => declarations.get('background-color'))
    .find((value) => value !== undefined);

/** Every selector that gives a scene canvas's own element a background. */
const sceneCanvasBackgrounds = () =>
  styleRules(graphTheme)
    .filter(({ declarations }) => declarations.has('background-color'))
    .flatMap(({ selectors }) => selectors)
    .filter((selector) =>
      /\.chart-scene-canvas(\s*>\s*canvas)?$/.test(selector),
    );

describe('the canvas a scene is drawn in', () => {
  it('has the floor behind it on the layers that stand on the floor', () => {
    expect(
      backgroundOf('[data-scene-layer] .chart-scene-canvas > canvas'),
    ).toBe('var(--surface-base)');
  });

  it('is given that colour nowhere else, so on the plot it stays clear', () => {
    expect(sceneCanvasBackgrounds()).toEqual([
      '[data-scene-layer] .chart-scene-canvas > canvas',
    ]);
  });

  it('leaves the analyser’s own canvas see-through, which draws over the card (the control)', () => {
    expect(backgroundOf('.chart-live-canvas')).toBeUndefined();
  });
});
