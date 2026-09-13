/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { readSurface, type TSurfaceName } from './theme';

/**
 * The drawings' resting colours — the titlebar wave and the level meter
 * when the rainbow is off — in the colours a Plus scene lends the window,
 * while it lends them.
 *
 * Those two paint "cyan tones" of their own, written as literals because they
 * are the app's signature at rest, and with a scene tinting the window they
 * were the one cyan left in it. They keep their literals without a tint: the
 * theme's own accent is not the same colour, and the resting look is theirs.
 */

export type TRampRole = 'darker' | 'dark' | 'accent' | 'light';

export interface IRampStop {
  offset: number;
  colour: string;
}

/** Which accent a stop becomes under a tint, at what opacity. */
export interface IRampRole {
  role: TRampRole;
  alpha?: number;
}

const TOKENS: Record<TRampRole, TSurfaceName> = {
  darker: '--accent-darker',
  dark: '--accent-dark',
  accent: '--accent',
  light: '--accent-light',
};

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/**
 * Whether a scene's tint is painted on the window: the tint marks the root
 * while its colours are on it (`sceneTintStore.ts`). An attribute, so asking
 * computes no style.
 */
export const isSceneTinted = () =>
  document.documentElement.hasAttribute('data-scene-tint');

const withAlpha = (hex: string, alpha: number | undefined) => {
  const match = HEX.exec(hex);
  if (alpha === undefined || !match) {
    return hex;
  }
  const [, red, green, blue] = match;
  return `rgba(${parseInt(red, 16)}, ${parseInt(green, 16)}, ${parseInt(
    blue,
    16,
  )}, ${alpha})`;
};

/** A bar's hue by where it stands, left to right, and how loud it is. */
type TSpectrumHue = (across: number, energy: number) => number;

/**
 * How far round the wheel the tinted bars sweep, centred on the scene's
 * accent. The resting sweep is 112°, cyan to violet; the same width around a
 * scene's colour reached colours the scene does not have.
 */
const TINT_SWEEP = 70;

/** The hue of a `#rrggbb` colour, in degrees. */
const hueOf = (hex: string): number | undefined => {
  const match = HEX.exec(hex);
  if (!match) {
    return undefined;
  }
  const [red, green, blue] = match
    .slice(1)
    .map((channel) => parseInt(channel, 16) / 255);
  const max = Math.max(red, green, blue);
  const spread = max - Math.min(red, green, blue);
  if (spread === 0) {
    return undefined;
  }
  let sector = (red - green) / spread + 4;
  if (max === red) {
    sector = ((green - blue) / spread + 6) % 6;
  } else if (max === green) {
    sector = (blue - red) / spread + 2;
  }
  return sector * 60;
};

let sweep: { accent: string; hue: TSpectrumHue } | undefined;

/**
 * The spectrum bars' hue: `resting` as it is, or — while a scene tints the
 * window — a narrower sweep centred on the scene's accent, so the bars are
 * the scene's colours instead of cyan into violet.
 */
export const tintedSpectrumHue = (resting: TSpectrumHue): TSpectrumHue => {
  if (!isSceneTinted()) {
    return resting;
  }
  const accent = readSurface('--accent', '');
  if (sweep?.accent !== accent) {
    const centre = hueOf(accent);
    sweep = {
      accent,
      hue:
        centre === undefined
          ? resting
          : (across) =>
              (centre - TINT_SWEEP / 2 + across * TINT_SWEEP + 360) % 360,
    };
  }
  return sweep.hue;
};

/** The last answer for each palette, so a drawing asking every frame allocates nothing. */
const answers = new WeakMap<
  readonly IRampStop[],
  { key: string; stops: readonly IRampStop[] }
>();

/**
 * `stops` as written, or — while a scene tints the window — each stop's colour
 * replaced by the tint's accent in the same role: the dark foot of a ramp by
 * the darker accent, its bright crest by the light one, and so on, at the
 * opacity the stop had.
 */
export const tintedStops = (
  stops: readonly IRampStop[],
  roles: readonly IRampRole[],
): readonly IRampStop[] => {
  if (!isSceneTinted()) {
    return stops;
  }
  const colours = roles.map(({ role, alpha }, index) =>
    withAlpha(readSurface(TOKENS[role], stops[index].colour), alpha),
  );
  const key = colours.join('|');
  const known = answers.get(stops);
  if (known?.key === key) {
    return known.stops;
  }
  const tinted = stops.map((stop, index) => ({
    offset: stop.offset,
    colour: colours[index],
  }));
  answers.set(stops, { key, stops: tinted });
  return tinted;
};
