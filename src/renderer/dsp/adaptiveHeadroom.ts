/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How much of the reserved headroom this particular song does not need.
 *
 * The regulator reserves the curve's whole peak, which is right and pessimistic:
 * a bass-boost preset gives away six decibels whether or not the record has
 * anything at 60 Hz to boost. On a song with no sub-bass that six is spent on
 * nothing, and the result is a rack that is correct and quiet.
 *
 * The quantity that fixes it is not the programme's absolute level — a spectral
 * cell is not a sample peak, and the crest factor between them varies by more
 * than the headroom being recovered, so an absolute reading cannot be trusted.
 * It is a DIFFERENCE of two spectra, the EXCESS:
 *
 *     excess = max(programme + chain) - max(programme)
 *
 * Both terms carry the same unknown reference, so the reference cancels and the
 * analyser's calibration cannot affect the answer. And because
 * `max(a + b) <= max(a) + max(b)`, the excess can never exceed the chain's own
 * peak — so what this gives back is bounded between nothing and the whole
 * reserve, and a measurement that is completely wrong degrades to the
 * pessimistic behaviour rather than to distortion.
 */

/**
 * Rise slowly, fall at once.
 *
 * These are not symmetric because the two directions are not equally safe.
 * Giving headroom back makes the output louder, so it is done gradually and
 * only once the material has been that way for a while. Taking it back is what
 * stands between a chorus and a clipped chorus, so it happens on the reading
 * that noticed.
 */
const RISE_PER_STEP_DB = 0.15;

export interface IAdaptiveHeadroomState {
  /** Headroom handed back, in dB. Zero is the pessimistic reserve, untouched. */
  giveBack: number;
}

export const createAdaptiveHeadroom = (): IAdaptiveHeadroomState => ({
  giveBack: 0,
});

/**
 * The excess, in dB, for one spectrum against one chain response.
 *
 * Never negative. A chain that CUTS where the programme peaks has a negative
 * excess — it makes the record quieter — and acting on that would mean handing
 * back more than was ever reserved, which is an EQ that turns itself up.
 */
export const excessDb = (
  programmeDb: ArrayLike<number>,
  chainDb: ArrayLike<number>,
): number => {
  let loudest = -Infinity;
  let loudestAfter = -Infinity;
  const bins = Math.min(programmeDb.length, chainDb.length);
  for (let bin = 0; bin < bins; bin += 1) {
    const level = programmeDb[bin];
    // The analyser reports -Infinity for an empty bin, and NaN before the first
    // block has been through it. Either one poisons a maximum.
    if (Number.isFinite(level)) {
      if (level > loudest) {
        loudest = level;
      }
      const after = level + chainDb[bin];
      if (after > loudestAfter) {
        loudestAfter = after;
      }
    }
  }
  if (!Number.isFinite(loudest) || !Number.isFinite(loudestAfter)) {
    return 0;
  }
  return Math.max(0, loudestAfter - loudest);
};

/**
 * Move the give-back toward what this measurement says, and answer where it is.
 *
 * `reserveDb` is what the regulator took: the ceiling on what can be handed
 * back, and by construction the excess never exceeds it. `clipping` is the
 * supervisor — the output was measured past full scale, which outranks every
 * spectral argument, so the whole give-back goes at once.
 */
export const advanceHeadroom = (
  state: IAdaptiveHeadroomState,
  reserveDb: number,
  excess: number,
  clipping: boolean,
): number => {
  if (clipping) {
    state.giveBack = 0;
    return 0;
  }
  const target = Math.max(0, Math.min(reserveDb, reserveDb - excess));
  state.giveBack =
    target < state.giveBack
      ? target
      : Math.min(target, state.giveBack + RISE_PER_STEP_DB);
  return state.giveBack;
};
