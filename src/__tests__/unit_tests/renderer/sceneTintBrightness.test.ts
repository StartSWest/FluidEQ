/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window-colours menu's Brightness: one per mode that lends the window a
 * scene's colours, remembered, and turned by the palette into a lift of the
 * surfaces' lightness that never passes where the app's light text still
 * reads (Ivan, 2026-09-25: "add another slider too for the brightness so the
 * light theme we can do more light").
 */

import { rgbToLab, parseCssColour } from '../../../renderer/utils/oklab';
import {
  TINT_LIGHTNESS_PER_STEP,
  tintThemePalette,
} from '../../../renderer/utils/sceneTintPalette';
import type { ISceneSky } from '../../../renderer/utils/sceneTint';

type TBrightnessModule =
  typeof import('../../../renderer/utils/sceneTintBrightness');

const load = (stored?: string): TBrightnessModule => {
  window.localStorage.clear();
  if (stored !== undefined) {
    window.localStorage.setItem('fluideq.sceneTintBrightness', stored);
  }
  let brightness: TBrightnessModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    brightness = require('../../../renderer/utils/sceneTintBrightness');
  });
  if (!brightness) {
    throw new Error('the brightness module did not load');
  }
  return brightness;
};

const lightnessOf = (hex: string | undefined) => {
  const colour = parseCssColour(hex ?? '');
  if (!colour) {
    throw new Error(`not a colour: ${hex}`);
  }
  return rgbToLab(colour.rgb).l;
};

describe('the Brightness setting', () => {
  afterEach(() => window.localStorage.clear());

  it('starts every mode at the theme’s own lightness, and the theme at none', () => {
    const { getTintBrightness } = load();
    expect(getTintBrightness('tint')).toBe(0);
    expect(getTintBrightness('pulse')).toBe(0);
    expect(getTintBrightness('cover')).toBe(0);
    expect(getTintBrightness('off')).toBe(0);
  });

  it('keeps each mode its own, within the slider’s ends, and remembers them', () => {
    const { getTintBrightness, setTintBrightness } = load();
    setTintBrightness('cover', 35);
    setTintBrightness('pulse', -80);
    expect(getTintBrightness('cover')).toBe(35);
    expect(getTintBrightness('pulse')).toBe(-50);
    expect(getTintBrightness('tint')).toBe(0);
    const again = load(
      window.localStorage.getItem('fluideq.sceneTintBrightness') ?? '',
    );
    expect(again.getTintBrightness('cover')).toBe(35);
    expect(again.getTintBrightness('pulse')).toBe(-50);
  });

  it('reads a damaged entry as nothing set', () => {
    expect(load('{not json').getTintBrightness('cover')).toBe(0);
    expect(load('{"cover":"loud"}').getTintBrightness('cover')).toBe(0);
  });
});

describe('the lift in the palette', () => {
  const base = {
    '--surface-base': '#050608',
    '--surface-panel': '#0c0e12',
    '--surface-block': '#12151a',
  };
  const sky: ISceneSky = {
    lightness: 0.42,
    chroma: 0.11,
    hue: 35,
    share: 0.62,
    accent: null,
    active: null,
  };

  it('leaves the theme’s lightness alone at none', () => {
    const plain = tintThemePalette(base, sky);
    expect(tintThemePalette(base, sky, 0)).toEqual(plain);
    expect(lightnessOf(plain['--surface-base'])).toBeCloseTo(
      lightnessOf(base['--surface-base']),
      2,
    );
  });

  it('lifts every surface by the steps asked, keeping their order', () => {
    const lifted = tintThemePalette(base, sky, 30 * TINT_LIGHTNESS_PER_STEP);
    const floor = lightnessOf(lifted['--surface-base']);
    const pane = lightnessOf(lifted['--surface-panel']);
    const block = lightnessOf(lifted['--surface-block']);
    expect(floor).toBeCloseTo(
      lightnessOf(base['--surface-base']) + 30 * TINT_LIGHTNESS_PER_STEP,
      2,
    );
    expect(floor).toBeLessThan(pane);
    expect(pane).toBeLessThan(block);
  });

  it('never lifts a surface past where light text still reads', () => {
    const lifted = tintThemePalette(base, sky, 5);
    Object.values(lifted)
      .filter((value): value is string => typeof value === 'string')
      .filter((value) => value.startsWith('#'))
      .forEach((value) => expect(lightnessOf(value)).toBeLessThanOrEqual(0.53));
  });

  it('stops a lowered surface at black', () => {
    const lowered = tintThemePalette(base, sky, -50 * TINT_LIGHTNESS_PER_STEP);
    expect(lightnessOf(lowered['--surface-base'])).toBeGreaterThanOrEqual(0);
  });
});
