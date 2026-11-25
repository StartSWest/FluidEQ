/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { labToHex, rgbToLab } from './oklab';
import {
  lumOf,
  over,
  rgbOf,
  textOn,
  type IInkSet,
  type TRgb,
} from './themeInk';

/**
 * THE INKS CODE IS READ IN ON THE WHITE WINDOW: a Forum post's code block,
 * the Studio's problems log (Ivan's pick, 2026-11-25, from the code-on-white
 * mockup) and the Studio's Code tab. All three were tuned for a dark well -
 * the app's palette lifted toward white on 28% to 32% black - and on the
 * white window that well turned grey and the tokens stood on it at 1.0 to
 * 2.6:1: a function name at 1.00, a keyword at 1.06, the driver's error line
 * at 1.32.
 *
 * Each ink keeps the hue it has on the dark window, taken deep: pink
 * keywords, green strings, cyan constants, violet functions, the error red.
 * Someone who switches side still reads the same code, only darker. Each is
 * moved toward black along its own hue only as far as it must go to reach
 * `CODE_INK_CONTRAST` on its well (`textOn`, the text tiers' rule), at every
 * Brightness of the light stretch.
 *
 * Written on a light window only. The dark window's stylesheet never reads
 * these: it keeps exactly the colours it shipped with.
 */
export const CODE_INK_TOKENS = [
  '--code-plain',
  '--code-comment',
  '--code-keyword',
  '--code-string',
  '--code-constant',
  '--code-function',
  '--code-entity',
  '--code-log-severity',
  '--code-log-location',
  '--code-log-name',
  '--code-log-message',
  // The Code tab's, one per kind its highlighter tells apart
  // (`glslTokens.ts`, `jsonTokens.ts`), and its line numbers.
  '--code-studio-text',
  '--code-studio-comment',
  '--code-studio-keyword',
  '--code-studio-number',
  '--code-studio-uniform',
  '--code-studio-builtin',
  '--code-studio-call',
  '--code-studio-line',
] as const;

export type TCodeInkToken = (typeof CODE_INK_TOKENS)[number];

/**
 * A tenth over AA's 4.5: the wells are modelled on the darkest ground each
 * place stands on (the floor, a post's own tint at its deepest, a line's red
 * at its deepest), so the real wells only ever measure better; the tenth
 * covers the rounding of each blend to whole bytes.
 */
export const CODE_INK_CONTRAST = 4.6;

/**
 * How the stylesheets build the wells, as shares of what they mix
 * (`ForumPost.scss`, `ForumProse.scss`, `Studio.scss`). A post is the edge
 * tint at 2.5%, a reply 2% and the accepted answer the accent at 7%: the
 * edge tint at 7% stands for the deepest of them, since the white window's
 * edge tint is a near-black and no accent it wears is much darker. The code
 * well is the edge tint at 7.5% over that, a step down with no hue and no
 * edge. The problems box is the red at 7% over its ground, and its log's
 * well the same red at 15% over the box: a step deeper in the box's own hue.
 */
const POST_TINT_DEEPEST = 0.07;
export const CODE_WELL_SHARE = 0.075;
const PROBLEMS_BOX_RED = 0.07;
export const PROBLEMS_LOG_RED = 0.15;

/**
 * The Code tab's lines a colour is laid under (`StudioCode.scss`): a line
 * something is wrong on is the red at 14% over the well, a removed line in a
 * change 13%; a line an outside save added is the green at 11%, an added
 * line in a change 12%. The deepest red and the deepest green stand for them.
 */
export const STUDIO_WRONG_RED = 0.14;
export const STUDIO_ADDED_GREEN = 0.12;

/** `$red` (_color.scss), what the problems box and its log are tinted with. */
const CODE_RED = '#ff647c';
/** `$analogous-2` (_color.scss), the diff's green. */
const CODE_GREEN = '#54ff8a';

/**
 * Where each token starts before it is moved: the dark window's hues as deep
 * inks. The red is the light window's own `--ink-removed` and the amber its
 * `--ink-caution` (App.scss), the Code tab's numbers on the dark window.
 */
const CODE_HUES = {
  pink: '#a8146a',
  green: '#22702a',
  cyan: '#00667e',
  violet: '#5a43c4',
  red: '#b42b2b',
  amber: '#8f5600',
} as const;

/** How much of the red the log's location takes over the faint tier. */
const LOCATION_RED_LEAN = 0.2;

const hexOfRgb = (rgb: TRgb) => labToHex(rgbToLab(rgb));

const darkest = (grounds: readonly TRgb[]): TRgb =>
  grounds.reduce((deepest, ground) =>
    lumOf(ground) < lumOf(deepest) ? ground : deepest,
  );

/**
 * The Code tab's well: the window's floor, `$surface-base`, which is the
 * grey the side columns stand on (Ivan, 2026-11-25: "the colour of the rest
 * of the app - not white, but the grey we have on the side panels"). It was
 * 32% black over the block, and on the white window that came out a mid grey
 * (#aaa at Brightness 100) under inks made for black. The inks are solved on
 * the deepest a line of it gets: the floor under a wrong line's red or a
 * new line's green.
 */
const studioCodeWell = (floor: TRgb): TRgb => {
  const red = rgbOf(CODE_RED);
  const green = rgbOf(CODE_GREEN);
  return darkest([
    floor,
    over(red, STUDIO_WRONG_RED, floor),
    over(green, STUDIO_ADDED_GREEN, floor),
  ]);
};

/**
 * The code inks for a window standing on `floor` with its inks solved on
 * `ground`, or none on a dark window (`set` running toward white). A tag
 * name (`.pl-ent`) and the Code tab's built-in function or JSON string are
 * the accent's light, as on the dark window.
 */
export const codeInkTokens = (
  floor: string,
  ground: TRgb,
  accentLight: string,
  set: IInkSet,
): Partial<Record<TCodeInkToken, string>> => {
  if (set.toward !== 'black') {
    return {};
  }
  const floorRgb = rgbOf(floor);
  const base = darkest([floorRgb, ground]);
  const edge = rgbOf(set.edge);
  const red = rgbOf(CODE_RED);
  const codeWell = over(
    edge,
    CODE_WELL_SHARE,
    over(edge, POST_TINT_DEEPEST, base),
  );
  const logWell = over(
    red,
    PROBLEMS_LOG_RED,
    over(red, PROBLEMS_BOX_RED, base),
  );
  const on = (well: TRgb) => (seed: string) =>
    textOn(seed, well, CODE_INK_CONTRAST, 'black');
  const code = on(codeWell);
  const log = on(logWell);
  const studio = on(studioCodeWell(floorRgb));
  const { text } = set;
  const leaningRed = hexOfRgb(
    over(red, LOCATION_RED_LEAN, rgbOf(text['--text-faint'])),
  );
  return {
    '--code-plain': code(text['--text-primary']),
    '--code-comment': code(text['--text-faint']),
    '--code-keyword': code(CODE_HUES.pink),
    '--code-string': code(CODE_HUES.green),
    '--code-constant': code(CODE_HUES.cyan),
    '--code-function': code(CODE_HUES.violet),
    '--code-entity': code(accentLight),
    '--code-log-severity': log(CODE_HUES.red),
    '--code-log-location': log(leaningRed),
    '--code-log-name': log(text['--text-primary']),
    '--code-log-message': log(text['--text-muted']),
    // The dark window's Code tab (`StudioCode.scss`): the text muted, a call
    // in the primary tier, comments and line numbers dim, keywords violet,
    // uniforms and JSON keys pink, numbers amber, built-ins the accent.
    '--code-studio-text': studio(text['--text-muted']),
    '--code-studio-comment': studio(text['--text-faint']),
    '--code-studio-keyword': studio(CODE_HUES.violet),
    '--code-studio-number': studio(CODE_HUES.amber),
    '--code-studio-uniform': studio(CODE_HUES.pink),
    '--code-studio-builtin': studio(accentLight),
    '--code-studio-call': studio(text['--text-primary']),
    '--code-studio-line': studio(text['--text-faint']),
  };
};
