/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window's surfaces under a visualizer's colours below the knee of the
 * Brightness (`DARK_KNEE`, the middle of the dark walk): the colour they have
 * at the knee, darkened toward near black at 0, and the edges and the accent
 * left as the toning paints them (Ivan, 2026-10-24/25: "just the bg color
 * dont touch primary or sec", "when I move to 0 it gets lost its color when
 * on ambient or color mode"; 2026-11-14: "even on 0 brightness the green is
 * too light on the panels"). Past the dark stretch the window stays white
 * (2026-11-17: "se deja white siempre para que el acento se pueda ver").
 *
 * The knee used to be Brightness 50; since the slider runs on into a light
 * window (2026-11-17) it is the middle of the dark stretch, and a stored
 * Brightness is on that scale (`fluideq.themeScale`). A scene with no named
 * colours lends the window the colours the app works out from its measured
 * picture (`windowColoursOfSky`), all day while only its night is measured.
 *
 * The scene is never drawn here: its measurement is stood in for by a
 * remembered sky, as in `sceneTintWindow.test.tsx`.
 */

import '@testing-library/jest-dom';
import type * as TestingLibrary from '@testing-library/react';
import type { ReactElement } from 'react';
import {
  SCENE_SKY_MEASUREMENT,
  type ISceneSky,
} from '../../../renderer/utils/sceneTint';
import {
  skyFromWindowColours,
  windowColoursOfSky,
} from '../../../renderer/utils/sceneOwnColours';
import {
  DARK_FLOOR_LIGHTNESS,
  DARK_KNEE,
} from '../../../renderer/utils/sceneTintDark';
import { tintThemePalette } from '../../../renderer/utils/sceneTintPalette';
import { toneShadeOf } from '../../../renderer/utils/sceneTintStore';
import {
  DARK_END_SHADE,
  THEME_SHADE_MAX,
  themeShadeTokens,
} from '../../../renderer/utils/themeShade';
import { parseCssColour, rgbToLab } from '../../../renderer/utils/oklab';

jest.mock('../../../renderer/utils/graphStyle', () => ({
  useSelectedLookId: () => 'premium:fireflies',
}));
jest.mock('../../../renderer/utils/scenePacks', () => ({
  useUsableScenes: () => [
    { id: 'fireflies', lookId: 'premium:fireflies', version: 3, swatch: [] },
  ],
}));
jest.mock('../../../renderer/utils/memberScenes', () => ({
  useUsableMemberScenes: () => [],
}));
jest.mock('../../../renderer/graph/sceneSky', () => ({
  measureSceneSky: () => Promise.resolve(undefined),
  measureStudioSky: () => Promise.resolve(undefined),
  // A scene with no choices made is remembered under its own version.
  sceneSkyVersion: (_lookId: string, version: string) => version,
}));

const root = document.documentElement;

/**
 * Fireflies as Ivan's window measured it: little of the frame, little colour
 * — the scene the tint was lost on.
 */
const FAINT: ISceneSky = {
  hue: 131,
  chroma: 0.049,
  lightness: 0.22,
  share: 0.13,
  accent: null,
  active: null,
};

/** The sky the window is toned by: the colours the app works out of FAINT. */
const LENT = skyFromWindowColours(windowColoursOfSky(FAINT));

const THEME = `:root { --surface-base: #0d2030; --surface-panel: #1a3a4e; --accent: #00e5cf; --active: #54ff8a; }`;

let library: typeof TestingLibrary | undefined;
type TTheme = typeof import('../../../renderer/utils/theme');

beforeEach(() => {
  window.localStorage.setItem(
    'fluideq.sceneTint.skies',
    JSON.stringify({
      measurement: SCENE_SKY_MEASUREMENT,
      rows: [['premium:fireflies', '3', FAINT]],
    }),
  );
  const style = document.createElement('style');
  style.id = 'theme';
  style.textContent = THEME;
  document.head.appendChild(style);
});

afterEach(() => {
  library?.cleanup();
  library = undefined;
  window.localStorage.clear();
  root.removeAttribute('style');
  root.removeAttribute('data-scene-tint');
  document.getElementById('theme')?.remove();
});

/** The window at `shade` in `mode`, and the theme module it reads. */
const mount = (mode: string, shade: number) => {
  window.localStorage.setItem('fluideq.sceneTintMode', mode);
  // A Brightness on today's scale, not one to be moved onto it.
  window.localStorage.setItem('fluideq.themeScale', '2');
  window.localStorage.setItem('fluideq.theme', String(shade));
  let theme: TTheme | undefined;
  let SceneTint: (() => ReactElement | null) | undefined;
  jest.isolateModules(() => {
    /* eslint-disable global-require */
    library = require('@testing-library/react/pure');
    theme = require('../../../renderer/utils/theme');
    SceneTint = require('../../../renderer/components/SceneTint').default;
    /* eslint-enable global-require */
  });
  if (!theme || !SceneTint || !library) {
    throw new Error('the tint did not load');
  }
  const Tint = SceneTint;
  library.render(<Tint />);
  return theme;
};

const token = (name: string) => root.style.getPropertyValue(name);

const floorAt = (mode: string, shade: number) => {
  mount(mode, shade);
  const floor = token('--surface-base');
  library?.cleanup();
  root.removeAttribute('style');
  return floor;
};

const labOf = (hex: string) => {
  const parsed = parseCssColour(hex);
  if (!parsed) {
    throw new Error(`not a colour: ${hex}`);
  }
  return rgbToLab(parsed.rgb);
};

const hueOf = (hex: string) => {
  const { a, b } = labOf(hex);
  return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
};

const chromaOf = (hex: string) => {
  const { a, b } = labOf(hex);
  return Math.hypot(a, b);
};

const hueApart = (left: number, right: number) => {
  const apart = Math.abs(left - right) % 360;
  return apart > 180 ? 360 - apart : apart;
};

/** What the toning alone gives at the Brightness `shade`, as Colours holds it. */
const toned = (shade: number) => {
  if (!LENT) {
    throw new Error('no sky to tone by');
  }
  return tintThemePalette(
    themeShadeTokens(toneShadeOf('held', shade)),
    LENT,
    1,
  );
};

describe('the window under a scene’s colours below the knee', () => {
  // Within 8 degrees: a near-black floor is written in whole bytes, and at
  // #03090a one step of red turns the hue 6 degrees.
  it('keeps the hue it has at the knee all the way to 0, in Colours and Ambient', () => {
    ['tint', 'pulse'].forEach((mode) => {
      const knee = hueOf(floorAt(mode, DARK_KNEE));
      [0, 10, 25].forEach((shade) => {
        expect(hueApart(hueOf(floorAt(mode, shade)), knee)).toBeLessThan(8);
      });
    });
    // POSITIVE CONTROL: the theme's own floor at 0, which the window falls
    // back to where the scene's colour is lost, is well off that hue.
    expect(
      hueApart(
        hueOf(themeShadeTokens(0)['--surface-base']),
        hueOf(floorAt('tint', DARK_KNEE)),
      ),
    ).toBeGreaterThan(20);
  });

  it('is near black at 0 and darker at every step down from the knee', () => {
    let previous = Number.POSITIVE_INFINITY;
    [DARK_KNEE, 30, 20, 10, 0].forEach((shade) => {
      const { l } = labOf(floorAt('tint', shade));
      expect(l).toBeLessThan(previous);
      previous = l;
    });
    expect(previous).toBeCloseTo(DARK_FLOOR_LIGHTNESS, 2);
  });

  it('darkens every surface and leaves the edges their toning', () => {
    mount('tint', 0);
    const expected = toned(0);
    ['--border-panel', '--border-subtle'].forEach((name) =>
      expect(token(name)).toBe(expected[name as keyof typeof expected]),
    );
    // POSITIVE CONTROL: the floor and the panes moved, and darker.
    ['--surface-base', '--surface-panel', '--surface-block'].forEach((name) => {
      const own = expected[name as keyof typeof expected] ?? '';
      expect(token(name)).not.toBe(own);
      expect(labOf(token(name)).l).toBeLessThan(labOf(own).l);
    });
  });

  it('leaves the knee and the rest of the dark stretch exactly as the toning paints them', () => {
    [DARK_KNEE, 50, DARK_END_SHADE].forEach((shade) => {
      expect(floorAt('tint', shade)).toBe(toned(shade)['--surface-base']);
    });
  });

  // The light window stays white: a scene's colour reaches its accent and
  // its glow, never its panes or its greys (Ivan, 2026-11-17).
  it('leaves the light window’s panes and floor without the scene’s hue', () => {
    [DARK_END_SHADE + 1, 90, THEME_SHADE_MAX].forEach((shade) => {
      mount('tint', shade);
      const theme = themeShadeTokens(shade);
      (['--surface-base', '--surface-panel'] as const).forEach((name) => {
        // Left to the theme, or written as a grey: never the scene's hue.
        const worn = token(name) || theme[name];
        expect(chromaOf(worn)).toBeLessThan(0.005);
      });
      // The scene's colour is still on the window: in its accent.
      expect(chromaOf(token('--accent'))).toBeGreaterThan(0.02);
      library?.cleanup();
      root.removeAttribute('style');
    });
    expect(themeShadeTokens(THEME_SHADE_MAX)['--surface-panel']).toBe(
      '#ffffff',
    );
    // CONTROL: the same scene's colour is in its panes on the dark side.
    library?.cleanup();
    root.removeAttribute('style');
    mount('tint', DARK_END_SHADE);
    expect(chromaOf(token('--surface-panel'))).toBeGreaterThan(0.02);
  });

  // Two steps of the slider tone against the same rounded shade, so a
  // repaint keyed on that shade alone would leave the floor where the first
  // put it.
  it('follows every step of the slider, not only the steps that move the toning', () => {
    const from = Array.from({ length: DARK_KNEE }, (_, shade) => shade).find(
      (shade) => toneShadeOf('held', shade) === toneShadeOf('held', shade + 1),
    );
    if (from === undefined) {
      throw new Error('every step of the dark stretch moves the toning');
    }
    const theme = mount('tint', from);
    const before = token('--surface-base');
    theme.setThemeShade(from + 1);
    expect(token('--surface-base')).not.toBe(before);
  });
});
