/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What Colourful mode draws in (`RainbowSource`). With a standard look, the
 * window's own pair (2026-11-18, `windowTint.ts`): a gradient from its first
 * colour to the second - the default violet until the listener chooses
 * (2026-11-24) - or the first colour seven times once one colour is asked
 * for. With a Plus scene, the scene's (Ivan, 2026-11-24): the palette it
 * chose for its wave (`sceneAppColours.test.tsx`), else the gradient from
 * the accent it lends the window to its second colour at its hour ("it's
 * from primary to secondary colour"), else the window's own pair - never its
 * picture as measured, nor its picker swatch: Alpine's lanterns put a yellow
 * in its wave that its aurora does not have. A scene the window is set to
 * Original over, with a Tint the listener touched, draws the Tint's pair.
 */

import type * as TestingLibrary from '@testing-library/react';
import type { ReactElement } from 'react';
import type { IScenePack } from 'common/scenePacks';
import type {
  ISceneWindowColours,
  ISceneWindowColourStops,
} from 'common/sceneWindowColours';
import { hueDistance, parseCssColour, rgbToLab } from 'renderer/utils/oklab';
import {
  RAINBOW_STOP_COUNT,
  rainbowBetween,
} from 'renderer/utils/rainbowPalette';
import {
  SCENE_SKY_MEASUREMENT,
  type ISceneColour,
  type ISceneSky,
} from 'renderer/utils/sceneTint';
import {
  DEFAULT_SECOND_COLOUR,
  windowPrimaryColour,
} from 'renderer/utils/windowTint';

interface IListing {
  swatch: string[];
  windowColours?: ISceneWindowColours;
  windowColourStops?: ISceneWindowColourStops;
}

let mockLookId = 'premium:alpine';
// Warm, with a yellow: the swatch never reaches the stops.
const WARM_SWATCH = ['#1a0500', '#ff6a00', '#ffd000'];
let mockListing: IListing = { swatch: WARM_SWATCH };

jest.mock('renderer/utils/graphStyle', () => ({
  useSelectedLookId: () => mockLookId,
}));
jest.mock('renderer/utils/scenePacks', () => ({
  useUsableScenes: () => [
    { id: 'alpine', lookId: 'premium:alpine', version: 1, ...mockListing },
  ],
}));
jest.mock('renderer/utils/memberScenes', () => ({
  useUsableMemberScenes: () => [],
}));

/** Alpine's own: a slate surface, its violet accent, a pale ice second colour. */
const ALPINE: ISceneWindowColours = {
  surface: '#3d4a5d',
  accent: '#cb73ff',
  glow: '#cee3fb',
};
/** A night set apart from its day, to see the stops follow the hour. */
const ALPINE_NIGHT: ISceneWindowColours = {
  surface: '#0b1220',
  accent: '#3fe0ff',
  glow: '#ff5fd2',
};

const colour = (hue: number): ISceneColour => ({
  lightness: 0.8,
  chroma: 0.16,
  hue,
  share: 0.05,
});

/** OKLCH hue of a clear yellow, as a lantern measures. */
const YELLOW_HUE = 100;

/** A picture measured with a lantern in it: its accent and palette yellow. */
const MEASURED_WITH_LANTERN: ISceneSky = {
  ...colour(200),
  accent: colour(YELLOW_HUE),
  active: colour(YELLOW_HUE + 10),
  palette: [200, YELLOW_HUE, 130, 300, YELLOW_HUE + 15].map(colour),
};

const hueOf = (hex: string) => {
  const parsed = parseCssColour(hex);
  if (!parsed) {
    throw new Error(`not a colour: ${hex}`);
  }
  const { a, b } = rgbToLab(parsed.rgb);
  return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
};

const hasNoYellow = (stops: readonly string[]) =>
  stops.every((stop) => hueDistance(hueOf(stop), YELLOW_HUE) > 25);

/** The fresh stores of one launch, for a case to set up before it renders. */
interface IStores {
  appColours: typeof import('renderer/utils/sceneAppColours');
  tintStore: typeof import('renderer/utils/sceneTintStore');
  rainbow: typeof import('renderer/utils/rainbowPalette');
}

beforeEach(() => {
  mockLookId = 'premium:alpine';
  mockListing = { swatch: WARM_SWATCH };
});

/**
 * The stops in use once `RainbowSource` has rendered, from a fresh app with
 * `stored` measured for the scene at its night and its day, `settings` in
 * storage, and `setUp` run on the fresh modules first.
 */
const stopsWith = (
  stored: ISceneSky | undefined,
  settings: Record<string, string> = {},
  setUp: (stores: IStores) => void = () => undefined,
): readonly string[] => {
  window.localStorage.clear();
  if (stored) {
    window.localStorage.setItem(
      'fluideq.sceneTint.skies',
      JSON.stringify({
        measurement: SCENE_SKY_MEASUREMENT,
        rows: [
          ['premium:alpine', '1', stored],
          ['premium:alpine@100', '1', stored],
        ],
      }),
    );
  }
  Object.entries(settings).forEach(([key, value]) =>
    window.localStorage.setItem(key, value),
  );
  let stops: readonly string[] = [];
  jest.isolateModules(() => {
    /* eslint-disable global-require -- a fresh store for each launch */
    const library: typeof TestingLibrary = require('@testing-library/react/pure');
    const RainbowSource: () => ReactElement | null =
      require('renderer/components/RainbowSource').default;
    const palette: typeof import('renderer/utils/rainbowPalette') = require('renderer/utils/rainbowPalette');
    setUp({
      appColours: require('renderer/utils/sceneAppColours'),
      tintStore: require('renderer/utils/sceneTintStore'),
      rainbow: palette,
    });
    /* eslint-enable global-require */
    library.render(<RainbowSource />);
    stops = palette.getRainbowStops();
    library.cleanup();
  });
  return stops;
};

describe('Colourful mode with a Plus scene', () => {
  // Alpine-like: no palette, so the accent to the second colour, exactly as
  // the window's own pair is drawn.
  it('draws the gradient from the scene’s accent to its second colour', () => {
    mockListing = { swatch: WARM_SWATCH, windowColourStops: { '100': ALPINE } };
    const stops = stopsWith(MEASURED_WITH_LANTERN);
    expect(stops).toEqual(rainbowBetween(ALPINE.accent, ALPINE.glow));
    expect(stops[0]).toBe('#cb73ff');
    expect(stops[RAINBOW_STOP_COUNT - 1]).toBe('#cee3fb');
    expect(hasNoYellow(stops)).toBe(true);
  });

  // A listing from before the points carries the one set alone.
  it('draws the accent to the second colour of a scene that names one set', () => {
    mockListing = { swatch: WARM_SWATCH, windowColours: ALPINE };
    expect(stopsWith(undefined)).toEqual(
      rainbowBetween(ALPINE.accent, ALPINE.glow),
    );
  });

  // The window wears the listener's own set for the scene where they chose
  // one, and the wave wears it with the window.
  it('follows the window colours the listener chose for the scene', () => {
    mockListing = { swatch: WARM_SWATCH, windowColourStops: { '100': ALPINE } };
    const chosen = { surface: '#101820', accent: '#ff7a3d', glow: '#3dd6ff' };
    const stops = stopsWith(undefined, {
      'fluideq.sceneWindowColours': JSON.stringify({
        'premium:alpine': chosen,
      }),
    });
    expect(stops).toEqual(rainbowBetween(chosen.accent, chosen.glow));
  });

  // The rule this pins: a measured picture never reaches the stops, however
  // yellow its lantern. With nothing named and no palette, the window's own
  // pair.
  it('never draws in the scene’s measured picture, nor its swatch', () => {
    const stops = stopsWith(MEASURED_WITH_LANTERN);
    expect(stops).toEqual(
      rainbowBetween(
        windowPrimaryColour(undefined, undefined),
        DEFAULT_SECOND_COLOUR,
      ),
    );
    expect(hasNoYellow(stops)).toBe(true);
    // Nor before it is measured: the swatch's orange and yellow are not it.
    expect(stopsWith(undefined)).toEqual(stops);
  });

  // While the Studio lends the window its project, the graph look's palette
  // is no colour of the project's: Alpine on the bench wore Chrome's violet
  // to yellow from the graph.
  it('never lends the Studio’s project the graph look’s palette', () => {
    const studioPack = {
      params: [],
      windowColourStops: { '100': ALPINE },
    } as unknown as IScenePack;
    const graphPack = {
      params: [],
      palettes: [
        {
          id: 'colours',
          names: { en: 'Colours' },
          stops: ['#46327e', '#277f8e', '#4ac16d', '#fde725'],
        },
      ],
    } as unknown as IScenePack;
    const stops = stopsWith(undefined, {}, ({ appColours, tintStore }) => {
      appColours.reportSceneColourControls('premium:alpine', graphPack);
      tintStore.setStudioTintSource({
        project: 'alpine',
        playing: { build: '1', pack: studioPack },
      });
    });
    expect(stops).toEqual(rainbowBetween(ALPINE.accent, ALPINE.glow));
    expect(hasNoYellow(stops)).toBe(true);
    // CONTROL: without the Studio, the graph look's own palette stands.
    const graphStops = stopsWith(undefined, {}, ({ appColours }) =>
      appColours.reportSceneColourControls('premium:alpine', graphPack),
    );
    expect(hasNoYellow(graphStops)).toBe(false);
  });

  it('draws in the Tint’s pair over a scene the window is set to Original over', () => {
    mockListing = { swatch: WARM_SWATCH, windowColourStops: { '100': ALPINE } };
    const settings = {
      'fluideq.sceneTintMode': 'off',
      'fluideq.windowTintColour': '#ff0080',
      'fluideq.windowTint': '350',
      'fluideq.windowTintSecondary': '#00c0ff',
    };
    expect(stopsWith(undefined, settings)).toEqual(
      rainbowBetween('#ff0080', '#00c0ff'),
    );
    // CONTROL: in the scene's colours, the scene's stops, whatever the Tint.
    expect(
      stopsWith(undefined, { ...settings, 'fluideq.sceneTintMode': 'tint' }),
    ).toEqual(rainbowBetween(ALPINE.accent, ALPINE.glow));
  });

  it('leaves a scene its colours on Original while the Tint is untouched', () => {
    mockListing = { swatch: WARM_SWATCH, windowColourStops: { '100': ALPINE } };
    expect(stopsWith(undefined, { 'fluideq.sceneTintMode': 'off' })).toEqual(
      rainbowBetween(ALPINE.accent, ALPINE.glow),
    );
  });

  // The default second colour is no choice of the listener's: a scene the
  // window is set to Original over keeps its own colours under it, exactly
  // as with no second colour at all (Ivan, 2026-11-24).
  it('leaves a scene its colours on Original under the default second colour', () => {
    mockListing = { swatch: WARM_SWATCH, windowColourStops: { '100': ALPINE } };
    const untouched = stopsWith(undefined, { 'fluideq.sceneTintMode': 'off' });
    const oneColour = stopsWith(undefined, {
      'fluideq.sceneTintMode': 'off',
      'fluideq.windowTintSecondary': 'none',
    });
    expect(untouched).toEqual(oneColour);
    expect(untouched).toEqual(rainbowBetween(ALPINE.accent, ALPINE.glow));
    // CONTROL: a second colour CHOSEN does take the scene over.
    expect(
      stopsWith(undefined, {
        'fluideq.sceneTintMode': 'off',
        'fluideq.windowTintSecondary': '#00c0ff',
      }),
    ).toEqual(
      rainbowBetween(windowPrimaryColour(undefined, undefined), '#00c0ff'),
    );
  });

  it('draws a scene with no colours of its own in the window’s, not a rainbow', () => {
    const stops = stopsWith(undefined, {
      'fluideq.windowTintColour': '#40c0a0',
      'fluideq.windowTint': '165',
      'fluideq.windowTintSecondary': 'none',
    });
    expect(stops).toEqual(Array(RAINBOW_STOP_COUNT).fill('#40c0a0'));
  });
});

describe('Colourful mode with a standard look', () => {
  beforeEach(() => {
    mockLookId = 'look:signal';
    mockListing = { swatch: WARM_SWATCH, windowColourStops: { '100': ALPINE } };
  });

  // A new window: Lagoon's accent to the default violet (Ivan, 2026-11-24).
  it('draws a gradient to the default violet on a window where nothing was chosen', () => {
    const stops = stopsWith(undefined);
    expect(stops).toEqual(
      rainbowBetween(
        windowPrimaryColour(undefined, undefined),
        DEFAULT_SECOND_COLOUR,
      ),
    );
    expect(new Set(stops).size).toBeGreaterThan(2);
  });

  it('draws in one colour, seven times, once one colour is asked for', () => {
    const stops = stopsWith(undefined, {
      'fluideq.windowTintSecondary': 'none',
    });
    expect(stops).toHaveLength(RAINBOW_STOP_COUNT);
    expect(new Set(stops).size).toBe(1);
  });

  // Both ends read on the dark window's floor as they are, so the stops worn
  // are the stops chosen: a dark end (#8800ff) is lifted there, hue kept,
  // until a line in it reads (`paletteOnDark`, b96dae4b9), which is the
  // palette's rule and not what this file is about.
  it('draws a gradient once the Tint is given a second colour', () => {
    const stops = stopsWith(undefined, {
      'fluideq.windowTintColour': '#ff8800',
      'fluideq.windowTint': '50',
      'fluideq.windowTintSecondary': '#b080ff',
    });
    expect(stops).toEqual(rainbowBetween('#ff8800', '#b080ff'));
    expect(new Set(stops).size).toBeGreaterThan(2);
  });
});

describe('a scene with a night set as well', () => {
  // One set per scene, the day's, as the window wears it
  // (`resolveStopColours`, Ivan 2026-11-19: "pick the colour from the day,
  // and that's the colour for the whole scene"): a night set written before
  // that changes neither the window nor the wave.
  it('draws the set the window wears, the day’s', () => {
    mockListing = {
      swatch: WARM_SWATCH,
      windowColourStops: { '0': ALPINE_NIGHT, '100': ALPINE },
    };
    expect(stopsWith(undefined)).toEqual(
      rainbowBetween(ALPINE.accent, ALPINE.glow),
    );
  });
});

describe('a scene that chose its wave’s colours', () => {
  // Chrome-like: its palette before the window's pair, every colour of it.
  it('draws its palette ahead of its window colours', () => {
    mockListing = { swatch: WARM_SWATCH, windowColourStops: { '100': ALPINE } };
    const viridis = ['#46327e', '#277f8e', '#4ac16d', '#fde725'];
    let expected: readonly string[] | undefined;
    const stops = stopsWith(undefined, {}, ({ appColours, rainbow }) => {
      appColours.reportSceneColourControls('premium:alpine', {
        params: [],
        palettes: [{ id: 'colours', names: { en: 'Colours' }, stops: viridis }],
      } as unknown as IScenePack);
      expected = rainbow.rainbowFromPalette({ stops: viridis });
    });
    expect(stops).toEqual(expected);
    expect(stops).not.toEqual(rainbowBetween(ALPINE.accent, ALPINE.glow));
  });
});
