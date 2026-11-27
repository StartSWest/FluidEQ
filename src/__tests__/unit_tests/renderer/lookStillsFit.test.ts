/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  fitStill,
  reconstruct,
  stillError,
  type IStateRender,
  type TRgb,
} from '../../../../scripts/look-stills/fit';

/**
 * The split of a look's still into the window's colours
 * (`scripts/look-stills/fit.ts`), on drawings made here from known weights:
 * the split has to find those weights, keep out a colour nothing is painted
 * in, and rebuild the drawing in colours it was never drawn in.
 */

const WIDTH = 6;
const HEIGHT = 2;

/** Weights per pixel: how much of `stop` and `ink` lands there, and a fixed white. */
const PLAN = [
  { stop: 1, ink: 0, white: 0 },
  { stop: 0.5, ink: 0, white: 0 },
  { stop: 0, ink: 1, white: 0 },
  { stop: 0.3, ink: 0.3, white: 0 },
  { stop: 0, ink: 0, white: 0.6 },
  { stop: 0.4, ink: 0, white: 0.2 },
  { stop: 0, ink: 0, white: 0 },
  { stop: 0.9, ink: 0.1, white: 0 },
  { stop: 0.2, ink: 0, white: 0 },
  { stop: 0, ink: 0.7, white: 0 },
  { stop: 0.6, ink: 0.2, white: 0.1 },
  { stop: 0.05, ink: 0, white: 0 },
];

/** A canvas's drawing of `PLAN` in these colours: premultiplied sums, unpremultiplied out. */
const draw = (stop: TRgb, ink: TRgb, panel: TRgb): IStateRender => {
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  PLAN.forEach((weights, pixel) => {
    const alpha = Math.min(1, weights.stop + weights.ink + weights.white);
    [0, 1, 2].forEach((channel) => {
      const premultiplied =
        (weights.stop * stop[channel]) / 255 +
        (weights.ink * ink[channel]) / 255 +
        weights.white;
      pixels[pixel * 4 + channel] =
        alpha > 0 ? Math.round((premultiplied / alpha) * 255) : 0;
    });
    pixels[pixel * 4 + 3] = Math.round(alpha * 255);
  });
  return { pixels, roles: { stop, ink, panel } };
};

/** Colours that move independently from one drawing to the next. */
const STATES: [TRgb, TRgb, TRgb][] = [
  [
    [0, 229, 207],
    [255, 255, 255],
    [15, 33, 51],
  ],
  [
    [255, 122, 47],
    [230, 230, 240],
    [40, 20, 60],
  ],
  [
    [139, 108, 255],
    [200, 220, 250],
    [10, 60, 30],
  ],
  [
    [80, 200, 90],
    [255, 240, 220],
    [60, 60, 10],
  ],
  [
    [220, 60, 140],
    [210, 255, 230],
    [25, 25, 80],
  ],
  [
    [30, 120, 255],
    [245, 210, 255],
    [70, 30, 30],
  ],
  [
    [240, 220, 40],
    [190, 200, 210],
    [5, 80, 80],
  ],
  [
    [120, 60, 200],
    [255, 230, 200],
    [80, 10, 50],
  ],
];

const RENDERS = STATES.map(([stop, ink, panel]) => draw(stop, ink, panel));

it('finds the colours a drawing is painted in, and leaves out the one it is not', () => {
  const fit = fitStill(RENDERS, ['panel', 'stop', 'ink'], WIDTH, HEIGHT);
  expect([...fit.roles].sort()).toEqual(['ink', 'stop']);
  const stop = fit.masks[fit.roles.indexOf('stop')];
  // A mask keeps 64 levels: within half a step (2 of 255) and the rounding.
  PLAN.forEach((weights, pixel) => {
    expect(Math.abs(stop[pixel] - weights.stop * 255)).toBeLessThanOrEqual(3);
  });
  expect(fit.coverageDrift).toBe(0);
});

it('rebuilds the drawing in colours it was never drawn in', () => {
  const fit = fitStill(RENDERS, ['panel', 'stop', 'ink'], WIDTH, HEIGHT);
  const unseen = draw([255, 0, 128], [255, 255, 200], [0, 0, 0]);
  const error = stillError(fit, unseen, [10, 24, 38]);
  expect(error.max).toBeLessThanOrEqual(3);
  // The control: the same still read in the colours of another drawing is
  // visibly not this one, so the measure can tell a wrong rebuild.
  const wrong = stillError(
    fit,
    { ...unseen, roles: RENDERS[0].roles },
    [10, 24, 38],
  );
  expect(wrong.max).toBeGreaterThan(50);
});

it('composites what is drawn in fixed inks under the colours, never over them', () => {
  const fit = fitStill(RENDERS, ['stop', 'ink'], WIDTH, HEIGHT);
  const rebuilt = reconstruct(fit, RENDERS[1].roles);
  // The fixed white alone: no colour of the window in it.
  expect(rebuilt[4 * 4]).toBeCloseTo(0.6, 1);
  expect(rebuilt[4 * 4 + 3]).toBeCloseTo(0.6, 1);
  // Nothing drawn: nothing rebuilt.
  expect(rebuilt[6 * 4 + 3]).toBe(0);
});

/**
 * A glow's core: its colour added two and a half times over and clipped at
 * white, as `lighter` clips on a dark window; and beside it a plain fill.
 */
const glow = (stop: TRgb): IStateRender => {
  const pixels = new Uint8ClampedArray(2 * 4);
  [2.5, 0.5].forEach((weight, pixel) => {
    stop.forEach((channel, index) => {
      pixels[pixel * 4 + index] = Math.min(255, Math.round(weight * channel));
    });
    pixels[pixel * 4 + 3] = 255;
  });
  return { pixels, roles: { stop } };
};

it('keeps light added past white as its colour laid on again, clipped as the canvas clips it', () => {
  const renders = STATES.map(([stop]) => glow(stop));
  const fit = fitStill(renders, ['stop'], 2, 1);
  // Two and a half times over: three layers of the stop.
  expect(fit.roles).toEqual(['stop', 'stop', 'stop']);
  const unseen = glow([60, 140, 230]);
  expect(stillError(fit, unseen, [0, 0, 0]).max).toBeLessThanOrEqual(3);
  // The control: one layer, as a fit that read the clipped drawings as they
  // stand would keep, leaves the core visibly short of the drawing.
  const once = { ...fit, roles: ['stop'], masks: [fit.masks[0]] };
  expect(stillError(once, unseen, [0, 0, 0]).max).toBeGreaterThan(50);
});
