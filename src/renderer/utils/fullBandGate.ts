/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * IS THE WHOLE RECORD PLAYING RIGHT NOW — asked of the frame, not of a range.
 *
 * WHAT THIS FIXES. Records drop a whole end of the spectrum on purpose: the
 * five seconds before a chorus with no bass in them, a telephone-filtered verse,
 * an intro that opens under a low-pass and lifts when the track proper starts.
 * The presence lines already stop the MISSING range being boosted — a range
 * under its floor earns no correction and teaches nothing. What nothing stopped
 * was the damage those seconds do to every range that is STILL PLAYING.
 *
 * The accumulator measures each range against the frame's own mean power. Take
 * the bass out and that mean falls with it, so the mids and the treble read
 * several decibels hot against a reference that lost its loudest contributor —
 * and unlike the bass they are present, unglazed and accumulating at full
 * weight. Five seconds of a breakdown is a hundred frames all agreeing that the
 * top of the record is too loud, which is enough to move the estimate and, in a
 * continuous mode, to spend a correction on it. Then the bass comes back and it
 * all has to be walked out again. That is the "goes crazy on a drop" report, and
 * both halves of it — the wrong move and the walk back — come from frames that
 * should never have been counted at all.
 *
 * An intro is the same fault with worse timing, because it lands when the
 * session has no other evidence to dilute it: the first twenty seconds of a
 * filtered opening are taken for what the record is, and the moment the full
 * band arrives it reads as a change rather than as the truth.
 *
 * SO THE FRAME IS THE UNIT. A frame in which some range has fallen under its
 * floor is not a measurement of the record, it is a measurement of an effect,
 * and the honest thing to do with it is nothing at all: no evidence, no listened
 * time, no ageing of what was heard before it. The capture holds exactly where
 * it was and picks up when the record does.
 *
 * THREE LEVELS, NOT ONE, AND THE SPREAD BETWEEN THEM IS WHAT KEEPS IT SANE.
 *
 *   absent  — a range at or under its floor line. Starts a hold.
 *   present — every range back over its floor, held for a moment. Ends one.
 *   clear   — every range comfortably over it, held for a moment. Says this
 *             record HAS a full band, so a later absence means something.
 *
 * One threshold doing all three would either hold constantly on sparse material
 * or never fire at all. The middle level is deliberately the easy one: getting
 * going again asks less than stopping did, which is what stops an acoustic
 * record with gaps in it from spending its evening held.
 *
 * AND THE BUDGET IS WHAT MAKES IT SAFE ON MATERIAL THAT IS SIMPLY LIKE THAT.
 * A record with no air on it, a podcast, a mono transfer — nothing is coming
 * back, and a gate with no way out would wait for it forever and the mode would
 * appear dead. So a hold expires: after `FULL_BAND_HOLD_MS` the absence is taken
 * as what this record IS, the gate disarms, and the capture goes back to
 * behaving exactly as it did before any of this existed. It re-arms only when
 * the full band is seen clear again, so nothing flaps between the two.
 *
 * The gate reads the presence allowances, which is the same rule drawn on the
 * graph in red and green and the same rule that decides what a range may be
 * given. Deriving a second, private idea of "playing" would put a number in the
 * maths that contradicts the picture — and somebody dragging a line would move
 * one without the other.
 */

/** At or under its floor line: the range is not playing. */
const FULL_BAND_ABSENT = 0;

/**
 * Comfortably over the floor, on the ramp between the two lines.
 *
 * At its own typical level a range sits around seven tenths of the way up that
 * ramp, and ordinary musical variation walks it down to about a third. So a
 * third is the line between "quiet in this bar" and "as loud as this record
 * gets here" — high enough that a record which merely grazes its floor never
 * claims a full band, low enough that a real one claims it within a second of
 * the music starting.
 */
const FULL_BAND_CLEAR = 0.35;

/**
 * How long a condition must hold before it is believed, in ms.
 *
 * A filter sweeping back in crosses the floor long before the range is really
 * back, and learning from the sweep is learning from the effect again — with
 * the added insult that the sweep is where the spectrum is most deformed. A
 * second is longer than any of those transitions and short enough that a
 * five-second drop costs six.
 */
const FULL_BAND_STEADY_MS = 1000;

/**
 * How long the capture will wait for the record to come back, in ms.
 *
 * Songs do this for a few seconds; intros for rather longer. Twenty covers both
 * with room, and what happens at the end of it is not a failure — it is the
 * conclusion that this is not an effect at all but the material, which is the
 * only conclusion available once the wait has been long enough.
 *
 * Counted in the same frame time everything else here is, so a hold does not
 * expire while the music is paused.
 */
const FULL_BAND_HOLD_MS = 20000;

export interface IFullBandState {
  /**
   * Whether an absence would mean anything.
   *
   * TRUE AT THE START, which is the whole of the intro fix: a capture that
   * begins under a low-pass has no idea yet what the record is, and the choice
   * is between assuming a full band and being wrong for twenty seconds, or
   * assuming a filtered one and taking the intro as the truth. Only the first
   * is recoverable, and it recovers by itself the moment the band arrives.
   */
  armed: boolean;
  isHolding: boolean;
  holdingMs: number;
  presentMs: number;
  clearMs: number;
}

export const createFullBandState = (): IFullBandState => ({
  armed: true,
  isHolding: false,
  holdingMs: 0,
  presentMs: 0,
  clearMs: 0,
});

/**
 * Advance the gate by one frame and say whether this one may be learned from.
 *
 * `gates` is one presence allowance per range, in the accumulator's own region
 * order. Absent means the caller has no presence information — every synthetic
 * frame, every test, the moment before the first real frame — and that reads as
 * a full band rather than as an empty one: a gate that fired on no evidence
 * would hold every capture that never supplies any.
 */
export const advanceFullBandGate = (
  state: IFullBandState,
  gates: ArrayLike<number> | undefined,
  dtMs: number,
): boolean => {
  let isAbsent = false;
  let isClear = true;
  for (let index = 0; index < (gates?.length ?? 0); index += 1) {
    const gate = (gates as ArrayLike<number>)[index];
    if (!(gate > FULL_BAND_ABSENT)) {
      isAbsent = true;
    }
    if (!(gate >= FULL_BAND_CLEAR)) {
      isClear = false;
    }
  }

  const dt = Number.isFinite(dtMs) ? Math.max(0, dtMs) : 0;
  state.clearMs = isClear ? state.clearMs + dt : 0;
  state.presentMs = isAbsent ? 0 : state.presentMs + dt;
  if (state.clearMs >= FULL_BAND_STEADY_MS) {
    state.armed = true;
  }

  if (state.isHolding) {
    state.holdingMs += dt;
    if (state.presentMs >= FULL_BAND_STEADY_MS) {
      state.isHolding = false;
      state.holdingMs = 0;
    } else if (state.holdingMs >= FULL_BAND_HOLD_MS) {
      // Long enough. Whatever is missing was never going to come back, so it is
      // not an effect — it is the record, and the measurement is better off
      // hearing it than waiting on it. See the budget note at the top.
      state.isHolding = false;
      state.holdingMs = 0;
      state.armed = false;
    }
  } else if (isAbsent && state.armed) {
    state.isHolding = true;
    state.holdingMs = dt;
  }

  return !state.isHolding;
};
