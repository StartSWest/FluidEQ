/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The inks code is read in on the white window (`codeInkTokens`): a Forum
 * post's code block, the Studio's problems log and the Studio's Code tab,
 * whose well is the window's floor and whose lines may be laid over with the
 * diff's red or green. On the white window the
 * dark theme's lifted colours stood on a grey well at 1.0 to 2.6:1. Each ink
 * now reaches AA on its well at every Brightness of the light stretch, keeps
 * the hue it has on the dark window, and is never written on a dark window,
 * whose stylesheet keeps exactly the colours it shipped with.
 *
 * The wells are built here from the stylesheets' own recipe, not from the
 * module's model, and measured on every ground and every post tint the
 * Forum paints: the floor and the pane; a reply, a post, the opening post
 * and the accepted answer.
 */

import {
  contrast,
  luminance,
  parseCssColour,
  rgbToLab,
  toLinear,
} from 'renderer/utils/oklab';
import pickedWindow from 'renderer/utils/pickedWindow';
import { CODE_INK_TOKENS } from 'renderer/utils/codeInk';
import {
  DARK_END_SHADE,
  OCEAN_SHADE,
  THEME_SHADE_MAX,
  themeInkTokens,
  themeShadeRule,
  themeShadeTokens,
} from 'renderer/utils/themeShade';

type TRgb = readonly [number, number, number];

const rgbOf = (text: string): TRgb => {
  const parsed = parseCssColour(text);
  if (!parsed) {
    throw new Error(`not a colour: ${text}`);
  }
  return parsed.rgb;
};

const over = (ink: TRgb, alpha: number, ground: TRgb): TRgb => [
  ink[0] * alpha + ground[0] * (1 - alpha),
  ink[1] * alpha + ground[1] * (1 - alpha),
  ink[2] * alpha + ground[2] * (1 - alpha),
];

const lum = (rgb: TRgb) => luminance(rgb.map(toLinear));
const ratio = (ink: string, ground: TRgb) =>
  contrast(lum(rgbOf(ink)), lum(ground));

/** `$red`, the problems box's tint. */
const RED = rgbOf('#ff647c');

/** The stylesheets' shares: ForumPost.scss, ForumProse.scss, Studio.scss. */
const POST_TINTS = [
  { name: 'a reply', of: 'edge', share: 0.02 },
  { name: 'a post', of: 'edge', share: 0.025 },
  { name: 'the opening post', of: 'accent', share: 0.05 },
  { name: 'the accepted answer', of: 'accent', share: 0.07 },
] as const;
const CODE_WELL = 0.075;
const BOX_RED = 0.07;
const LOG_RED = 0.15;

const FORUM_INKS = [
  '--code-plain',
  '--code-comment',
  '--code-keyword',
  '--code-string',
  '--code-constant',
  '--code-function',
  '--code-entity',
] as const;
const LOG_INKS = [
  '--code-log-severity',
  '--code-log-location',
  '--code-log-name',
  '--code-log-message',
] as const;

/**
 * The Studio's Code tab (StudioCode.scss): its well is the floor, and a
 * line is laid over with the red (a wrong line 14%, a removed one 13%) or
 * the green (an added line in a change 12%, one an outside save wrote 11%).
 */
const GREEN = rgbOf('#54ff8a');
const STUDIO_LINES = [
  { name: 'a plain line', tint: RED, share: 0 },
  { name: 'a wrong line', tint: RED, share: 0.14 },
  { name: 'a removed line', tint: RED, share: 0.13 },
  { name: 'an added line', tint: GREEN, share: 0.12 },
  { name: 'a line an outside save wrote', tint: GREEN, share: 0.11 },
] as const;
const STUDIO_INKS = [
  '--code-studio-text',
  '--code-studio-comment',
  '--code-studio-keyword',
  '--code-studio-number',
  '--code-studio-uniform',
  '--code-studio-builtin',
  '--code-studio-call',
  '--code-studio-line',
] as const;

interface IWindowTokens {
  floor: string;
  pane: string;
  edge: string;
  accent: string;
  inks: Readonly<Record<string, string | undefined>>;
}

/** Every well the two places paint on this window, by name. */
const wellsOf = (window: IWindowTokens) => {
  const grounds = [
    ['the floor', rgbOf(window.floor)],
    ['the pane', rgbOf(window.pane)],
  ] as const;
  const forum = grounds.flatMap(([groundName, ground]) =>
    POST_TINTS.map(({ name, of, share }) => {
      const tint = rgbOf(of === 'edge' ? window.edge : window.accent);
      const post = over(tint, share, ground);
      return {
        name: `${name} on ${groundName}`,
        well: over(rgbOf(window.edge), CODE_WELL, post),
      };
    }),
  );
  const log = grounds.map(([groundName, ground]) => ({
    name: `the problems box on ${groundName}`,
    well: over(RED, LOG_RED, over(RED, BOX_RED, ground)),
  }));
  const floor = rgbOf(window.floor);
  const studio = STUDIO_LINES.map(({ name, tint, share }) => ({
    name: `${name} in the Code tab`,
    well: over(tint, share, floor),
  }));
  return { forum, log, studio };
};

const lowestOn = (
  window: IWindowTokens,
  tokens: readonly string[],
  wells: readonly { name: string; well: TRgb }[],
) =>
  tokens.flatMap((token) => {
    const ink = window.inks[token];
    if (ink === undefined) {
      return [{ token, where: 'nowhere', ratio: 0 }];
    }
    return wells.map(({ name, well }) => ({
      token,
      where: name,
      ratio: ratio(ink, well),
    }));
  });

const themeWindow = (shade: number): IWindowTokens => {
  const table = themeShadeTokens(shade);
  const inks = themeInkTokens(shade);
  return {
    floor: table['--surface-base'],
    pane: table['--surface-panel'],
    edge: inks['--edge-tint'],
    accent: table['--accent'],
    inks,
  };
};

const failing = (window: IWindowTokens) => {
  const { forum, log, studio } = wellsOf(window);
  return [
    ...lowestOn(window, FORUM_INKS, forum),
    ...lowestOn(window, LOG_INKS, log),
    ...lowestOn(window, STUDIO_INKS, studio),
  ]
    .filter((reading) => reading.ratio < 4.5)
    .map(({ token, where, ratio: r }) => `${token} on ${where}: ${r}`);
};

const LIGHT_SHADES = [DARK_END_SHADE + 1, 90, THEME_SHADE_MAX];

describe('the code inks on the white window', () => {
  it.each(LIGHT_SHADES)(
    'reach AA on every well the three places paint, at Brightness %i',
    (shade) => {
      expect(failing(themeWindow(shade))).toEqual([]);
    },
  );

  it('stood far under AA there before (the control): the dark theme’s lifted colours on its grey well', () => {
    // ForumProse.scss's keyword, string, constant and function as they
    // shipped, on 28% black over a post on the white pane.
    const pane = rgbOf(themeShadeTokens(THEME_SHADE_MAX)['--surface-panel']);
    const grey = over([0, 0, 0], 0.28, over(rgbOf('#222222'), 0.025, pane));
    const lifted = ['#ff86cc', '#95ffb6', '#61efff', '#bfa5ff'];
    lifted.forEach((ink) => expect(ratio(ink, grey)).toBeLessThan(2));
  });

  it('keep the hue each kind has on the dark window', () => {
    const hue = (text: string) => {
      const { a, b } = rgbToLab(rgbOf(text));
      return (Math.atan2(b, a) * 180) / Math.PI;
    };
    const apart = (one: number, other: number) => {
      const turn = Math.abs(one - other) % 360;
      return Math.min(turn, 360 - turn);
    };
    // The dark window's colours (ForumProse.scss, Studio.scss).
    const dark = {
      '--code-keyword': '#ff86cc',
      '--code-string': '#95ffb6',
      '--code-constant': '#61efff',
      '--code-function': '#bfa5ff',
      '--code-log-severity': '#ffb9c4',
    } as const;
    LIGHT_SHADES.forEach((shade) => {
      const { inks } = themeWindow(shade);
      (Object.keys(dark) as (keyof typeof dark)[]).forEach((token) => {
        const ink = inks[token];
        expect(ink).toBeDefined();
        expect(apart(hue(ink ?? '#000000'), hue(dark[token]))).toBeLessThan(30);
      });
    });
  });
});

describe('the Studio’s Code tab on the white window', () => {
  /** A colour's hue in OKLab, in degrees. */
  const hue = (text: string) => {
    const { a, b } = rgbToLab(rgbOf(text));
    return (Math.atan2(b, a) * 180) / Math.PI;
  };
  const apart = (one: number, other: number) => {
    const turn = Math.abs(one - other) % 360;
    return Math.min(turn, 360 - turn);
  };

  it.each(LIGHT_SHADES)(
    'stood under AA there before (the control): the dark well came out grey, at Brightness %i',
    (shade) => {
      // StudioCode.scss as it shipped: 32% black over the block, a JSON key
      // the pink 70% into the window's ink, a line number the dim tier.
      const table = themeShadeTokens(shade);
      const { inks } = themeWindow(shade);
      const ink = rgbOf(inks['--ink'] ?? '#000000');
      const grey = over([0, 0, 0], 0.32, rgbOf(table['--surface-block']));
      const jsonKey = over(rgbOf('#ff3cac'), 0.7, ink);
      expect(contrast(lum(jsonKey), lum(grey))).toBeLessThan(3);
      // The well it stands on now is the floor, a step lighter.
      expect(lum(rgbOf(table['--surface-base']))).toBeGreaterThan(lum(grey));
    },
  );

  it('keeps the hue each kind has on the dark window', () => {
    // StudioCode.scss's dark colours: the keyword is the violet, a uniform
    // or a JSON key the pink, a number the amber, a built-in the accent.
    const dark = {
      '--code-studio-keyword': '#8b5cff',
      '--code-studio-uniform': '#ff3cac',
      '--code-studio-number': '#ffb059',
    } as const;
    LIGHT_SHADES.forEach((shade) => {
      const { inks } = themeWindow(shade);
      (Object.keys(dark) as (keyof typeof dark)[]).forEach((token) => {
        const ink = inks[token];
        expect(ink).toBeDefined();
        expect(apart(hue(ink ?? '#000000'), hue(dark[token]))).toBeLessThan(30);
      });
      const builtin = inks['--code-studio-builtin'];
      const accent = themeShadeTokens(shade)['--accent'];
      expect(builtin).toBeDefined();
      expect(apart(hue(builtin ?? '#000000'), hue(accent))).toBeLessThan(30);
    });
  });
});

describe('the dark window', () => {
  it.each([0, OCEAN_SHADE, DARK_END_SHADE])(
    'is never handed a code ink, at Brightness %i: its stylesheet keeps the colours it shipped with',
    (shade) => {
      expect(themeShadeRule(shade)).not.toContain('--code-');
      CODE_INK_TOKENS.forEach((token) =>
        expect(themeInkTokens(shade)).not.toHaveProperty(token),
      );
    },
  );

  it('the light stretch’s rule carries every one of them (the control)', () => {
    const rule = themeShadeRule(THEME_SHADE_MAX);
    CODE_INK_TOKENS.forEach((token) => expect(rule).toContain(`${token}:`));
  });
});

describe('colours somebody named', () => {
  const colours = { surface: '#1a0f2e', accent: '#ff3cac', glow: '#8b5cff' };

  it.each([DARK_END_SHADE + 1, THEME_SHADE_MAX])(
    'carry code inks reaching AA on the white window, at Brightness %i',
    (brightness) => {
      const worn = pickedWindow(colours, brightness);
      if (!worn) {
        throw new Error('the named colours could not be read');
      }
      const { tokens } = worn;
      const window: IWindowTokens = {
        floor: tokens['--surface-base'],
        pane: tokens['--surface-panel'],
        edge: tokens['--edge-tint'],
        accent: tokens['--accent'],
        inks: tokens,
      };
      expect(failing(window)).toEqual([]);
    },
  );

  it('carry none on a dark window', () => {
    const worn = pickedWindow(colours, OCEAN_SHADE);
    expect(worn).toBeDefined();
    CODE_INK_TOKENS.forEach((token) =>
      expect(worn?.tokens).not.toHaveProperty(token),
    );
  });
});
