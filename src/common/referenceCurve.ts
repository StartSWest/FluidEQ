/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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
 * Four of them, differing in how much of a record they are willing to override
 * and in how wide a corridor they will accept it inside:
 *
 *   (one-shot) — repair. The reference is a line fitted to this record, and the
 *             corridor is the widest of the four, so only what plainly stands
 *             out is touched. Runs once, on a press, and stops. Imposes nothing
 *             and is the only one that is not a way of listening.
 *   detail  — release detail. The reference is still the line fitted to this
 *             record, so the master's own tilt survives, with a rise through
 *             the mids and highs on top of it and the bass held where it is.
 *             The record stays itself and opens up.
 *   balance — even it out. The reference is a line at a FIXED slope. A dull
 *             record is brightened and a boomy one tightened, and each stays
 *             where it lands, but nothing imposes a shape: all the record's own
 *             character survives.
 *   target  — the house sound. The reference is a whole curve. Every record is
 *             brought to the same tonal balance, and this is the mode that
 *             makes two different masters arrive sounding like each other.
 *
 * The level is always fitted, in all four. An absolute level means nothing
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
 * It was eight, taken from this project's own capture tests, and eight was too
 * bright — which is a thing that can be measured rather than argued about.
 *
 * On a per-bin axis, which is what the analyser reads, pink noise falls ten
 * decibels per decade: three per octave. Analyser convention puts classic pop
 * at about that and modern productions nearer four and a half per octave, which
 * is fifteen. Eight per decade is 2.4 per octave — shallower than pink, so
 * brighter than any real record.
 *
 * Held to it, a perfectly good modern master measured as deficient everywhere
 * above a kilohertz and excessive below. Running the solver against a synthetic
 * one gave −3.3 dB at 50 Hz and +4.5 dB at 12.5 kHz: it thinned a record that
 * needed nothing, and the treble bands sat near their boost limit for as long
 * as it ran. That is the "only the air ever moves" complaint, and it was this
 * number rather than the caps or the anchor.
 *
 * Eleven sits between classic and modern, and leaves a good master alone.
 *
 * THE NUMBER MOST LIKELY TO WANT TUNING BY EAR. Everything else here is
 * structure; this is a judgement about what music should sound like, and it is
 * one decibel per decade away from being noticeably different.
 */
export const REFERENCE_SLOPE_DB_PER_DECADE = -11;

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

/**
 * Detail's own destination: clearer, without taking anything off the bottom.
 *
 * Detail keeps fitting the record's own tilt, so whatever the master intended
 * survives — this rides on top of that line rather than replacing it. Which is
 * what separates it from Balance and Target, both of which say the record's
 * tilt is wrong and impose their own.
 *
 * Until now it had no shape at all, and `getReferenceShape` returns the bare
 * fitted line for anything it does not recognise — so Detail and the one-shot
 * aimed at precisely the same destination and differed only in how often they
 * ran. Two modes, one behaviour, and no way to tell from the outside.
 *
 * The bass sits at zero rather than being cut to fund the lift. It is anchored
 * there too (see `anchor`), because the solver otherwise pays for a rise in the
 * mids by lowering everything else, which is the one thing this mode must not
 * do.
 */
export const DETAIL_SHAPE: IReferencePoint[] = [
  { frequency: 20, level: 0 },
  { frequency: 150, level: 0 },
  { frequency: 400, level: 0.5 },
  { frequency: 1000, level: 1.5 },
  { frequency: 3000, level: 2.5 },
  { frequency: 8000, level: 2.5 },
  { frequency: 15000, level: 1.5 },
];

/** What a mode asks of the fit: a fixed slope, a shape, or neither. */
export interface IReferenceShape {
  /** Absent means fit the slope to the record, which is `detail`. */
  slope?: number;
  /** Departures from the line. Absent means the line itself is the target. */
  shape?: IReferencePoint[];
  /**
   * What the correction is centred on, so it changes tone and not volume.
   *
   * `loudness` weights by audibility and is what every mode but Detail wants:
   * lift one region and the others come down to pay for it, so the level holds
   * still and adjusting any frequency is compensated by the rest.
   *
   * `bass` centres on the bottom instead, which pins it at zero and lets the
   * lift go upward from there. Louder overall, and the reason that is now
   * affordable is that headroom stopped being this layer's problem: the preamp
   * reserves the chain's true peak, so with auto-normalise on it cannot clip
   * whatever is asked for here.
   */
  anchor?: 'loudness' | 'bass';
}

/**
 * Anything that is not one of the three asks for a fitted line.
 *
 * Which covers the one-shot measurement: pressing Smart EQ by hand is a
 * different act from choosing what records should sound like, and it keeps the
 * behaviour it always had.
 *
 * THE MODE IS THE ONLY INPUT, and it used to take a second one — whether a
 * voicing was active — which is the more obvious design and was wrong.
 *
 * Under it, choosing a voicing made Target drop the built-in shape and return a
 * bare line, on the argument that the output already carries the voicing and
 * adding a second target curve would stack two of them. The argument is not
 * baseless: it does stack. It is just a bad trade, for three reasons that only
 * became clear once people used it.
 *
 * The shape is ±3 dB. It is a statement about what a well-made record's spectrum
 * looks like, not a flavour, and stacking a mild reference under a flavour is
 * exactly what every other layer here already does.
 *
 * It made an unrelated control change what the correction was aiming at, with
 * nothing on screen saying so. Picking Games and watching the Smart EQ curve sit
 * perfectly still is not a thing anybody can reason about from the outside.
 *
 * And it collapsed two of the three modes into one: with a voicing on, Target
 * and Balance did the same thing, so the choice between them quietly stopped
 * meaning anything at the exact moment somebody had expressed a preference.
 *
 * So the rule is now one sentence. Smart EQ measures the record with the chain
 * subtracted and puts it on the curve the mode names, always. Every other layer
 * — the voicing, the genre, the driver correction, the user's own bands — sits
 * on top of that result, which is where they were applied and where they belong.
 *
 * The modes keep their ladder, and now keep it in all circumstances: `detail`
 * fits the record's own tilt and removes only what stands out from it, `balance`
 * imposes the standard tilt, `target` imposes the tilt and this shape.
 */
export const getReferenceShape = (mode: string): IReferenceShape => {
  if (mode === 'detail') {
    return { shape: DETAIL_SHAPE, anchor: 'bass' };
  }
  if (mode === 'balance') {
    return { slope: REFERENCE_SLOPE_DB_PER_DECADE };
  }
  if (mode === 'target') {
    return { slope: REFERENCE_SLOPE_DB_PER_DECADE, shape: REFERENCE_SHAPE };
  }
  return {};
};
