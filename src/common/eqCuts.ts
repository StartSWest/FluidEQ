/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FilterTypeEnum, IEqCuts, IFilter } from './constants';

/**
 * The two cuts at the edges of the whole EQ, below 20 Hz and above 20 kHz:
 * the range of hearing.
 *
 * Asked for beside the Treble choice (Ivan, 2026-09-22: "can precise has like
 * a 20k cut similar to classic? but keeping the precise all other bands
 * thing", and "some cut on the bass too, on 10hz or so"). Classic takes a
 * treble boost down toward the top, but it starts early: on his own EQ it was
 * already 1.5 dB short at 8 kHz. The high cut takes off only the top and
 * leaves every band below it as Precise draws it. The low cut takes out
 * rumble at the bottom of hearing, which a bass boost would otherwise lift
 * along with everything else. It was at 10 Hz first, which was then a whole
 * octave below the graph's left edge, where the curve could not show it
 * (Ivan, 2026-09-23: "not seeing the low cut in the grahp"); at 20 Hz it
 * mirrors the high cut. The plot has since been opened down to 10 Hz
 * (`GRAPH_START`), so the cut's own slope is drawn — which is what that
 * request was really after, and the reason the corner stays at 20 Hz is now
 * the mirror alone.
 *
 * Each has a dial on the Tone panel, either side of Bass, Mid and Treble, for
 * how steep it is, the way a pro DSP's cuts are set (Ivan, 2026-09-23: "add a
 * nob to for how much narrow the cut is", "if 0 no cut", "pro cuts like a pro
 * DSP"): 0 is no cut at all, and 12 or 24 dB per octave a Butterworth cut of
 * that order, 3 dB down at its corner whatever the slope. Steeper keeps more
 * of the band beside the corner: at 25 Hz the low cut is 1.5 dB down at 12 dB
 * per octave and 0.7 dB at 24; at 48 kHz the high cut is 0.7 dB down at
 * 18 kHz at 12 dB per octave and 0.1 dB at 24, where it is 11 dB down by
 * 21 kHz. 36 and 48 were offered as well until Ivan found the steepest "too
 * aggressive" (2026-09-23): 16 dB down at 16 Hz, and a section of Q 2.56
 * ringing at the corner.
 *
 * Every section is from the cookbook, not matched, on purpose: at 44.1 and
 * 48 kHz the bilinear squeeze is what keeps the high cut near the top, where
 * the analog shape would already be down at 16 kHz. At 96 kHz and above the
 * two are the same.
 *
 * Written into every output's chain as plain `Filter:` lines in a file of
 * their own (`EQ_CUTS_FILENAME`), which Equalizer APO and every FluidEQ
 * Engine already play as written: the file names no layer, so the engine
 * builds them on the cookbook. They are left out of the preamp: they only take
 * away, so the level the chain is sized for stays safe, and Auto normalize
 * starts where it did without them.
 */

export type TEqCut = keyof IEqCuts;

export const EQ_CUTS: readonly TEqCut[] = ['low', 'high'];

/**
 * Every slope a cut can have, in dB per octave: off, then the even orders of
 * a Butterworth, the only ones a chain of biquads builds whole, to the
 * fourth.
 */
export const EQ_CUT_SLOPES = [0, 12, 24] as const;

export const DEFAULT_EQ_CUTS: IEqCuts = { low: 0, high: 0 };

/** The −3 dB point of each cut. */
export const EQ_CUT_FREQUENCIES: Readonly<Record<TEqCut, number>> = {
  low: 20,
  high: 20000,
};

/**
 * Included by every output's device file while either cut is on, and swept
 * with the other generated files once neither is.
 */
export const EQ_CUTS_FILENAME = 'fluideq-cuts.txt';

export const isEqCut = (value: unknown): value is TEqCut =>
  value === 'low' || value === 'high';

export const isEqCutSlope = (value: unknown): value is number =>
  EQ_CUT_SLOPES.some((slope) => slope === value);

export const hasEqCut = (cuts: IEqCuts | undefined): boolean =>
  cuts !== undefined && (cuts.low > 0 || cuts.high > 0);

/**
 * Stored cuts as the dials can set them, or undefined while neither is on.
 *
 * A slope the dials do not offer reads as the steepest they do below it, so a
 * state saved while 36 and 48 were offered loads with its cut still on, at 24,
 * and anything that is not a number reads as no cut.
 */
export const toEqCuts = (value: unknown): IEqCuts | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const slopeOf = (raw: unknown) =>
    EQ_CUT_SLOPES.reduce<number>(
      (kept, slope) => (typeof raw === 'number' && slope <= raw ? slope : kept),
      0,
    );
  const cuts = {
    low: slopeOf('low' in value ? value.low : undefined),
    high: slopeOf('high' in value ? value.high : undefined),
  };
  return hasEqCut(cuts) ? cuts : undefined;
};

/**
 * The Qs of a Butterworth of `order`, one per biquad: 1 / (2 cos θ) at each
 * pole angle θ = (2k − 1)π / 2n. Four places, as the file carries them.
 */
const butterworthQs = (order: number): number[] =>
  Array.from(
    { length: order / 2 },
    (_unused, index) =>
      Math.round(
        (1 / (2 * Math.cos(((2 * index + 1) * Math.PI) / (2 * order)))) *
          10_000,
      ) / 10_000,
  );

/** The sections the cuts that are on are built from, low cut first. */
export const eqCutFilters = (cuts: IEqCuts | undefined): IFilter[] =>
  EQ_CUTS.filter((cut) => (cuts?.[cut] ?? 0) > 0).flatMap((cut) =>
    butterworthQs((cuts?.[cut] ?? 0) / 6).map((quality, section) => ({
      id: `eq-cut-${cut}-${section}`,
      type: cut === 'low' ? FilterTypeEnum.HPQ : FilterTypeEnum.LPQ,
      frequency: EQ_CUT_FREQUENCIES[cut],
      gain: 0,
      quality,
    })),
  );

/**
 * `EQ_CUTS_FILENAME` as written, in the grammar of the app's own layer
 * files. Pass and cut filters take no `Gain` in Equalizer APO's grammar.
 */
export const eqCutsFileText = (cuts: IEqCuts): string =>
  [
    '# Cuts: FluidEQ writes this file for every output. Changes are overwritten.',
    ...eqCutFilters(cuts).map(
      ({ type, frequency, quality }, index) =>
        `Filter ${index + 1}: ON ${type} Fc ${frequency} Hz Q ${quality}`,
    ),
  ].join('\r\n');
