/**
 * The window's Tint with a standard look (Ivan, 2026-10-25: "add a colour
 * tint option so they choose any colour with a slider"): Lagoon turned round
 * the colour wheel to the hue chosen, remembered; a colour picked whole from
 * the swatch's picker; and a second colour that turns the window's marks into
 * a gradient from the first (2026-11-18).
 */

import type * as Tint from 'renderer/utils/windowTint';
import {
  LAGOON_SKY,
  RAINBOW_STOP_COUNT,
  sceneColourHex,
} from 'renderer/utils/rainbowPalette';
import { parseCssColour, rgbToLab } from 'renderer/utils/oklab';

const STORAGE_KEY = 'fluideq.windowTint';
const COLOUR_KEY = 'fluideq.windowTintColour';
const SECONDARY_KEY = 'fluideq.windowTintSecondary';

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

type TRtl = typeof import('@testing-library/react/pure');

/**
 * A launch on `stored`, with a renderer from the same fresh registry: a hook
 * of the store read through another copy of React is no hook at all.
 */
const launchWithHooks = (stored: Record<string, string> = {}) => {
  window.localStorage.clear();
  Object.entries(stored).forEach(([key, value]) =>
    window.localStorage.setItem(key, value),
  );
  let loaded: { tint: typeof Tint; rtl: TRtl } | undefined;
  jest.isolateModules(() => {
    loaded = {
      // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports -- a fresh copy per launch
      tint: require('renderer/utils/windowTint') as typeof Tint,
      // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports -- the same registry's React
      rtl: require('@testing-library/react/pure') as TRtl,
    };
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

  // The first colour as the window wears it: picked whole, else Lagoon's
  // accent turned to the hue, else Lagoon's own accent (2026-11-18).
  it('wears a colour picked whole as picked, and the hue’s Lagoon accent otherwise', () => {
    const tint = launch();
    const lagoonAccent = sceneColourHex(LAGOON_SKY.accent ?? LAGOON_SKY);
    expect(tint.windowPrimaryColour(undefined, undefined)).toBe(lagoonAccent);
    const turned = tint.windowPrimaryColour(tint.LAGOON_HUE + 120, undefined);
    expect(hueGap(hueOf(turned), tint.LAGOON_HUE + 120)).toBeLessThan(2);
    // Black included: a picked colour is never moved.
    expect(tint.windowPrimaryColour(200, '#000000')).toBe('#000000');
    expect(tint.windowPrimaryColour(undefined, '#ff8800')).toBe('#ff8800');
  });

  // One colour seven times by default; a gradient once a second is chosen,
  // its ends exactly the two colours (Ivan, 2026-11-18: "by default the
  // primary and the secondary have the same colour, and if the user changes
  // it, the gradient is created").
  it('draws one colour in every stop, and a gradient between two once a second is chosen', () => {
    const tint = launch();
    const one = tint.windowTintStops('#3fa4d0', undefined);
    expect(one).toEqual(Array(RAINBOW_STOP_COUNT).fill('#3fa4d0'));
    const two = tint.windowTintStops('#3fa4d0', '#d03f8a');
    expect(two).toHaveLength(RAINBOW_STOP_COUNT);
    expect(two[0]).toBe('#3fa4d0');
    expect(two[RAINBOW_STOP_COUNT - 1]).toBe('#d03f8a');
    // The control: the middle is neither end.
    expect(new Set(two).size).toBeGreaterThan(2);
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

describe('a colour picked whole for the Tint', () => {
  it('is kept whole, standing at its hue on the slider, and let go by the slider', () => {
    const tint = launch();
    tint.setWindowTintColour('#FF8800', 32.6);
    expect(window.localStorage.getItem(COLOUR_KEY)).toBe('#ff8800');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('33');
    // The slider moved again goes back to the wheel.
    tint.setWindowTint(90);
    expect(window.localStorage.getItem(COLOUR_KEY)).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('90');
  });

  it('refuses what is not a colour, and opens on the one it was left at', () => {
    const tint = launch();
    tint.setWindowTintColour('orange', 30);
    expect(window.localStorage.getItem(COLOUR_KEY)).toBeNull();

    const reopened = launchWithHooks({ [COLOUR_KEY]: '#123456' });
    const { result } = reopened.rtl.renderHook(() =>
      reopened.tint.useWindowTintColour(),
    );
    expect(result.current).toBe('#123456');
    reopened.rtl.cleanup();
  });
});

/** The second colour as a launch on `stored` wears it and as it was chosen. */
const secondOnLaunch = (stored: Record<string, string>) => {
  const { tint, rtl } = launchWithHooks(stored);
  const worn = rtl.renderHook(() => tint.useWindowTintSecondary());
  const chosen = rtl.renderHook(() => tint.useWindowTintSecondChosen());
  const one = rtl.renderHook(() => tint.useWindowTintOneColour());
  const seen = {
    worn: worn.result.current,
    read: tint.getWindowTintSecondary(),
    chosen: chosen.result.current,
    isOneColour: one.result.current,
  };
  rtl.cleanup();
  return seen;
};

describe('the Tint’s second colour', () => {
  // Ivan, 2026-11-24: "I think we should default a second color for the app
  // UI. Pick a nice purple one"; he picked the violet from the board.
  it('is the default violet on a window where nothing was chosen, and never writes it', () => {
    const tint = launch();
    expect(tint.DEFAULT_SECOND_COLOUR).toBe('#8b6cff');
    expect(secondOnLaunch({})).toEqual({
      worn: '#8b6cff',
      read: '#8b6cff',
      // Worn, not chosen: the default is no choice of the listener's.
      chosen: undefined,
      isOneColour: false,
    });
    expect(window.localStorage.getItem(SECONDARY_KEY)).toBeNull();
  });

  // Ivan's own window holds #ae00ff: it must still be #ae00ff after the
  // default arrives, because a colour chosen wins over it.
  it('keeps a colour chosen before the default, #ae00ff staying #ae00ff', () => {
    expect(secondOnLaunch({ [SECONDARY_KEY]: '#ae00ff' })).toEqual({
      worn: '#ae00ff',
      read: '#ae00ff',
      chosen: '#ae00ff',
      isOneColour: false,
    });
    expect(window.localStorage.getItem(SECONDARY_KEY)).toBe('#ae00ff');
  });

  it('keeps one colour asked for across a launch, and the default does not come back', () => {
    const { tint, rtl } = launchWithHooks();
    const { result } = rtl.renderHook(() => tint.useWindowTintSecondary());
    rtl.act(() => tint.setWindowTintSecondary(undefined));
    expect(result.current).toBeUndefined();
    expect(window.localStorage.getItem(SECONDARY_KEY)).toBe('none');
    rtl.cleanup();

    expect(secondOnLaunch({ [SECONDARY_KEY]: 'none' })).toEqual({
      worn: undefined,
      read: undefined,
      chosen: undefined,
      isOneColour: true,
    });
    // CONTROL: the key taken away is the default again.
    expect(secondOnLaunch({}).worn).toBe('#8b6cff');
  });

  it('opens on the default from nonsense in the key', () => {
    expect(secondOnLaunch({ [SECONDARY_KEY]: 'purple' }).worn).toBe('#8b6cff');
  });

  it('is remembered when chosen, kept when the first colour moves, and gives way to one colour', () => {
    const { tint, rtl } = launchWithHooks();
    const { act } = rtl;
    const { result } = rtl.renderHook(() => tint.useWindowTintSecondary());

    act(() => tint.setWindowTintSecondary('#D03F8A'));
    expect(result.current).toBe('#d03f8a');
    expect(window.localStorage.getItem(SECONDARY_KEY)).toBe('#d03f8a');
    // Not a colour: refused, the second kept.
    act(() => tint.setWindowTintSecondary('not a colour'));
    expect(result.current).toBe('#d03f8a');
    // Moving the first colour keeps the second where it was put.
    act(() => tint.setWindowTint(40));
    expect(result.current).toBe('#d03f8a');

    act(() => tint.setWindowTintSecondary(undefined));
    expect(result.current).toBeUndefined();
    expect(window.localStorage.getItem(SECONDARY_KEY)).toBe('none');
    rtl.cleanup();
  });

  // The picker's Cancel puts back the choice, not the colour worn: nothing
  // chosen goes back to nothing chosen, never to the default written down.
  it('puts back each of the three choices exactly on a restore', () => {
    const tint = launch();
    const before = tint.windowTintSnapshot();
    tint.setWindowTintSecondary('#d03f8a');
    tint.restoreWindowTint(before);
    expect(window.localStorage.getItem(SECONDARY_KEY)).toBeNull();
    expect(tint.getWindowTintSecondary()).toBe('#8b6cff');

    tint.setWindowTintSecondary(undefined);
    const one = tint.windowTintSnapshot();
    tint.setWindowTintSecondary('#d03f8a');
    tint.restoreWindowTint(one);
    expect(window.localStorage.getItem(SECONDARY_KEY)).toBe('none');
    expect(tint.getWindowTintSecondary()).toBeUndefined();

    tint.setWindowTintSecondary('#ae00ff');
    const picked = tint.windowTintSnapshot();
    tint.setWindowTintSecondary(undefined);
    tint.restoreWindowTint(picked);
    expect(window.localStorage.getItem(SECONDARY_KEY)).toBe('#ae00ff');
  });
});
