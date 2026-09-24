/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FilterTypeEnum, IFilter } from './constants';

/**
 * Bass, Mid and Treble, the way an amplifier has them, as a layer of their own.
 *
 * A shelf at each end where Baxandall put them in 1952, and a broad bell at
 * 1 kHz between them (`TONE_SHAPES`): Bass is the bass, Treble is the top
 * octave and a half, and raising both leaves the middle alone.
 *
 * THREE FILTERS OF THEIR OWN, NEVER THE USER'S BANDS. The dials used to be
 * fitted into the bands by least squares over the whole rack, so turning
 * Treble rewrote a tuning somebody had made by hand, and the dials' positions
 * were kept on one machine beside it. Ivan asked for the tone as a curve of its
 * own that leaves his EQ alone (2026-09-23: "ghost the tone into a new eq curve
 * so it doent affect user e settings ... it jumps into EQ mode category"):
 * three filters written as their own layer (`fluideq-<slug>-tone.txt`), in Your
 * EQ's group of the EQ mode menu, saved with the profile like every other
 * layer. Bands that already carried a fitted tone when this landed keep it;
 * the dials start from zero.
 */
export interface ITone {
  /** dB at the bottom. */
  bass: number;
  /** dB through the middle. */
  mid: number;
  /** dB at the top. */
  treble: number;
}

export const FLAT_TONE: ITone = { bass: 0, mid: 0, treble: 0 };

/** Low to high, the order a tone stack is read in. */
export const TONE_KNOBS: readonly (keyof ITone)[] = ['bass', 'mid', 'treble'];

/**
 * How far each dial goes. Ivan's number, 2026-09-20, from when the tone was
 * fitted into bands and sixteen left four decibels of room under a band's
 * twenty. Filters of its own need no room; the dials keep the travel he set.
 */
export const TONE_MAX_DB = 16;

/**
 * Where the dials work, as a hi-fi amplifier's do (Ivan, 2026-09-23: "make
 * sure tone curves are professional ones").
 *
 * The shelves turn over at Baxandall's own 100 Hz and 10 kHz, and act from
 * about 300 Hz and 3.5 kHz outward, which is where a present-day amplifier's
 * specification puts its turnover. Measured at +6 on a dial: Bass gives 5.6 dB
 * at 50 Hz, 1.0 at 150 Hz and 0.1 at 300 Hz; Treble 0.4 dB at 5 kHz, 3.0 at
 * 10 kHz and 5.6 at 20 kHz. The Mid is a bell at 1 kHz as broad as a band's
 * 0.7, the width a three-band channel strip gives its middle.
 *
 * The first shapes were shelves at 250 Hz and 2.5 kHz with a Q of 0.5: Bass
 * put 3.7 dB into 200 Hz and Treble 4.8 into 5 kHz, which is warmth and
 * presence rather than bass and treble.
 *
 * BUTTERWORTH SHELVES, Q 0.707, because that is the shelf the FluidEQ Engine
 * builds analog-matched (`biquad_matched.cpp`, `playsAnalogMatched`): the
 * Tone is in Your EQ's group, so that group's Treble choice, Precise or
 * Classic, decides how all three dials play, and the graph draws whichever
 * plays. At 0.5 neither shelf could follow the choice, and only the Mid did.
 * Band Q reshapes the Mid alone; Studio and Double scale all three, as they
 * do a band.
 */
export const TONE_SHAPES: Readonly<
  Record<keyof ITone, Pick<IFilter, 'type' | 'frequency' | 'quality'>>
> = {
  bass: { type: FilterTypeEnum.LSC, frequency: 100, quality: Math.SQRT1_2 },
  mid: { type: FilterTypeEnum.PK, frequency: 1_000, quality: 0.7 },
  treble: {
    type: FilterTypeEnum.HSC,
    frequency: 10_000,
    quality: Math.SQRT1_2,
  },
};

/** One dial's value within its travel, to the tenth the dials step by. */
const dialValue = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.round(Math.min(TONE_MAX_DB, Math.max(-TONE_MAX_DB, value)) * 10) / 10
    : 0;

export const hasTone = (tone: ITone | undefined): boolean =>
  tone !== undefined && TONE_KNOBS.some((knob) => tone[knob] !== 0);

/**
 * Whether a value is a tone as the window sends one: three numbers, each one
 * finite. Anything else is refused rather than read as flat, which would
 * clear somebody's tone over a malformed message.
 */
export const isToneValues = (value: unknown): value is ITone =>
  typeof value === 'object' &&
  value !== null &&
  TONE_KNOBS.every(
    (knob) =>
      knob in value &&
      typeof (value as Record<string, unknown>)[knob] === 'number' &&
      Number.isFinite((value as Record<string, unknown>)[knob]),
  );

/**
 * A tone as stored or asked for, bounded to the dials' travel, or undefined
 * when all three are at zero: no tone is no layer, the way a flat EQ has no
 * chip. A field missing or not a number reads as that dial at zero.
 */
export const toTone = (value: unknown): ITone | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const tone: ITone = {
    bass: dialValue('bass' in value ? value.bass : undefined),
    mid: dialValue('mid' in value ? value.mid : undefined),
    treble: dialValue('treble' in value ? value.treble : undefined),
  };
  return hasTone(tone) ? tone : undefined;
};

/** The filters the layer is written as: one for each dial away from zero. */
export const getToneFilters = (
  tone: ITone | undefined,
): Array<Pick<IFilter, 'type' | 'frequency' | 'gain' | 'quality'>> => {
  const bounded = toTone(tone);
  if (!bounded) {
    return [];
  }
  return TONE_KNOBS.filter((knob) => bounded[knob] !== 0).map((knob) => ({
    ...TONE_SHAPES[knob],
    gain: bounded[knob],
  }));
};
