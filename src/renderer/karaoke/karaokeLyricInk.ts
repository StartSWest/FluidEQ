/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { parseCssColour } from '../utils/oklab';
import { readAccent, readSurface, readSurfaceAlpha } from '../utils/theme';

// THE WORDS ON A WHITE WINDOW (Ivan, 2026-11-18: "fix karaoke, not good").
// The stage's words are written for a dark window: a near-white face under a
// thin dark key. On white that face vanished and the key alone was left, a
// hollow outline, and the next line (the same near-white at 94%) could not
// be read at all. On a light window the words are the window's own inks,
// solid and with no outline: the line being sung in the strongest text ink,
// the lines round it in the secondary one (9:1 on white, 8:1 at the next
// line's 94%), the sung part in the accent as before. `KaraokeLyrics.tsx`
// draws the dark window exactly as it did.

type TRgb = readonly [number, number, number];

/** The colours of one frame's words on a light window. */
export interface ILightLyricInk {
  /** The line being sung: the strongest text ink. */
  lead: TRgb;
  /** The lines round it: the secondary text ink. */
  around: TRgb;
  /** A section's name, and the line a capture is timing. */
  accent: string;
  /** The line a capture has finished timing. */
  accentDark: string;
  /** The soft light round each word that parts it from a drawing behind. */
  halo: string;
}

/**
 * How solid the halo is. The stage's ground is the window's own light
 * surface, so over it the halo cannot be seen; over the background scene's
 * lines it opens a narrow light gap round each word, which is what lets the
 * words lead without a plate or an outline.
 */
const HALO_ALPHA = 0.72;

/**
 * Euphoria's travelling colour on the sung part, lifted in OKLab lightness:
 * up on a dark window as before, down on a white one, where the palette is
 * already held at 3:1 (`stopOnWhite`) and a lift would take it under.
 */
export const EUPHORIA_LIFT_ON_WHITE = -0.06;

const channelsOf = (colour: string, fallback: TRgb): TRgb => {
  const parsed = parseCssColour(colour);
  if (!parsed) {
    return fallback;
  }
  const [red, green, blue] = parsed.rgb.map((channel) =>
    Math.round(channel * 255),
  );
  return [red, green, blue];
};

/** Read once a frame; every value is cached by the theme until it changes. */
export const readLightLyricInk = (): ILightLyricInk => ({
  lead: channelsOf(readSurface('--text-primary', '#1b1b1b'), [27, 27, 27]),
  around: channelsOf(readSurface('--text-muted', '#484848'), [72, 72, 72]),
  accent: readAccent(1, '#00777d'),
  accentDark: readSurface('--accent-dark', '#005e63'),
  halo: readSurfaceAlpha(
    '--surface-panel',
    HALO_ALPHA,
    `rgba(255, 255, 255, ${HALO_ALPHA})`,
  ),
});

/** The halo's stroke width: half of it stands outside the glyph. */
export const lightLyricHaloWidth = (focusAmount: number) => 2 + 3 * focusAmount;

interface ILyricFragmentState {
  isSection: boolean;
  /** 1 on the line being sung, falling to 0 a line away. */
  focusAmount: number;
  isCaptureStarted: boolean;
  /** A finished capture line, outside Euphoria. */
  isCaptureComplete: boolean;
}

/** A word's solid colour on a light window. */
export const lightLyricFill = (
  ink: ILightLyricInk,
  {
    isSection,
    focusAmount,
    isCaptureStarted,
    isCaptureComplete,
  }: ILyricFragmentState,
): string => {
  if (isSection || isCaptureStarted) {
    return ink.accent;
  }
  if (isCaptureComplete) {
    return ink.accentDark;
  }
  const [red, green, blue] = ink.around.map((channel, index) =>
    Math.round(channel + (ink.lead[index] - channel) * focusAmount),
  );
  return `rgb(${red}, ${green}, ${blue})`;
};
