/**
 * The window's Tint with a standard look (Ivan, 2026-10-25: "add a colour
 * tint option so they choose any colour with a slider"): Lagoon turned round
 * the colour wheel to the hue chosen, its rainbow with it, remembered.
 */

import type * as Tint from 'renderer/utils/windowTint';
import { LAGOON, LAGOON_SKY } from 'renderer/utils/rainbowPalette';
import { parseCssColour, rgbToLab } from 'renderer/utils/oklab';

const STORAGE_KEY = 'fluideq.windowTint';

// Read once, when the module loads: each launch starts from its own storage.
const launch = (stored?: string): typeof Tint => {
  window.localStorage.clear();
  if (stored !== undefined) {
    window.localStorage.setItem(STORAGE_KEY, stored);
  }
  let loaded: typeof Tint | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports -- a fresh copy per launch
    loaded = require('renderer/utils/windowTint') as typeof Tint;
  });
  if (!loaded) {
    throw new Error('the module did not load');
  }
  return loaded;
};

const hueOf = (hex: string) => {
  const parsed = parseCssColour(hex);
  const lab = parsed ? rgbToLab(parsed.rgb) : { l: 0, a: 0, b: 0 };
  return ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360;
};

const hueGap = (left: number, right: number) => {
  const gap = Math.abs(left - right) % 360;
  return Math.min(gap, 360 - gap);
};

describe('the window’s Tint', () => {
  it('is Lagoon itself until one is chosen, with the slider at Lagoon’s hue', () => {
    const tint = launch();
    expect(tint.LAGOON_HUE).toBe(LAGOON_SKY.accent?.hue);
    const same = tint.tintedLagoon(tint.LAGOON_HUE);
    expect(same.hue).toBeCloseTo(LAGOON_SKY.hue, 6);
    expect(same.accent?.hue).toBeCloseTo(tint.LAGOON_HUE, 6);
  });

  it('turns all of Lagoon so its accent stands at the hue chosen, keeping every lightness and chroma', () => {
    const tint = launch();
    const pink = tint.tintedLagoon(330);
    expect(pink.accent?.hue).toBeCloseTo(330, 6);
    const by = 330 - tint.LAGOON_HUE;
    expect(hueGap(pink.hue, LAGOON_SKY.hue + by)).toBeLessThan(1e-6);
    expect(
      hueGap(pink.active?.hue ?? 0, (LAGOON_SKY.active?.hue ?? 0) + by),
    ).toBeLessThan(1e-6);
    expect(pink.lightness).toBe(LAGOON_SKY.lightness);
    expect(pink.chroma).toBe(LAGOON_SKY.chroma);
    expect(pink.accent?.chroma).toBe(LAGOON_SKY.accent?.chroma);
    expect(pink.accent?.lightness).toBe(LAGOON_SKY.accent?.lightness);
  });

  it('turns Lagoon’s rainbow with it, so the graph and faders keep a rainbow in the colour chosen', () => {
    const tint = launch();
    const stops = tint.tintedLagoonStops(tint.LAGOON_HUE + 120);
    expect(stops).toHaveLength(LAGOON.length);
    stops.forEach((stop, at) => {
      expect(hueGap(hueOf(stop), hueOf(LAGOON[at]) + 120)).toBeLessThan(3);
    });
    // Unturned, the stops are Lagoon's own.
    tint
      .tintedLagoonStops(tint.LAGOON_HUE)
      .forEach((stop, at) =>
        expect(hueGap(hueOf(stop), hueOf(LAGOON[at]))).toBeLessThan(1),
      );
  });

  it('remembers the hue chosen as a whole degree on the wheel, and forgets it when set back', () => {
    const tint = launch();
    tint.setWindowTint(372.4);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('12');
    tint.setWindowTint(-30);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('330');
    tint.setWindowTint(undefined);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  // What a launch opens on, read through the store's one rule: setting the
  // value it already holds writes nothing.
  it('opens on the hue it was left at, and on Lagoon from nonsense', () => {
    const remembered = launch('250');
    const setItem = jest.spyOn(Storage.prototype, 'setItem');
    const removeItem = jest.spyOn(Storage.prototype, 'removeItem');
    remembered.setWindowTint(250);
    expect(setItem).not.toHaveBeenCalled();
    remembered.setWindowTint(251);
    expect(setItem).toHaveBeenCalledWith(STORAGE_KEY, '251');

    const broken = launch('cyan');
    removeItem.mockClear();
    broken.setWindowTint(undefined);
    expect(removeItem).not.toHaveBeenCalled();
    setItem.mockRestore();
    removeItem.mockRestore();
  });
});
