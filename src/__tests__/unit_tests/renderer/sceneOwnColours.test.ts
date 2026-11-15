/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The colours a scene lends the window, from what the scene says (Ivan,
 * 2026-11-14: "we want the agent to give those colours, but in case they
 * don't exist we need a deterministic algorithm"): the ones it names, else
 * the ones its palette gives by a fixed rule, else nothing - and only then
 * is the scene drawn to measure it (`graph/sceneSky.ts`).
 */

import { hueDistance, parseCssColour, rgbToLab } from 'renderer/utils/oklab';
import type { ISceneColourControls } from 'renderer/utils/sceneAppColours';
import {
  sceneOwnSky,
  sceneWindowColours,
  skyFromWindowColours,
  windowColoursFromStops,
} from 'renderer/utils/sceneOwnColours';

const hueOf = (hex: string) => {
  const parsed = parseCssColour(hex);
  if (!parsed) {
    throw new Error(`not a colour: ${hex}`);
  }
  const { a, b } = rgbToLab(parsed.rgb);
  return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
};

const NAMED = { surface: '#1d2b4f', accent: '#5fd4ff', glow: '#7dffb0' };

const mode = {
  id: 'mode',
  names: { en: 'Mode' },
  min: 0,
  max: 1,
  value: 1,
  options: [{ names: { en: 'One colour' } }, { names: { en: 'Gradient' } }],
};
/** A violet night with cyan lights, or, chosen instead, one green. */
const NIGHT: ISceneColourControls = {
  params: [mode],
  palettes: [
    {
      id: 'colours',
      names: { en: 'Colours' },
      stops: ['#2a1650', '#3b1d70', '#4a2590', '#20d8ff'],
      showWhen: { mode: [1] },
    },
  ],
  colours: [
    {
      id: 'tint',
      names: { en: 'Tint' },
      value: '#20d040',
      showWhen: { mode: [0] },
    },
  ],
};

describe('colours a scene names', () => {
  it('tint the window as they are: surface, accent and glow', () => {
    const sky = skyFromWindowColours(NAMED);
    expect(sky).toBeDefined();
    expect(hueDistance(sky?.hue ?? 0, hueOf(NAMED.surface))).toBeLessThan(1);
    expect(
      hueDistance(sky?.accent?.hue ?? 0, hueOf(NAMED.accent)),
    ).toBeLessThan(1);
    expect(hueDistance(sky?.active?.hue ?? 0, hueOf(NAMED.glow))).toBeLessThan(
      1,
    );
  });

  it('win over the palette, which is never consulted for them', () => {
    expect(sceneWindowColours({ ...NIGHT, windowColours: NAMED })).toEqual(
      NAMED,
    );
  });

  it('read a grey surface as a grey sky, the way polished metal is measured', () => {
    const sky = skyFromWindowColours({ ...NAMED, surface: '#3a3a3a' });
    expect(sky?.chroma).toBe(0);
    // The control: a coloured surface keeps its colour.
    expect(skyFromWindowColours(NAMED)?.chroma).toBeGreaterThan(0.02);
  });

  it('never say "on" in the red or amber that say off and wait', () => {
    expect(
      skyFromWindowColours({ ...NAMED, glow: '#ff4040' })?.active,
    ).toBeNull();
    expect(
      skyFromWindowColours({ ...NAMED, glow: '#ffb059' })?.active,
    ).toBeNull();
    expect(skyFromWindowColours(NAMED)?.active).not.toBeNull();
  });
});

describe('colours worked out from a palette', () => {
  it('give the same three colours every time, whatever order the stops are in', () => {
    const stops = ['#2a1650', '#3b1d70', '#4a2590', '#20d8ff'];
    const first = windowColoursFromStops(stops);
    expect(first).toBeDefined();
    expect(windowColoursFromStops([...stops])).toEqual(first);
    expect(windowColoursFromStops([...stops].reverse())).toEqual(first);
  });

  it('stand the window in the colour covering most of the palette, and point with the next', () => {
    const colours = windowColoursFromStops([
      '#2a1650',
      '#3b1d70',
      '#4a2590',
      '#20d8ff',
    ]);
    // Three stops of violet against one of cyan: the surface is the violet.
    expect(
      hueDistance(hueOf(colours?.surface ?? ''), hueOf('#3b1d70')),
    ).toBeLessThan(25);
    expect(
      hueDistance(hueOf(colours?.accent ?? ''), hueOf('#20d8ff')),
    ).toBeLessThan(25);
  });

  it('follow a choice the listener makes, as Colourful mode does', () => {
    const gradient = sceneWindowColours(NIGHT);
    const oneColour = sceneWindowColours(NIGHT, { params: { mode: 0 } });
    expect(gradient).toBeDefined();
    expect(oneColour).toBeDefined();
    expect(
      hueDistance(hueOf(oneColour?.surface ?? ''), hueOf('#20d040')),
    ).toBeLessThan(25);
    expect(oneColour).not.toEqual(gradient);
  });

  it('say nothing for greys, so the scene is measured instead', () => {
    expect(
      windowColoursFromStops(['#000000', '#7f7f7f', '#ffffff']),
    ).toBeUndefined();
    expect(sceneOwnSky({ params: [] })).toBeUndefined();
    // The control: a coloured palette does say something.
    expect(sceneOwnSky(NIGHT)).toBeDefined();
  });
});
