/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A scene's palette as the app's own Colourful palette (Ivan, 2026-11-08:
 * "what ever user picks for that scene makes app goes that palette in wave
 * and meters"): in the palette's own order, readable on every theme shade,
 * the first palette the scene shows, the single colour a choice shows in its
 * place, the swatch where there is neither, and the Studio's project over
 * the graph's visualizer while its bench is on screen.
 */

import type * as TestingLibrary from '@testing-library/react';
import type { ReactElement } from 'react';
import type { IScenePack } from 'common/scenePacks';
import {
  contrast,
  hueDistance,
  luminance,
  parseCssColour,
  rgbToLab,
  toLinear,
} from 'renderer/utils/oklab';
import {
  LAGOON,
  rainbowFromColours,
  rainbowFromPalette,
} from 'renderer/utils/rainbowPalette';
import {
  sceneAppColourStops,
  type ISceneColourControls,
} from 'renderer/utils/sceneAppColours';
import { themeShadeTokens } from 'renderer/utils/themeShade';

jest.mock('renderer/utils/graphStyle', () => ({
  useSelectedLookId: () => 'premium:forest',
}));
jest.mock('renderer/utils/scenePacks', () => ({
  useUsableScenes: () => [
    {
      id: 'forest',
      lookId: 'premium:forest',
      version: 1,
      // Warm: nothing like the palettes below.
      swatch: ['#1a0500', '#ff6a00', '#ffd000'],
    },
  ],
}));
jest.mock('renderer/utils/memberScenes', () => ({
  useUsableMemberScenes: () => [],
}));

const lchOf = (hex: string) => {
  const parsed = parseCssColour(hex);
  if (!parsed) {
    throw new Error(`not a colour: ${hex}`);
  }
  const { l, a, b } = rgbToLab(parsed.rgb);
  return {
    l,
    c: Math.hypot(a, b),
    h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360,
  };
};
const RED_HUE = lchOf('#ff2020').h;
const BLUE_HUE = lchOf('#2040ff').h;
const GREEN_HUE = lchOf('#20d040').h;

const palette = (id: string, stops: string[], over = {}) => ({
  id,
  names: { en: id },
  stops,
  ...over,
});
const mode = {
  id: 'mode',
  names: { en: 'Mode' },
  min: 0,
  max: 1,
  value: 1,
  options: [{ names: { en: 'One colour' } }, { names: { en: 'Gradient' } }],
};
const controls = (
  over: Partial<ISceneColourControls> = {},
): ISceneColourControls => ({
  params: [mode],
  palettes: [palette('colours', ['#ff2020', '#2040ff'])],
  ...over,
});

describe('a palette as the app’s rainbow', () => {
  it('keeps the palette’s own order, bass to treble', () => {
    // Blue first: a swatch would be turned round the wheel; a palette is not.
    const stops = rainbowFromPalette({ stops: ['#2040ff', '#ff2020'] });
    expect(stops).toHaveLength(7);
    const hues = (stops ?? []).map((stop) => lchOf(stop).h);
    expect(hueDistance(hues[0], BLUE_HUE)).toBeLessThan(12);
    expect(hueDistance(hues[6], RED_HUE)).toBeLessThan(12);
  });

  it('puts each colour where the palette’s positions put it', () => {
    const even = rainbowFromPalette({
      stops: ['#ff2020', '#20d040', '#2040ff'],
    });
    const late = rainbowFromPalette({
      stops: ['#ff2020', '#20d040', '#2040ff'],
      positions: [0, 0.9, 1],
    });
    // Green at the middle evenly; still on the way from red when it stands late.
    expect(hueDistance(lchOf(even?.[3] ?? '').h, GREEN_HUE)).toBeLessThan(12);
    expect(hueDistance(lchOf(late?.[3] ?? '').h, GREEN_HUE)).toBeGreaterThan(
      20,
    );
  });

  it('lifts a dark palette into the band a thin mark reads in', () => {
    const stops =
      rainbowFromPalette({ stops: ['#000033', '#003300', '#330000'] }) ?? [];
    expect(stops).toHaveLength(7);
    stops.forEach((stop) => {
      const { l } = lchOf(stop);
      expect(l).toBeGreaterThan(0.69);
      expect(l).toBeLessThan(0.89);
    });
  });

  it('is no rainbow for greys alone, and keeps a grey stop grey', () => {
    expect(
      rainbowFromPalette({ stops: ['#000000', '#ffffff'] }),
    ).toBeUndefined();
    const stops =
      rainbowFromPalette({ stops: ['#808080', '#808080', '#ff2020'] }) ?? [];
    expect(lchOf(stops[0]).c).toBeLessThan(0.035);
    expect(lchOf(stops[6]).c).toBeGreaterThan(0.12);
  });

  // Every theme shade, darkest to lightest, against the floors the marks are
  // drawn on, Lagoon beside it as the bar the app already holds itself to.
  it('reads on the window at every theme shade, as Lagoon does', () => {
    const luminanceOf = (hex: string) => {
      const parsed = parseCssColour(hex);
      return parsed ? luminance(parsed.rgb.map(toLinear)) : 0;
    };
    const darkest = rainbowFromPalette({ stops: ['#000033', '#110022'] }) ?? [];
    expect(darkest).toHaveLength(7);
    [0, 50, 100].forEach((shade) => {
      const tokens = themeShadeTokens(shade);
      ['--surface-base', '--surface-panel'].forEach((floor) => {
        const ground = luminanceOf(tokens[floor as keyof typeof tokens]);
        const worst = (stops: readonly string[]) =>
          Math.min(...stops.map((stop) => contrast(luminanceOf(stop), ground)));
        expect(worst(darkest)).toBeGreaterThanOrEqual(
          Math.min(3, worst(LAGOON)),
        );
        expect(worst(darkest)).toBeGreaterThanOrEqual(3);
      });
    });
  });
});

describe('which colours a scene hands over', () => {
  it('hands over nothing without a palette or a colour', () => {
    expect(sceneAppColourStops({ params: [mode] })).toBeUndefined();
  });

  it('hands over its palette, the member’s over the pack’s', () => {
    expect(sceneAppColourStops(controls())).toEqual(
      rainbowFromPalette({ stops: ['#ff2020', '#2040ff'] }),
    );
    expect(
      sceneAppColourStops(controls(), {
        palettes: { colours: { stops: ['#20d040', '#2040ff'] } },
      }),
    ).toEqual(rainbowFromPalette({ stops: ['#20d040', '#2040ff'] }));
  });

  it('hands over the first of two palettes', () => {
    const two = controls({
      palettes: [
        palette('sky', ['#20d040', '#2040ff']),
        palette('colours', ['#ff2020', '#2040ff']),
      ],
    });
    expect(sceneAppColourStops(two)).toEqual(
      rainbowFromPalette({ stops: ['#20d040', '#2040ff'] }),
    );
  });

  it('follows a choice that swaps the palette for a single colour', () => {
    const swapped = controls({
      palettes: [
        palette('colours', ['#ff2020', '#2040ff'], {
          showWhen: { mode: [1] },
        }),
      ],
      colours: [
        {
          id: 'tint',
          names: { en: 'Tint' },
          value: '#20d040',
          showWhen: { mode: [0] },
        },
      ],
    });
    // Gradient, the pack's own choice: the palette.
    expect(sceneAppColourStops(swapped)).toEqual(
      rainbowFromPalette({ stops: ['#ff2020', '#2040ff'] }),
    );
    // One colour: the colour, as a swatch of one makes a rainbow.
    expect(sceneAppColourStops(swapped, { params: { mode: 0 } })).toEqual(
      rainbowFromColours(['#20d040']),
    );
    expect(
      sceneAppColourStops(swapped, {
        params: { mode: 0 },
        colours: { tint: '#2040ff' },
      }),
    ).toEqual(rainbowFromColours(['#2040ff']));
  });

  // The scene's bars, not its sky: what a choice shows in the main palette's
  // place wins over a second palette, which only stands in when there is
  // neither.
  it('puts the colour a choice shows in the main palette’s place ahead of a second palette', () => {
    const sky = palette('sky', ['#20d040', '#ffd000']);
    const swapped = controls({
      palettes: [
        palette('colours', ['#ff2020', '#2040ff'], {
          showWhen: { mode: [1] },
        }),
        sky,
      ],
      colours: [
        {
          id: 'tint',
          names: { en: 'Tint' },
          value: '#2040ff',
          showWhen: { mode: [0] },
        },
      ],
    });
    expect(sceneAppColourStops(swapped, { params: { mode: 0 } })).toEqual(
      rainbowFromColours(['#2040ff']),
    );
    expect(
      sceneAppColourStops({ ...swapped, colours: [] }, { params: { mode: 0 } }),
    ).toEqual(rainbowFromPalette(sky));
  });

  it('passes a palette of greys over for the colours it shows', () => {
    const grey = controls({
      palettes: [palette('colours', ['#000000', '#ffffff'])],
      colours: [{ id: 'tint', names: { en: 'Tint' }, value: '#20d040' }],
    });
    expect(sceneAppColourStops(grey)).toEqual(rainbowFromColours(['#20d040']));
  });
});

/** The stops in use once `RainbowSource` has rendered, from a fresh app. */
const stopsAfter = (
  setUp: (stores: typeof import('renderer/utils/sceneAppColours')) => void,
  params?: Record<string, number>,
): readonly string[] => {
  window.localStorage.clear();
  if (params) {
    window.localStorage.setItem(
      'fluideq.sceneParams',
      JSON.stringify({ 'premium:forest': params }),
    );
  }
  let stops: readonly string[] = [];
  jest.isolateModules(() => {
    /* eslint-disable global-require -- a fresh store for each launch */
    const library: typeof TestingLibrary = require('@testing-library/react/pure');
    const RainbowSource: () => ReactElement | null =
      require('renderer/components/RainbowSource').default;
    const rainbow: typeof import('renderer/utils/rainbowPalette') = require('renderer/utils/rainbowPalette');
    const stores: typeof import('renderer/utils/sceneAppColours') = require('renderer/utils/sceneAppColours');
    /* eslint-enable global-require */
    setUp(stores);
    library.render(<RainbowSource />);
    stops = rainbow.getRainbowStops();
    library.cleanup();
  });
  return stops;
};

const pack = (over: Partial<IScenePack>) =>
  ({
    params: [mode],
    palettes: [palette('colours', ['#2040ff', '#ff2020'])],
    ...over,
  }) as IScenePack;

describe('the window’s Colourful palette', () => {
  it('wears the visualizer’s palette once a pack of it has been drawn', () => {
    const stops = stopsAfter(({ reportSceneColourControls }) =>
      reportSceneColourControls('premium:forest', pack({})),
    );
    expect(stops).toEqual(
      rainbowFromPalette({ stops: ['#2040ff', '#ff2020'] }),
    );
  });

  // The control: before any pack is drawn, the swatch's warm colours.
  it('wears the swatch until then, and for a scene that chose no colours', () => {
    const warm = rainbowFromColours(['#1a0500', '#ff6a00', '#ffd000']);
    expect(stopsAfter(() => undefined)).toEqual(warm);
    expect(
      stopsAfter(({ reportSceneColourControls }) =>
        reportSceneColourControls(
          'premium:forest',
          pack({ palettes: undefined }),
        ),
      ),
    ).toEqual(warm);
  });

  it('follows the listener’s own choice on the graph', () => {
    const swapping = pack({
      palettes: [
        palette('colours', ['#2040ff', '#ff2020'], { showWhen: { mode: [1] } }),
      ],
      colours: [
        {
          id: 'tint',
          names: { en: 'Tint' },
          value: '#20d040',
          showWhen: { mode: [0] },
        },
      ],
    });
    const stops = stopsAfter(
      ({ reportSceneColourControls }) =>
        reportSceneColourControls('premium:forest', swapping),
      { mode: 0 },
    );
    expect(stops).toEqual(rainbowFromColours(['#20d040']));
  });

  it('wears the Studio’s project over the graph’s visualizer', () => {
    const studio = rainbowFromPalette({ stops: ['#20d040', '#ffd000'] }) ?? [];
    const stops = stopsAfter(
      ({ reportSceneColourControls, setStudioAppColours }) => {
        reportSceneColourControls('premium:forest', pack({}));
        setStudioAppColours(studio);
      },
    );
    expect(stops).toEqual(studio);
  });
});
