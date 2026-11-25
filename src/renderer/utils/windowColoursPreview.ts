/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  ISceneWindowColours,
  TSceneWindowColourRole,
} from 'common/sceneWindowColours';
import pickedWindow, { isUsableGlow } from './pickedWindow';
import { paletteForSide, rainbowBetween } from './rainbowPalette';
import { skyFromWindowColours } from './sceneOwnColours';
import { DARK_KNEE, darkenSurfaces } from './sceneTintDark';
import { tintThemePalette } from './sceneTintPalette';
import { toneShadeOf } from './sceneTintStore';
import { labOf } from './windowFill';
import { darkInkSet, lightInkSet } from './windowLight';
import { isLightShade, themeActiveOf, themeShadeTokens } from './themeShade';

/**
 * WHERE EACH OF A SCENE'S THREE COLOURS LANDS IN THE WINDOW (Ivan,
 * 2026-11-25, of the small window under the three swatches: "this preview
 * doesn't really show where the second colour may be used").
 *
 * Read from what the window paints, not from the swatches' captions:
 *
 * - The SURFACE is the floor, the panes and the fields (`pickedWindow`).
 * - The ACCENT is every filled button (`button-solid`), a switch's block
 *   when it is on (`Switch.scss`), the chosen tab's underline (`tab`), and
 *   on the DSP page the line that says what a stage did (`--dsp-applied`).
 * - The SECOND COLOUR is "on" (`--active`): a processor's lamp on the rail
 *   (`_dspRail.scss`), the ON and ACTIVE badges (`badge-on`), the live
 *   dots, and the DSP page's spectrum (`--dsp-spectrum`). It is also where
 *   the window's colourful marks end - the title bar's wave, the level
 *   meters, the bands and faders run from the accent to it
 *   (`RainbowSource`, `rainbowBetween`).
 *
 * A second colour on the red or amber that say off and wait, or a grey,
 * never says "on" (`isUsableGlow`): colours somebody named then wear the
 * accent there (`pickedWindow`), and colours the window works out from a
 * palette wear FluidEQ's own (`activeUnder` in `sceneTintPalette.ts`). It
 * still ends the colourful marks, which say no state: `RainbowSource` hands
 * the colour on as it is.
 */

/** The parts of the small window, each a real part of the big one. */
export const PREVIEW_PARTS = [
  'floor',
  'pane',
  'field',
  'tab',
  'switch',
  'button',
  'curve',
  'wave',
  'meter',
  'lamp',
  'badge',
  'live',
  'spectrum',
] as const;

export type TPreviewPart = (typeof PREVIEW_PARTS)[number];

/**
 * Which colour a part takes: one of the three as it is, "on", or the run
 * from the accent to the second colour.
 */
type TPartKind = 'surface' | 'accent' | 'on' | 'run';

const KIND_OF: Record<TPreviewPart, TPartKind> = {
  floor: 'surface',
  pane: 'surface',
  field: 'surface',
  tab: 'accent',
  switch: 'accent',
  button: 'accent',
  curve: 'accent',
  wave: 'run',
  meter: 'run',
  lamp: 'on',
  badge: 'on',
  live: 'on',
  spectrum: 'on',
};

/**
 * What says "on" in these colours: the second colour itself, the accent
 * standing in for one that cannot (named colours), or FluidEQ's own
 * standing in (colours worked out from a palette).
 */
export type TOnSource = 'second' | 'accent' | 'own';

/** `colours`' "on", as `pickedWindow` and `skyFromWindowColours` decide it. */
export const onSourceOf = (
  colours: ISceneWindowColours,
  named: boolean,
): TOnSource => {
  if (named) {
    const glow = labOf(colours.glow);
    return glow && isUsableGlow(glow) ? 'second' : 'accent';
  }
  return skyFromWindowColours(colours)?.active ? 'second' : 'own';
};

export interface IPartWearers {
  /** The colours, of the three, that this part is painted in. */
  wears: readonly TSceneWindowColourRole[];
  /** A colour this part would wear, refused there and stood in for. */
  standsIn: readonly TSceneWindowColourRole[];
}

/**
 * Which of the three colours `part` wears with "on" from `on`; `ownRun`
 * where the colourful marks wear something other than these colours (the
 * scene's own wave palette, or the window's own pair).
 */
export const partWearers = (
  part: TPreviewPart,
  on: TOnSource,
  ownRun: boolean,
): IPartWearers => {
  const kind = KIND_OF[part];
  if (kind === 'surface' || kind === 'accent') {
    return { wears: [kind], standsIn: [] };
  }
  if (kind === 'run') {
    return { wears: ownRun ? [] : ['accent', 'glow'], standsIn: [] };
  }
  if (on === 'second') {
    return { wears: ['glow'], standsIn: [] };
  }
  return { wears: on === 'accent' ? ['accent'] : [], standsIn: ['glow'] };
};

/** What the small window is painted in. */
export interface IPreviewPaint {
  floor: string;
  pane: string;
  field: string;
  /** An empty track: a switch that is off, a meter's unlit cells. */
  well: string;
  accent: string;
  /** The words on a filled accent. */
  onAccent: string;
  /** "On", whoever it comes from (`on`). */
  active: string;
  /** The words on a filled "on". */
  onActive: string;
  /** The quiet ink the small window's words are drawn as bars in. */
  ink: string;
  /** The seven stops the colourful marks run through, as worn here. */
  run: readonly string[];
  on: TOnSource;
  /** Whether `run` is something other than these colours' own. */
  ownRun: boolean;
  isLight: boolean;
}

type TTokens = Readonly<Record<string, string | undefined>>;

/**
 * The theme at Brightness `shade`, with its "on", as the window's toning
 * starts from it (`baseOf` in `sceneTintStore.ts`): without `--active` the
 * toning has no "on" to turn to the scene's colour.
 */
const themeAt = (shade: number): TTokens => {
  const at = toneShadeOf('held', shade);
  return { '--active': themeActiveOf(at), ...themeShadeTokens(at) };
};

/**
 * Every token the window wears for `colours` at Brightness `shade`, by the
 * window's own rules: as named (`pickedWindow`), or their hue lent to the
 * theme (`tintThemePalette`, `darkenSurfaces`).
 */
const tokensOf = (
  colours: ISceneWindowColours,
  named: boolean,
  shade: number,
): TTokens | undefined => {
  // At the Brightness the window is at: a surface picked never moves it
  // (Ivan, 2026-11-18), so the small window shows the colours as the window
  // will wear them, the white one on a white window (2026-11-17: "make the
  // inside white on the white theme").
  const worn = named ? pickedWindow(colours, shade, 'brightness') : undefined;
  if (worn) {
    return worn.tokens;
  }
  const sky = skyFromWindowColours(colours);
  if (!sky) {
    return undefined;
  }
  const base = themeAt(shade);
  const palette = darkenSurfaces(
    tintThemePalette(base as Record<string, string>, sky),
    tintThemePalette(themeAt(DARK_KNEE) as Record<string, string>, sky),
    shade,
  );
  const ink = isLightShade(shade)
    ? darkInkSet(undefined)
    : lightInkSet(undefined);
  return { ...base, ...ink.text, ...palette };
};

/**
 * The small window's paint for `colours` at Brightness `shade`, worn as
 * named when `named`; `run` is what the colourful marks run through when
 * it is not the accent to the second colour. Undefined when a colour
 * cannot be read.
 */
export const previewPaintOf = (
  colours: ISceneWindowColours,
  named: boolean,
  shade: number,
  run?: readonly string[],
): IPreviewPaint | undefined => {
  const tokens = tokensOf(colours, named, shade);
  const floor = tokens?.['--surface-base'];
  const pane = tokens?.['--surface-panel'];
  const accent = tokens?.['--accent'];
  if (!tokens || !floor || !pane || !accent) {
    return undefined;
  }
  const isLight = isLightShade(shade);
  const on = onSourceOf(colours, named);
  const active = tokens['--active'] ?? accent;
  return {
    floor,
    pane,
    field: tokens['--surface-field'] ?? pane,
    well: tokens['--track-well'] ?? floor,
    accent,
    // Unset, the stylesheet labels a fill in the floor's colour
    // (`_shippedTheme.scss`).
    onAccent: tokens['--on-accent'] ?? floor,
    active,
    onActive: tokens['--on-active'] ?? floor,
    ink: tokens['--text-muted'] ?? (isLight ? '#5b6573' : '#9aa7b6'),
    run: paletteForSide(
      run ?? rainbowBetween(colours.accent, colours.glow),
      isLight,
    ),
    on,
    ownRun: run !== undefined,
    isLight,
  };
};
