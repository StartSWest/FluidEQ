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
 * Rise slowly, fall quickly, and neither of them abruptly.
 *
 * The two directions are not equally safe, so they are not equally fast:
 * giving headroom back makes the output louder and is done only once the
 * material has been that way for a while, while taking it back is what stands
 * between a chorus and a clipped chorus.
 *
 * Neither is instant any more, and the recovery is deliberately glacial.
 * Reports arrive about twenty-three times a second, so the first version — 0.15
 * up and the whole way down — gave back three and a half decibels a second and
 * took them all in one reading, and on material hovering near the threshold the
 * level breathed in time with the music.
 *
 * At 0.008 up, a six-decibel reserve takes about half a minute to come back.
 * That is far slower than anything in the music, which is the point: a gain
 * that moves slower than the material it is riding is not heard as a gain
 * moving, it is heard as the track being the level it is. Falling stays quick
 * at 0.35 — under a second for the whole reserve — because that direction is
 * the one protecting a chorus.
 *
 * A measured clip still drops everything at once, and the margin above the
 * response is never handed back at all, so nothing here trades safety for
 * smoothness.
 */
const RISE_PER_STEP_DB = 0.008;
const FALL_PER_STEP_DB = 0.35;

/**
 * Below this, there is nothing to measure and measuring anyway is worse than
 * not measuring at all.
 *
 * An analyser fed silence does not report silence — it reports the floor, and
 * a floor is FLAT. A flat programme puts the excess at exactly the chain’s
 * own peak, which puts the target at zero, which drops the give-back; then
 * the slow climb starts, and the next reading drops it again. The result is a
 * sawtooth twenty-three times a second built entirely out of noise, and it is
 * what "it flashes even with no sound" was.
 *
 * -70 dBFS in the loudest bin. Real music at any listening level is far above
 * it and a paused track is far below.
 */
const PROGRAMME_FLOOR_DB = -70;

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
): number | null => {
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
  // Null rather than zero: "nothing playing" and "the chain adds nothing"
  // are opposite answers, and returning the second for the first is what
  // made silence hand back the whole reserve and then take it away again.
  if (
    !Number.isFinite(loudest) ||
    !Number.isFinite(loudestAfter) ||
    loudest < PROGRAMME_FLOOR_DB
  ) {
    return null;
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
  /** Null when there was nothing loud enough to measure. */
  excess: number | null,
  clipping: boolean,
): number => {
  if (clipping) {
    state.giveBack = 0;
    return 0;
  }
  // Held exactly where it was. A gap between tracks is not evidence about
  // the next one, and moving on no evidence is how a readout starts
  // flickering at a paused player.
  if (excess === null) {
    return state.giveBack;
  }
  const target = Math.max(0, Math.min(reserveDb, reserveDb - excess));
  state.giveBack =
    target < state.giveBack
      ? Math.max(target, state.giveBack - FALL_PER_STEP_DB)
      : Math.min(target, state.giveBack + RISE_PER_STEP_DB);
  return state.giveBack;
};
