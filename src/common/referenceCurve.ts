/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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
 * What a correction is measured against, and how much of a record it overrides.
 *
 * WHAT THE MEASUREMENT ACTUALLY IS, because everything here depends on it. The
 * analyser is a Windows loopback: it taps the signal on its way to the endpoint.
 * It is not a microphone. It cannot hear headphones, it cannot hear a room, and
 * no amount of listening will tell it anything about either. What it sees is the
 * programme plus whatever FluidEQ has already applied.
 *
 * So none of these modes corrects anybody's gear — that is what the AutoEQ
 * database and the driver profiles are for, and they work from published
 * measurements rather than from this. What these correct is the RECORD.
 *
 * Three of them, differing only in how much of a record they are willing to
 * override:
 *
 *   detail  — the reference is a line fitted to this record. Its own tonal
 *             signature is correct by definition, and only bumps and dips
 *             relative to it are corrected. Leaves a dull record dull.
 *   balance — the reference is a line at a FIXED slope. A dull record is
 *             brightened and a boomy one tightened, and each stays where it
 *             lands, but nothing imposes a shape: all the record's own detail
 *             survives.
 *   target  — the reference is a whole curve. Every record is brought to the
 *             same tonal balance.
 *
 * The level is always fitted, in all three. An absolute level means nothing
 * here — loopback carries whatever the volume knob is set to — and the solver
 * centres its answer anyway, so fitting it is free and assuming it is wrong.
 */

export type TReferenceMode = 'detail' | 'balance' | 'target';

/**
 * A point on a reference curve.
 *
 * Structurally the same as the analyser's `ISpectrumSample` and declared here
 * rather than imported from it, because that one lives in `renderer/` and this
 * file is `common/`: a curve is a statement about music, not about a capture,
 * and it has no business depending on the thing that measures.
 */
export interface IReferencePoint {
  frequency: number;
  level: number;
}

/**
 * The slope a record is expected to arrive at, in dB per decade.
 *
 * Music is not spectrally flat and a correction aiming at flat would be asking
 * for something like twenty decibels of treble lift — thin and shrill, the
 * opposite of what anybody wants. Real programme falls away toward the top, and
 * this is roughly where.
 *
 * Taken from this project's own model of typical music rather than invented:
 * the capture tests describe pink-ish full-band material as falling eight
 * decibels per decade, and pink noise on a per-bin axis is ten. Eight sits
 * between "as recorded" and "as pink", which is about where mastered music
 * lives.
 *
 * THE NUMBER MOST LIKELY TO WANT TUNING BY EAR. Everything else here is
 * structure; this is a judgement about what music should sound like, and it is
 * one decibel per decade away from being noticeably different.
 */
export const REFERENCE_SLOPE_DB_PER_DECADE = -8;

/**
 * How the target departs from that line, in dB.
 *
 * DEPARTURES FROM THE SLOPED LINE, NOT FROM FLAT — and getting that wrong is
 * exactly what the first version of this did. It carried a bass shelf, +3 dB at
 * 35 Hz, on the reasoning that every target curve has one. Every target curve
 * has one *relative to flat*; this one is added to a line that already rises
 * eight decibels per decade toward the bottom, which is nearly twelve decibels
 * of lift at 40 Hz before the shelf is even applied.
 *
 * So the bass was counted twice, and the symptom was precise: on material with
 * perfectly good low end, Target kept reporting that it was lifting the deep
 * bass. It was — into a region where records genuinely have little, because the
 * reference was asking for more than any master delivers. What it bought was
 * rumble and lost headroom.
 *
 * The bottom is now pulled back rather than pushed. Below about 60 Hz the line
 * over-promises for real music, which mostly rolls away down there on purpose,
 * and it is also where a loopback measurement is least worth believing.
 *
 * What is left says two things:
 *
 *   a little presence, which is the "sharp" everybody means when they say a mix
 *   sounds dull, and which sits where the ear is most sensitive;
 *
 *   a little off the very top, where the measurement is mostly codec hash and
 *   lifting it lifts the hash.
 *
 * The punch comes from the slope, which already puts real weight under a record
 * without any help from here.
 *
 * Between the points the solver interpolates, so these describe a smooth curve
 * rather than a set of steps.
 */
export const REFERENCE_SHAPE: IReferencePoint[] = [
  { frequency: 35, level: -3 },
  { frequency: 60, level: -1 },
  { frequency: 150, level: 0 },
  { frequency: 700, level: 0 },
  { frequency: 3000, level: 1.5 },
  { frequency: 8000, level: 0 },
  { frequency: 15000, level: -2 },
];

/** What a mode asks of the fit: a fixed slope, a shape, or neither. */
export interface IReferenceShape {
  /** Absent means fit the slope to the record, which is `detail`. */
  slope?: number;
  /** Departures from the line. Absent means the line itself is the target. */
  shape?: IReferencePoint[];
}

/**
 * Anything that is not one of the three asks for a fitted line.
 *
 * Which covers the one-shot measurement: pressing Smart EQ by hand is a
 * different act from choosing what records should sound like, and it keeps the
 * behaviour it always had.
 *
 * A VOICING REPLACES THE BUILT-IN SHAPE, and the reason it does so by being
 * *removed* rather than substituted is worth following, because the opposite
 * looks more obvious and is wrong.
 *
 * The voicing is already applied. It is in the chain, it is in the output, and
 * it is in the measurement — and the solve subtracts it, along with the bands
 * and the driver correction, before deciding anything. So what the correction
 * drives to the reference is the programme alone, and the voicing lands on top
 * of the result afterwards, in the chain, where it always was.
 *
 * Which means adding the built-in shape as well would apply two curves: the
 * voicing you chose and a target you did not, stacked. Leaving the shape out
 * makes the programme flat to the line and the voicing the only thing shaping
 * it — the output follows the voicing exactly, which is what picking one ought
 * to mean.
 *
 * So with a voicing, Target and Balance do the same thing. That is not a
 * degenerate case, it is the correct one: the difference between them is which
 * curve is imposed, and when you have named a curve there is nothing left to
 * choose.
 */
export const getReferenceShape = (
  mode: string,
  isVoicingActive = false,
): IReferenceShape => {
  if (mode === 'balance') {
    return { slope: REFERENCE_SLOPE_DB_PER_DECADE };
  }
  if (mode === 'target') {
    return {
      slope: REFERENCE_SLOPE_DB_PER_DECADE,
      ...(isVoicingActive ? {} : { shape: REFERENCE_SHAPE }),
    };
  }
  return {};
};
