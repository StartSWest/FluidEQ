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

import { SMART_EQ_MAX_FREQUENCY, SMART_EQ_MIN_FREQUENCY } from 'common/smartEq';
import { MAX_GAIN } from 'common/constants';

/**
 * Every number auto balance was tuned to, and why each one is that number.
 *
 * Three hundred lines of constants sat above the first line of logic in
 * autoBalance.ts, so reading the algorithm meant scrolling past the calibration
 * and reading the calibration meant knowing which function would eventually use
 * it. They are neither, and now they are neither in their own file.
 *
 * The comments matter more than the values here. A threshold with a number and
 * no reason is a number somebody will "clean up" — these say what was measured,
 * on what, and what goes wrong on each side of it.
 */
/**
 * Auto balance: measure what is actually reaching the speakers, then flatten
 * the peaks and dips while leaving the music's own spectral tilt alone.
 *
 * Everything in this file is pure — plain numbers and typed arrays, no Web
 * Audio, no wall clock. The hook owns the audio plumbing and feeds frames in;
 * every decision about whether we have heard enough is made here, so it can be
 * driven by synthetic frames in a test.
 */

/* -------------------------------------------------------------------------
 * Correctable range
 * ---------------------------------------------------------------------- */

/**
 * Frequencies outside this band are left alone. Below it the capture is
 * dominated by the room and by content that simply is not there; above it the
 * measurement is mostly dither and codec noise. Correcting either produces
 * confident-looking nonsense.
 *
 * Owned by the Smart EQ layer rather than declared here, because the layer's
 * band centres are cropped to exactly this range: two copies of the number
 * would drift apart and leave the layer with bands the measurement refuses to
 * trust.
 */
export const BALANCE_MIN_FREQUENCY = SMART_EQ_MIN_FREQUENCY;
export const BALANCE_MAX_FREQUENCY = SMART_EQ_MAX_FREQUENCY;

/**
 * Nine roughly-octave regions spanning exactly the correctable band, so
 * coverage and the range we are willing to correct agree by construction.
 * Coverage is tracked per region rather than per point because "have we heard
 * the treble yet" is a question about a region, and because a label per region
 * is what lets the UI say *why* it is still listening.
 */
export const BALANCE_REGION_EDGES = [
  35, 70, 140, 280, 560, 1120, 2240, 4480, 8960, 15000,
];

export const BALANCE_REGION_LABELS = [
  'deep bass',
  'bass',
  'low mids',
  'mids',
  'upper mids',
  'presence',
  'treble',
  'high treble',
  'air',
];

/* -------------------------------------------------------------------------
 * Frame acceptance
 * ---------------------------------------------------------------------- */

/** Nominal spacing between analyser frames, used to bound a stalled tick. */
export const BALANCE_FRAME_INTERVAL_MS = 45;

/**
 * Frame peak below which a frame contributes nothing, and the peak at which it
 * counts fully. Fade-outs, reverb tails and room tone have spectra nothing like
 * the program, and admitting them is the direct cause of "six seconds of a
 * quiet intro produced a confident, wrong correction". The 25 dB ramp keeps the
 * weighting continuous so material hovering near the gate does not make the
 * estimate jump between two populations.
 */
export const FRAME_MIN_PEAK_DBFS = -60;
export const FRAME_FULL_PEAK_DBFS = -35;

/**
 * A region sitting this low is on the analyser's own -100 dB clamp. Averaging
 * clamped values manufactures a flat noise shelf that reads as a real treble
 * deficit, so those regions are skipped rather than measured.
 */
export const ABS_FLOOR_DBFS = -85;

/**
 * A region more than this far below the frame peak carries no information.
 * Music's own tilt already spans ~25 dB across the band, so a tighter gate
 * would falsely reject the air of acoustic material. The ramp avoids a hard
 * threshold, which would make a marginal region accumulate in bursts and
 * contaminate its own variance estimate with the gating.
 */
export const REGION_FLOOR_DB = 45;
export const REGION_FLOOR_RAMP_DB = 10;

/* -------------------------------------------------------------------------
 * Presence: is this range playing at all
 * ---------------------------------------------------------------------- */

/**
 * The plot's own top, which is where a record's recent peak is drawn.
 *
 * The presence lines are set by eye against the live trace, so the level the
 * detector compares to them has to be expressed the way the trace is: relative
 * to the track's recent peak, with that peak at the top of the plot. Anything
 * else and the line means one thing on screen and another in the maths.
 */
export const PRESENCE_FULL_SCALE_DB = MAX_GAIN;

/** Release of the peak follower, in dB per second. Matches the plot's. */
export const PRESENCE_RELEASE_DB_PER_S = 1;

/** Below this a range is silent rather than quiet, and starts there. */
export const PRESENCE_SILENT_DB = -200;

/**
 * Meter ballistics for a range's own level: instant attack, measured release.
 *
 * IT WAS A SYMMETRIC ONE-POLE AND THAT BIASED THE WHOLE DETECTOR AGAINST THE
 * TOP OF THE SPECTRUM, which is a real defect rather than a nicety, and the
 * amount is measurable. At a quarter per frame on a thirty-three millisecond
 * tick the time constant is 132 ms, the same for all nine ranges — and what a
 * range does in 132 ms depends entirely on which range it is:
 *
 *   cymbal edge      30 ms   reaches  5.0 dB of a 20 dB event  (15.0 short)
 *   snare body       80 ms            8.8                      (11.3 short)
 *   vocal consonant 120 ms           13.7                       (6.3 short)
 *   bass note       400 ms           19.4                       (0.6 short)
 *   sustained pad  1500 ms           20.0                       (none)
 *
 * Short events are disproportionately treble and long ones disproportionately
 * bass, so the smoother was reading the top of the spectrum up to fifteen
 * decibels below what it actually does. Under-read means under its floor, which
 * means gated, which means never boosted — the "still waiting on presence" that
 * never resolved was this, not a shortage of music.
 *
 * Instant attack fixes it without a per-band constant, because what limits the
 * attack is the frame rate rather than the frequency: a transient is caught at
 * its real height whether it is a kick or a hi-hat. The release then decides
 * how long a range goes on counting as present, which is the question that was
 * being asked all along.
 *
 * Twelve decibels a second is about a decibel per frame — long enough to ride
 * the gap between drum hits, short enough that an instrument actually leaving
 * is obvious within a second.
 */
export const PRESENCE_LEVEL_RELEASE_DB_PER_S = 12;

/**
 * How much overall tilt a correction may impose, end to end, in dB.
 *
 * Three, against a per-band limit of six that permits twelve. The distinction
 * is between flattening a defect and rewriting a record: a narrow resonance is
 * wrong on any material and should be taken out in full, while a tilt is only
 * "wrong" relative to a slope somebody chose, and the material furthest from
 * that choice takes the largest imposition through no fault of its own.
 *
 * There is no slope that avoids this. Measured across three plausible masters —
 * a modern one, an older brighter one and a dark one — every candidate value
 * left at least one of them seven to twelve decibels out. Choosing better is
 * not available; bounding what the choice may cost is.
 *
 * Three decibels moves a record audibly toward the house curve without any
 * record ever arriving somewhere it was never near, which is the behaviour that
 * holds for material nobody has heard yet.
 */
export const MAX_TILT_SPAN_DB = 3;

/**
 * How far under the reference an edge run must sit to count as rolloff, in dB.
 *
 * Generous on purpose. A record that is merely light at the bottom — six or
 * eight decibels under the line — is still corrected; only the cliff where the
 * material genuinely ends is left alone. Ten is comfortably past anything a
 * tonal balance justifies filling and comfortably short of the twenty-plus a
 * real rolloff measures.
 */
export const EDGE_ROLLOFF_DB = 10;

/**
 * How steeply a candidate run must fall toward the edge to be believed, in dB
 * per octave. Real rolloffs measure twenty and up; the darkest master falls at
 * seven. Twelve sits between with room on both sides.
 */
export const ROLLOFF_MIN_DB_PER_OCTAVE = 12;

/**
 * How fast a range's TYPICAL level follows the music, in dB per second.
 *
 * This is what lets the presence lines place themselves. It was a tenth of a
 * decibel a second, on the argument that a follower chasing the live level
 * would sink to meet a range that had gone quiet, declare it present again, and
 * undo the whole protection.
 *
 * THAT ARGUMENT WAS REDUNDANT, and believing it cost something real: a record
 * whose lines needed to travel took eighty seconds to get there, so most of a
 * song played under a threshold that was still wrong. A poor price for a
 * guarantee that was already being made somewhere else.
 *
 * The BOUND is what protects, not the rate. The automatic placement may leave
 * the tilt model by eight decibels and no further — see
 * `PRESENCE_AUTO_TRAVEL_DB` — so however fast this moves, the floor cannot
 * reach a range that is genuinely absent: absent is twenty or thirty decibels
 * down and eight will not span that. A passage with no bass guitar pulls the
 * floor through its whole allowance in a couple of seconds and the bass is
 * still far beneath it, still gated, exactly as before.
 *
 * Four decibels a second was the first answer and it was too fast in the other
 * direction: at that rate the line follows the music bar by bar, so it is
 * visibly moving the whole time and reads as something wrong rather than as a
 * threshold. One decibel a second crosses the full travel in eight -- quick
 * enough that a record is settled long before its first chorus, slow enough
 * that the line looks like a setting rather than a meter.
 *
 * Symmetric, because the bound makes both directions safe, and an asymmetric
 * follower would let the loudest bar of a record set the level and hold it.
 */
export const PRESENCE_TYPICAL_DB_PER_S = 1;

/**
 * Power averaging is outlier-sensitive by design; this bounds what a single
 * leaked full-scale bin can do to a point.
 */
export const LEVEL_CLAMP_LO = -80;
export const LEVEL_CLAMP_HI = 30;

/* -------------------------------------------------------------------------
 * Coverage and stopping
 * ---------------------------------------------------------------------- */

/** Weighted fully-excited frames a region needs for full evidence (~2 s). */
export const REGION_TARGET_WEIGHT = 44;

/**
 * Standard error at which a region is precise enough. The correction is scaled
 * by `strength`, so 1.5 dB of level error is ~1 dB of gain error — about the
 * just-noticeable difference for a broad band. Tightening it multiplies
 * listening time for an inaudible gain.
 */
export const REGION_SE_TARGET_DB = 1.5;

/**
 * Effective-sample-size factor. Analyser frames are not independent: the
 * analyser smooths with a 0.62 time constant and we hop 45 ms into an ~85 ms
 * window, giving a lag-1 correlation around 0.75. Deliberately pessimistic —
 * underestimating the correlation is what makes a capture stop early on data
 * that only looks settled.
 */
export const EFFECTIVE_FRAME_RATIO = 0.15;

/** Confidence at which a region counts as heard. */
export const REGION_COVERED_CONFIDENCE = 0.9;

/**
 * Weight below which a region is not being fed at all, rather than being fed
 * slowly.
 *
 * Only the readout uses it, and only under the continuous modes, where evidence
 * decays on a half-life: a region the music has stopped reaching loses weight
 * steadily, so a low weight really does mean "nothing is arriving here lately"
 * rather than "this only just started".
 *
 * The distinction matters because a range with no content never covers and never
 * will. Naming it as something the measurement still needs is true and useless —
 * it is what left "Listening 0% - needs air" on screen for an entire evening
 * while every other range filled, was corrected, and filled again. About a third
 * of a second of fully-excited frames, which anything actually present clears
 * immediately.
 */
export const REGION_ACTIVE_WEIGHT = REGION_TARGET_WEIGHT * 0.15;

/** Floor no convergence test can bypass, and the hard ceiling. Both measure
 * *listened* time, so silence never counts against the user. */
export const MIN_LISTEN_MS = 4000;
export const MAX_LISTEN_MS = 25000;

/** One convergence checkpoint per second of listened time. */
export const CONVERGENCE_CHECK_MS = 1000;

/**
 * Maximum drift of the smoothed, tilt-removed residual between checkpoints.
 * 0.4 dB moves a band by about 0.26 dB after `strength` — below audibility. If
 * another second of listening cannot move a band further than that, more
 * listening is pointless.
 */
export const CONVERGENCE_TOLERANCE_DB = 0.4;
export const CONVERGENCE_HOLDS = 3;

/**
 * How long BOTH the weakest region and the mean must fail to improve before we
 * accept the source is genuinely band-limited. Requiring both matters: during a
 * quiet intro the weakest region sits still while everything else fills in, and
 * a single-signal rule would reproduce exactly the fixed-timer bug.
 */
export const STALL_GRACE_MS = 8000;
export const STALL_IMPROVEMENT = 0.02;

/* -------------------------------------------------------------------------
 * Correction limits
 * ---------------------------------------------------------------------- */

/** Below this confidence a band holds its current gain instead of guessing. */
export const MIN_BAND_CONFIDENCE = 0.4;

/**
 * The tilt fit needs leverage. Below a four-octave trusted span straddling the
 * midrange, a sloped program and a broad resonance are not separable — the fit
 * absorbs the resonance and every band inherits a fabricated slope.
 */
/**
 * Ridge weight for the joint gain solve, as a fraction of the mean diagonal.
 * Overlapping bands make the system near-singular; without this the exact
 * least-squares answer is a large alternating comb of boosts and cuts that
 * fits the curve on paper, sounds terrible, and wastes headroom.
 */
export const SOLVE_RIDGE = 0.08;

/**
 * How hard the joint solve pulls the WHOLE layer toward zero, as a fraction of
 * the mean diagonal — distinct from the ridge above, which damps only the step.
 *
 * The ridge makes each step small and cannot make the layer forget anything:
 * a pattern the measurement is blind to earns a step of nothing and so stands
 * forever. And the measurement is blind to more than nothing. It is smoothed an
 * octave wide at the bottom while the bands sit a third apart, so a band-to-
 * band comb down there has an octave-smoothed response of nearly zero — and
 * the rules around the solve, which act on single bands, plant exactly that: a
 * band inside a rolloff sent home while its neighbour is solved, a gated band
 * cut where the next one is not. Measured over an evening of records with a
 * bass-less one among them, every record after it inherited a +1 / −1.6 / +0.9
 * comb around 80 Hz, and the spread of the layer grew by a decibel a record
 * until it met the clamps.
 *
 * A pull on the total drains that. In a direction the measurement sees, the
 * data term is large and this is a rounding error — at two hundredths it costs
 * an eight-decibel resonance about a sixth of a decibel of its correction. In
 * a direction the measurement cannot see, the data term is nothing and this is
 * all there is, so the comb goes to zero on the pass after it appears. The same
 * evening, replayed: the spread after every record is the same on every lap.
 *
 * Two hundredths, measured against five: five drained nothing more and cost
 * that resonance half a decibel.
 */
export const SOLVE_HOME = 0.02;

export const MIN_TRUSTED_OCTAVES = 4;
export const TRUSTED_LOW_ANCHOR_HZ = 560;
export const TRUSTED_HIGH_ANCHOR_HZ = 1120;

/**
 * What the fitted reference says the level should be at one frequency.
 *
 * A STRAIGHT LINE IN LOG-FREQUENCY, AND IT HAS TO STAY ONE.
 *
 * It is tempting to give this a knee. Average music is not a straight line over
 * nine octaves — it is roughly level up to a few hundred hertz and falls above
 * — so one line through both halves is too steep through the bass and too
 * shallow through the treble, and the residual carries a bow that is not a
 * system error at all. That reasoning is correct and the fix does not work.
 *
 * Hinging the basis at 200 Hz was tried. The closed-loop tests caught it within
 * a run: a low shelf at 200 Hz is an ordinary voicing, it is close to a straight
 * line over the correctable band, and a straight line is the one shape this fit
 * removes *entirely*. Make the reference flat below the knee and that shelf
 * stops being absorbable — it reads as a permanent deviation no gain can
 * satisfy, every run adds another slice of it, and the layer marches off until
 * it hits the clamps. Six runs made it unmistakable.
 *
 * So the rigidity is the feature, and the cost of it is a known bias rather
 * than a bug to fix here. Any richer reference — a knee, a quadratic — can
 * represent more of the *system's* error as well, and the errors this exists to
 * find are broad. The reference has to be the one shape a system error cannot
 * take.
 */
