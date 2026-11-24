/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Spectrogram and the Waterfall with one colour to paint in (Ivan,
 * 2026-11-24: "if I don't select a secondary color there is a flat thing").
 * With the primary's walk on a light window all three stops were deep teals
 * a few points apart; the ramp built from the one colour and the window's
 * ground has to put a real distance between quiet and loud on both sides of
 * the Brightness, starting from the ground, beside the walk it replaced.
 */

import { rampAt } from '../../../../renderer/graph/lookColours';
import { levelRampOf } from '../../../../renderer/utils/levelRamp';
import { parseCssColour, rgbToLab } from '../../../../renderer/utils/oklab';
import {
  getRainbowStops,
  setRainbowStops,
} from '../../../../renderer/utils/rainbowPalette';
import { windowLevelRamps } from '../../../../renderer/utils/windowInk';
import { setWindowTintSecondary } from '../../../../renderer/utils/windowTint';

/**
 * The light window's ground, its accent walk and the colour Colourful mode
 * draws in with no second colour, read from the white window (2026-11-24).
 */
const WHITE_GROUND = '#ececec';
const WHITE_WALK = ['#005e63', '#00777d', '#00777d'];
const WHITE_ACCENT = '#00a5ae';
/** Ivan's dark window: its ground and accent walk (CDP, 2026-11-24). */
const DARK_GROUND = '#021824';
const DARK_WALK = ['#00b9c2', '#32e1eb', '#a9faff'];
const DARK_ACCENT = '#32e1eb';

const labOf = (colour: string) => {
  const parsed = parseCssColour(colour);
  if (!parsed) {
    throw new Error(`not a colour: ${colour}`);
  }
  return rgbToLab(parsed.rgb);
};

const hex = (rgb: readonly number[]) =>
  `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;

/** OKLab distance between a quiet reading's colour and a loud one's. */
const spread = (ramp: readonly string[]) => {
  const quiet = labOf(hex(rampAt(ramp, 0.15)));
  const loud = labOf(hex(rampAt(ramp, 0.9)));
  return Math.hypot(quiet.l - loud.l, quiet.a - loud.a, quiet.b - loud.b);
};

const luminance = (colour: string) => {
  const parsed = parseCssColour(colour);
  if (!parsed) {
    throw new Error(`not a colour: ${colour}`);
  }
  const lin = (channel: number) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  const [red, green, blue] = parsed.rgb.map(lin);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrast = (a: string, b: string) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

describe('one colour as a loudness ramp', () => {
  it.each([
    ['light', WHITE_GROUND, WHITE_ACCENT, WHITE_WALK],
    ['dark', DARK_GROUND, DARK_ACCENT, DARK_WALK],
  ])(
    'puts quiet and loud far apart on a %s window, where the walk did not',
    (_side, ground, accent, walk) => {
      const ramp = levelRampOf(accent, ground);
      expect(spread(ramp)).toBeGreaterThan(0.3);
      expect(spread(ramp)).toBeGreaterThan(spread(walk) * 1.5);
    },
  );

  it('flattened to the walk on a light window: the bug as Ivan saw it', () => {
    // The control: the three tones he was handed lie within 0.15 of each
    // other, a flat teal; the ramp has to beat that, not merely exist.
    expect(spread(WHITE_WALK)).toBeLessThan(0.15);
  });

  it.each([
    ['light', WHITE_GROUND, WHITE_ACCENT],
    ['dark', DARK_GROUND, DARK_ACCENT],
  ])(
    'starts at the ground and climbs away from it on a %s window',
    (_side, ground, accent) => {
      const ramp = levelRampOf(accent, ground);
      const floor = labOf(ground).l;
      const away = ramp.map((stop) => Math.abs(labOf(stop).l - floor));
      expect(away[0]).toBeLessThan(0.1);
      away
        .slice(1)
        .forEach((distance, index) =>
          expect(distance).toBeGreaterThan(away[index]),
        );
      // The loudest end reads off the ground as a solid mark does.
      expect(contrast(ramp[ramp.length - 1], ground)).toBeGreaterThan(4.5);
    },
  );

  it('keeps the colour itself as one of its stops', () => {
    expect(levelRampOf(WHITE_ACCENT, WHITE_GROUND)).toContain(WHITE_ACCENT);
    expect(levelRampOf(DARK_ACCENT, DARK_GROUND)).toContain(DARK_ACCENT);
  });

  it('keeps its hue: the deep end on white is the colour, not grey', () => {
    const [, , , deep] = levelRampOf(WHITE_ACCENT, WHITE_GROUND);
    const { a, b } = labOf(deep);
    expect(Math.hypot(a, b)).toBeGreaterThan(0.05);
  });
});

describe('which views climb the ramp', () => {
  const root = document.documentElement;

  beforeEach(() => {
    root.style.setProperty('--surface-base', WHITE_GROUND);
    root.style.setProperty('--accent', WHITE_ACCENT);
    root.style.setProperty('--active', '#4a7bd6');
  });

  afterEach(() => {
    setRainbowStops(undefined);
    setWindowTintSecondary(undefined);
    root.classList.remove('is-euphoric');
    ['--surface-base', '--accent', '--active'].forEach((token) =>
      root.style.removeProperty(token),
    );
  });

  it("the window's one colour, and the secondary's for the second reading", () => {
    const ramps = windowLevelRamps([]);
    expect(ramps?.colours).toEqual(levelRampOf(WHITE_ACCENT, WHITE_GROUND));
    expect(ramps?.mate).toEqual(levelRampOf('#4a7bd6', WHITE_GROUND));
  });

  it("a look's own single colour", () => {
    expect(windowLevelRamps(['#c0392b'])?.colours).toEqual(
      levelRampOf('#c0392b', WHITE_GROUND),
    );
  });

  it("Colourful mode's stops when they are seven copies of one colour", () => {
    // What the white window draws in with no second colour on the Tint:
    // the case Ivan saw, which Rainbow alone had let through as "colours".
    setRainbowStops(Array.from({ length: 7 }, () => '#00a5ae'));
    root.classList.add('is-euphoric');
    expect(windowLevelRamps([])?.colours).toEqual(
      levelRampOf(getRainbowStops()[0], WHITE_GROUND),
    );
  });

  it('nothing when there are colours enough to ramp between already', () => {
    expect(windowLevelRamps(['#c0392b', '#2980b9'])).toBeUndefined();
    setWindowTintSecondary('#8e44ad');
    expect(windowLevelRamps([])).toBeUndefined();
    setWindowTintSecondary(undefined);
    // A Plus scene's own rainbow.
    setRainbowStops([
      '#ff4fa3',
      '#ff8a3d',
      '#ffd23d',
      '#5be37a',
      '#3dc8ff',
      '#5b6bff',
      '#b35bff',
    ]);
    root.classList.add('is-euphoric');
    expect(windowLevelRamps([])).toBeUndefined();
  });
});
