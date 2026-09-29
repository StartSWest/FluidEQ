/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useMemo } from 'react';
import type { GraphPalette, ResolvedGraphPalette } from 'common/graphStyles';
import { labToHex, parseCssColour, rgbToLab } from './oklab';
import { getRainbowStops, useRainbowStops } from './rainbowPalette';
import { readSurface, useLiveSurface, useRootHasClass } from './theme';

/**
 * THE WINDOW'S COLOURS, FOR EVERYTHING THAT IS DRAWN RATHER THAN STYLED.
 *
 * The window paints in two sets: Normal mode's primary and secondary — the
 * accent and the colour for "on", the theme's cyan and green or the first two
 * colours of the Plus visualizer lending the window its own — and Rainbow
 * mode's seven stops, Lagoon or that visualizer's rainbow
 * (`rainbowPalette.ts`). The visualizers, the meters and the look editor drew
 * colours of their own instead: a green, a five-colour spectrum of their own,
 * a meter ramp, each scene its own set, so a window dressed in a visualizer's
 * pinks drew its graph in cyan and green (Ivan, 2026-09-26: "update all
 * meters and standard viz to use our new theme bg and rainbow ... or whatever
 * rainbow the plus viz brings and primary and sec colors and update the edit
 * style colors and gradient too for all").
 *
 * In Normal mode a drawing is the primary's own tones — its dark, itself and
 * its light, the walk the titlebar's wave has always made — and the
 * secondary is the second of two things told apart (the right channel, the
 * side). A ramp from the primary into the secondary painted every loud
 * reading in the colour for "on", a green mass under a window that is
 * otherwise its accent on its floor (Ivan, 2026-09-26: "color in non rainbow
 * still not matching well the ui").
 *
 * A look somebody coloured keeps its colours; everything else asks here.
 */

const PRIMARY_FALLBACK = '#00e5cf';
const PRIMARY_DARK_FALLBACK = '#00a9d6';
const PRIMARY_LIGHT_FALLBACK = '#a1fcff';
const SECONDARY_FALLBACK = '#54ff8a';
const HEX = /^#[0-9a-f]{6}$/i;

/** A token's colour as `#rrggbb`, which is all the drawings' ramps parse. */
const asHex = (text: string, fallback: string): string => {
  if (HEX.test(text)) {
    return text.toLowerCase();
  }
  const parsed = parseCssColour(text);
  if (!parsed) {
    return fallback;
  }
  return `#${parsed.rgb
    .map((channel) =>
      Math.round(Math.max(0, Math.min(1, channel)) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
};

/** Whether the window is drawing in Rainbow mode right now. */
export const isWindowRainbow = (): boolean =>
  typeof document !== 'undefined' &&
  document.documentElement.classList.contains('is-euphoric');

/** Normal mode's first colour: the accent, as the window paints it now. */
export const windowPrimary = (): string =>
  asHex(readSurface('--accent', PRIMARY_FALLBACK), PRIMARY_FALLBACK);

const windowPrimaryDark = (): string =>
  asHex(
    readSurface('--accent-dark', PRIMARY_DARK_FALLBACK),
    PRIMARY_DARK_FALLBACK,
  );

const windowPrimaryLight = (): string =>
  asHex(
    readSurface('--accent-light', PRIMARY_LIGHT_FALLBACK),
    PRIMARY_LIGHT_FALLBACK,
  );

/** Normal mode's second colour: the colour for "on". */
const windowSecondary = (): string =>
  asHex(readSurface('--active', SECONDARY_FALLBACK), SECONDARY_FALLBACK);

const FLOOR_FALLBACK = '#0a1826';
let floorKey = '';
let floor: readonly [number, number, number] = [10, 24, 38];

/**
 * The window's floor — the theme's background, tinted by a visualizer when
 * one lends its colours — as channels, for a drawing's dark body: the slice
 * of a waterfall that hides the ones behind it, a range of mountains, a
 * legend's block. Each was a navy written in, the one dark in the picture
 * that was not the window's.
 */
export const windowFloor = (): readonly [number, number, number] => {
  const hex = asHex(
    readSurface('--surface-base', FLOOR_FALLBACK),
    FLOOR_FALLBACK,
  );
  if (hex !== floorKey) {
    floorKey = hex;
    floor = [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
  }
  return floor;
};

/** The floor as a fill, `darker` 0..1 of the way toward black. */
export const floorInk = (alpha: number, darker = 0): string => {
  const keep = 1 - Math.max(0, Math.min(1, darker));
  const [red, green, blue] = windowFloor().map((channel) =>
    Math.round(channel * keep),
  );
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
};

let liftedKey = '';
let lifted: readonly string[] = [];

/**
 * The floor lifted by each of `lifts` in OKLab lightness, as `#rrggbb`, for a
 * body that has to stand OUT of the window rather than sink into it: a
 * city's towers, which as fixed navies were darker than a slate floor. Same
 * hue as the floor, so they belong to the window whatever it wears. One
 * array per floor, so a ramp built from it is built once per change.
 */
export const floorLifted = (lifts: readonly number[]): readonly string[] => {
  const [red, green, blue] = windowFloor();
  const key = `${floorKey}|${lifts.join(',')}`;
  if (key !== liftedKey) {
    liftedKey = key;
    const lab = rgbToLab([red / 255, green / 255, blue / 255]);
    lifted = lifts.map((lift) =>
      labToHex({ ...lab, l: Math.max(0, Math.min(0.97, lab.l + lift)) }),
    );
  }
  return lifted;
};

/**
 * One array per set of colours, so the drawings that cache a ramp by the
 * array it was built from — every frame asks — build it once per change.
 * Bounded: a set is a theme's, a visualizer's or a rainbow's, a handful in a
 * session, and a window that somehow walked through more starts again.
 */
const REMEMBERED_SETS = 48;
const remembered = new Map<string, readonly string[]>();

const rememberSet = (colours: readonly string[]): readonly string[] => {
  const key = colours.join('|');
  const known = remembered.get(key);
  if (known) {
    return known;
  }
  if (remembered.size >= REMEMBERED_SETS) {
    remembered.clear();
  }
  remembered.set(key, colours);
  return colours;
};

/** The primary's walk, foot to crest: its dark, itself and its light. */
const primaryWalk = (
  dark: string,
  primary: string,
  light: string,
): readonly string[] => rememberSet([dark, primary, light]);

const colourSet = (
  rainbow: boolean,
  stops: readonly string[],
  walk: readonly string[],
): readonly string[] => (rainbow ? stops : walk);

/**
 * The set the window draws in right now: the rainbow's stops, or the
 * primary's walk.
 */
export const windowColours = (): readonly string[] =>
  colourSet(
    isWindowRainbow(),
    getRainbowStops(),
    primaryWalk(windowPrimaryDark(), windowPrimary(), windowPrimaryLight()),
  );

/**
 * What a look with no colours of its own is painted in: the window's set, and
 * for one flat colour the primary itself — or the rainbow's first stop. The
 * walk's first colour is the primary's dark, which as a flat colour is a
 * dimmer accent than the window's own.
 */
const lookColoursOf = (
  palette: GraphPalette,
  set: readonly string[],
  rainbow: boolean,
): readonly string[] => {
  if (palette !== 'signal') {
    return set;
  }
  return rememberSet([rainbow ? set[0] : (set[1] ?? set[0])]);
};

export const windowLookColours = (palette: GraphPalette): readonly string[] =>
  lookColoursOf(palette, windowColours(), isWindowRainbow());

const lightnessOf = (hex: string): number | undefined => {
  const parsed = parseCssColour(hex);
  return parsed ? rgbToLab(parsed.rgb).l : undefined;
};

const shiftLightness = (hex: string, by: number): string => {
  const parsed = parseCssColour(hex);
  if (!parsed) {
    return hex;
  }
  const lab = rgbToLab(parsed.rgb);
  return labToHex({ ...lab, l: Math.max(0.12, Math.min(0.97, lab.l + by)) });
};

let mateKey = '';
let mate: readonly string[] = [SECONDARY_FALLBACK];

/**
 * The second of two readings told apart — the right channel beside the left,
 * the side beside the mid — in Normal mode: the secondary's walk, its dark
 * and light standing as far from it in OKLab lightness as the primary's
 * stand from the primary, or for one flat colour the secondary itself. In
 * Rainbow mode there is no second colour to take, and the views turn the
 * look's own stops (`mateColours`), so this answers nothing.
 */
export const windowMateColours = (
  palette: GraphPalette,
): readonly string[] | undefined => {
  if (isWindowRainbow()) {
    return undefined;
  }
  const secondary = windowSecondary();
  if (palette === 'signal') {
    return rememberSet([secondary]);
  }
  const walk = [windowPrimaryDark(), windowPrimary(), windowPrimaryLight()];
  const key = `${secondary}|${walk.join('|')}`;
  if (key === mateKey) {
    return mate;
  }
  mateKey = key;
  const [dark, base, light] = walk.map(lightnessOf);
  mate =
    base === undefined || dark === undefined || light === undefined
      ? [secondary]
      : [
          shiftLightness(secondary, dark - base),
          secondary,
          shiftLightness(secondary, light - base),
        ];
  return mate;
};

/**
 * The measuring views that draw the spectrum as a curve or a row of bars.
 * Their own ramp runs up the axis, and a reading seldom reaches the top: in
 * Rainbow mode it showed the first stop or two — Lagoon's pale aqua — as one
 * flat colour (Ivan, 2026-09-26: "not right color"). On Auto with the
 * window's colours they lay the rainbow across the frequency axis instead,
 * each frequency in the colour of the band slider under it.
 */
const ACROSS_IN_RAINBOW: ReadonlySet<string> = new Set([
  'analyzer',
  'compare',
  'average',
  'rta',
  'midside',
]);

export const windowViewPalette = (
  style: string,
  chosen: GraphPalette,
  resolved: ResolvedGraphPalette,
  colours: readonly string[],
): ResolvedGraphPalette =>
  chosen === 'auto' &&
  colours.length === 0 &&
  resolved === 'level' &&
  ACROSS_IN_RAINBOW.has(style) &&
  isWindowRainbow()
    ? 'rainbow'
    : resolved;

/** A look's own colours when it has any, otherwise the window's. */
export const lookPaintColours = (
  palette: GraphPalette,
  colours: readonly string[],
): readonly string[] =>
  colours.length > 0 ? colours : windowLookColours(palette);

/**
 * The window's set for a component, which draws again when the mode, the
 * rainbow or the primary and secondary change: the look picker's icons and
 * the look editor's swatches.
 */
export const useWindowColours = (): readonly string[] => {
  const rainbow = useRootHasClass('is-euphoric');
  const stops = useRainbowStops();
  const dark = useLiveSurface('--accent-dark', PRIMARY_DARK_FALLBACK);
  const primary = useLiveSurface('--accent', PRIMARY_FALLBACK);
  const light = useLiveSurface('--accent-light', PRIMARY_LIGHT_FALLBACK);
  return useMemo(
    () =>
      colourSet(
        rainbow,
        stops,
        primaryWalk(
          asHex(dark, PRIMARY_DARK_FALLBACK),
          asHex(primary, PRIMARY_FALLBACK),
          asHex(light, PRIMARY_LIGHT_FALLBACK),
        ),
      ),
    [rainbow, stops, dark, primary, light],
  );
};

/** `useWindowColours` for one palette, as `windowLookColours` answers it. */
export const useWindowLookColours = (
  palette: GraphPalette,
): readonly string[] => {
  const rainbow = useRootHasClass('is-euphoric');
  const set = useWindowColours();
  return useMemo(
    () => lookColoursOf(palette, set, rainbow),
    [palette, set, rainbow],
  );
};
