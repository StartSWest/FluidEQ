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

import {
  FilterTypeEnum,
  IFilter,
  MAX_GAIN,
  MIN_GAIN,
  NO_GAIN_FILTER_TYPES,
} from 'common/constants';
import { SMART_EQ_MAX_FREQUENCY, SMART_EQ_MIN_FREQUENCY } from 'common/smartEq';
import { IReferenceShape } from 'common/referenceCurve';
import { Translate, TranslationKey } from 'common/i18n';
import { clamp } from './utils';

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

/** One decimal, which is all Equalizer APO reads and all anybody can hear. */
const roundGains = (gains: Record<string, number>): Record<string, number> =>
  Object.fromEntries(
    Object.entries(gains).map(([id, gain]) => [id, Math.round(gain * 10) / 10]),
  );

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
export const tiltLevelAt = (
  fit: { slope: number; intercept: number },
  frequency: number,
) => fit.slope * Math.log10(frequency) + fit.intercept;

/*
 * WHY THERE IS NO TOLERANCE CORRIDOR HERE, since it is the obvious idea and was
 * built before being taken back out.
 *
 * The reasoning for one is good. Chasing an exact line leaves a residual at
 * every frequency forever, so there is always something left to do and the
 * gains never stop moving; the one commercial reference worth copying draws its
 * targets as ranges rather than lines, because analysing enough masters shows
 * good records agree on a corridor and not on a curve. Correct only the excess
 * outside it and there is finally a state in which the answer is "nothing".
 *
 * It costs the property this whole feature exists for. A dead band is
 * path-dependent: a correction stops at the edge it happened to approach from,
 * so where it settles depends on where it started, and two records can both be
 * "correct" two decibels apart. Every source arriving at the same signature is
 * the one thing that cannot be traded away for smoothness.
 *
 * And it turned out not to be needed. The wander it was meant to stop was the
 * reference slope being too bright — held to the corrected one, a good modern
 * master draws no correction at all, so there is nothing left to suppress. The
 * continuous stepper's own settle hysteresis covers the rest.
 */

/**
 * How much a frequency counts toward the solve, on top of how well it was
 * heard.
 *
 * Confidence answers "did we hear this", which is not the same question as
 * "does being wrong here matter". Three decibels at three kilohertz and three
 * at forty are the same measurement and nothing like the same mistake, and the
 * solve used to treat them identically — so an unlucky reading at the very
 * bottom or top could pull midrange bands around to satisfy it.
 *
 * A gentle bell rather than a real loudness contour: a proper one is level-
 * dependent and this has no idea how loud anybody is listening. Wide enough
 * that two hundred hertz still counts for most of a midrange point, and floored
 * so the extremes are quietened rather than ignored — they are still the
 * frequencies most likely to be genuinely wrong.
 */
export const AUDIBILITY_CENTRE_HZ = 2000;
export const AUDIBILITY_WIDTH_OCTAVES = 3.5;
export const AUDIBILITY_FLOOR = 0.25;

export const audibilityWeight = (frequency: number): number => {
  if (!(frequency > 0)) {
    return AUDIBILITY_FLOOR;
  }
  const octaves = Math.log2(frequency / AUDIBILITY_CENTRE_HZ);
  const bell = Math.exp(-((octaves / AUDIBILITY_WIDTH_OCTAVES) ** 2));
  return AUDIBILITY_FLOOR + (1 - AUDIBILITY_FLOOR) * bell;
};

/** Where the bass ends, for anchoring: full weight below, none above. */
const BASS_ANCHOR_FULL_HZ = 150;
const BASS_ANCHOR_NONE_HZ = 400;

/**
 * Weight for anchoring on the bottom instead of on loudness.
 *
 * Subtracting a weighted mean of the correction is what stops a run changing
 * the volume, and which frequencies carry the weight decides what is being held
 * still. Weighted by audibility it is the perceived level, which is what nearly
 * everything here wants.
 *
 * Detail does not. It exists to raise the mids and highs, and against a loudness
 * anchor a rise up there is paid for by a cut down here — so the one mode whose
 * whole promise is "without touching the bass" would be the one mode that
 * reliably took a decibel off it. Anchoring on the bass makes the bottom the
 * fixed point instead: it lands at zero and the lift goes upward from there.
 *
 * Flat below 150 Hz and gone by 400, with a raised cosine between, so no band
 * sits on a step and a filter near the boundary contributes part of itself.
 */
export const bassWeight = (frequency: number): number => {
  if (!(frequency > 0) || frequency <= BASS_ANCHOR_FULL_HZ) {
    return 1;
  }
  if (frequency >= BASS_ANCHOR_NONE_HZ) {
    return 0;
  }
  const t =
    Math.log2(frequency / BASS_ANCHOR_FULL_HZ) /
    Math.log2(BASS_ANCHOR_NONE_HZ / BASS_ANCHOR_FULL_HZ);
  return 0.5 * (1 + Math.cos(Math.PI * t));
};

/**
 * How wide to smooth, at a given frequency, in octaves.
 *
 * It was half an octave everywhere, which is wrong at both ends in opposite
 * directions. What goes wrong in a room at the bottom is broad, and the fine
 * detail down there is modal — it moves when you move your head, so correcting
 * it fits the measurement and not the room. What goes wrong at the top is
 * narrower and the ear resolves it better.
 *
 * An octave below the knee, a third of an octave above two kilohertz, and a
 * smooth walk between the two so no band sits on a discontinuity.
 */
export const SMOOTHING_WIDE_BELOW_HZ = 200;
export const SMOOTHING_NARROW_ABOVE_HZ = 2000;

export const smoothingOctavesAt = (frequency: number): number => {
  const wide = 1;
  const narrow = 1 / 3;
  const low = Math.log10(SMOOTHING_WIDE_BELOW_HZ);
  const high = Math.log10(SMOOTHING_NARROW_ABOVE_HZ);
  const x = Math.log10(Math.max(frequency, 1));
  const t = clamp((x - low) / (high - low), 0, 1);
  return wide + (narrow - wide) * t;
};

/* -------------------------------------------------------------------------
 * Types
 * ---------------------------------------------------------------------- */

/** One averaged point of the measured output spectrum. */
export interface ISpectrumSample {
  frequency: number;
  /** Level in dB, relative to the loudest part of the same measurement. */
  level: number;
  /**
   * 0..1 trust in `level`. Absent means fully trusted, which is what
   * hand-built spectra construct.
   */
  confidence?: number;
}

export interface IAutoBalanceOptions {
  /** Fraction of the measured deviation that is corrected. */
  strength?: number;
  /** Boosting a dip costs headroom, so it is limited harder than a cut. */
  maxBoost?: number;
  maxCut?: number;
  /**
   * How much of the boost limit a frequency has earned, from 0 to 1.
   *
   * Zero where nothing is playing, so a range that is silent cannot be lifted
   * however long it reports a deficit. Cuts are never scaled by this: a range
   * with no signal has nothing that needs taking away, and it is only boosts
   * that compound against evidence that never arrives.
   *
   * Supplied by whoever owns the capture, since it is built from the live
   * region levels and the lines somebody has set on the plot. Absent means one
   * everywhere, which is how this behaved before there were any lines.
   */
  boostAllowance?: (frequency: number) => number;
  /**
   * Width of the smoothing window used to reject FFT noise, in octaves — one
   * number, or a function of frequency for a width that is not the same at both
   * ends of the range. Defaults to `smoothingOctavesAt`.
   */
  smoothingOctaves?: number | ((frequency: number) => number);
  /** Bands below this confidence hold their current gain instead of guessing. */
  minConfidence?: number;
  /**
   * The capture measures the already-corrected output, so the result is a
   * residual. Adding it to the current gain makes repeated runs converge
   * instead of undoing each other.
   */
  relativeToCurrentGain?: boolean;
  /**
   * What everything deliberate below this correction already does, in dB.
   *
   * Not a wish: those layers are already written into the config and already
   * inside the capture. Naming them here is what stops the measurement reading
   * them as error and cancelling them out, and it is what turns the answer into
   * the residual it claims to be — the correction ends up steering toward
   * `the program's tilt + target` rather than toward flat.
   *
   * Followed by its shape, not by its slope. A straight line in log-frequency
   * is exactly what the tilt fit removes from the measurement, so a target is
   * followed only as far as it departs from one — see the fit below for why
   * anything else cannot converge.
   */
  targetCurve?: ISpectrumSample[];
  /**
   * What the record is held to, rather than what it is.
   *
   * Empty means the reference is a line fitted to this record, which is the
   * behaviour every caller had before there was a choice. See
   * common/referenceCurve for the three shapes and what each overrides.
   */
  reference?: IReferenceShape;
}

/**
 * The fraction of the measured deviation one pass asks for. It was 0.65.
 *
 * That number was chosen when a run cleared the layer to flat and applied its
 * whole answer at once, where asking for everything really could overshoot with
 * nothing to pull it back. Neither half of that is true now: the layer stays in
 * the measurement, so what a run solves is a residual, and a pass that goes too
 * far is measured as too far and corrected on the next one.
 *
 * The conservatism was costing far more than it bought, and the amount is
 * measurable rather than a matter of taste. At 0.65 a single pass removes about
 * 2.7 dB of an 8 dB resonance — a third of it, which is a correction nobody can
 * see on the plot and few would notice by ear. Records that are genuinely dark,
 * bright or bass-heavy were moved by around a decibel and left there, which is
 * the difference between a feature that works and one that appears not to.
 *
 * A one is not a promise of a full correction, which is the part worth knowing
 * before reaching for something larger: the ridge term in the solve damps the
 * answer as well, so one pass at 1.0 removes about half of the same resonance.
 * The rest arrives over the following passes, which is what a closed loop is
 * for. Everything downstream still bounds it — `SMART_EQ_MAX_BOOST_DB` and its
 * cut, the continuous stepper's own limits, and the deadband.
 *
 * IT STAYS AT ONE, and the reason is worth recording because the received
 * wisdom says otherwise. Practitioners matching a long-term average spectrum
 * report having to back the result off to about half before it sounds like
 * anything but a caricature, and match EQs fit deliberately few bands for the
 * same reason. Both are true, and neither applies here: they describe a static
 * match that computes its whole answer once and commits it, where being wrong
 * is permanent. This re-measures and converges, so a pass that overshoots is
 * seen as an overshoot and taken back.
 *
 * Tried at 0.6 anyway, and measured what it cost. Against a bass shelf and a
 * presence scoop totalling 5.5 dB, a pass at 0.6 corrects 1.4 dB where a pass
 * at 1.0 corrects 2.4. The complaint this feature actually attracts is that it
 * does nothing visible to a curve somebody has plainly bent, and halving the
 * only number that answers that is the wrong direction.
 */
const DEFAULTS: Required<IAutoBalanceOptions> = {
  strength: 1,
  maxBoost: 6,
  maxCut: 9,
  // Everything is allowed until somebody supplies a reason it is not.
  boostAllowance: () => 1,
  smoothingOctaves: smoothingOctavesAt,
  minConfidence: MIN_BAND_CONFIDENCE,
  relativeToCurrentGain: true,
  targetCurve: [],
  reference: {},
};

const clamp01 = (value: number) => clamp(value, 0, 1);

const weightOf = (sample: ISpectrumSample) => sample.confidence ?? 1;

/* -------------------------------------------------------------------------
 * Spectrum maths
 * ---------------------------------------------------------------------- */

/**
 * Normalised dB shape of one filter at unit gain.
 *
 * Setting every band to the deviation measured at its own centre is only
 * correct when the bands do not overlap — and they always do. A Q of 1 is
 * roughly 1.4 octaves wide, so a 31-band layout on 1/3-octave centres stacks
 * three or four bells over every point and the summed correction lands two to
 * three times too strong. Knowing each filter's shape is what lets the gains
 * be solved together instead of guessed one at a time.
 *
 * This is the small-signal shape, which is what makes the problem linear and
 * therefore solvable.
 */
export const filterShapeAt = (
  filter: Pick<IFilter, 'type' | 'frequency' | 'quality'>,
  frequency: number,
): number => {
  if (
    NO_GAIN_FILTER_TYPES.includes(filter.type) ||
    filter.frequency <= 0 ||
    frequency <= 0
  ) {
    // These types carry no gain, so there is nothing to solve for.
    return 0;
  }

  const ratio = frequency / filter.frequency;
  if (filter.type === FilterTypeEnum.LSC) {
    return 1 / (1 + ratio ** 2);
  }
  if (filter.type === FilterTypeEnum.HSC) {
    return 1 / (1 + (1 / ratio) ** 2);
  }
  const detune = Math.max(0.05, filter.quality) * (ratio - 1 / ratio);
  return 1 / (1 + detune ** 2);
};

/**
 * Solve `A x = b` by Gaussian elimination with partial pivoting. The system is
 * at most MAX_NUM_FILTERS square, so a direct O(n^3) solve costs far less than
 * the FFT that produced the data.
 */
const solveLinearSystem = (
  matrix: number[][],
  vector: number[],
): number[] | undefined => {
  const n = vector.length;
  const a = matrix.map((row, index) => [...row, vector[index]]);

  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) {
        pivot = row;
      }
    }
    if (Math.abs(a[pivot][col]) < 1e-9) {
      // Singular even after regularisation; refuse rather than emit NaNs.
      return undefined;
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];

    for (let row = col + 1; row < n; row += 1) {
      const factor = a[row][col] / a[col][col];
      if (factor !== 0) {
        for (let k = col; k <= n; k += 1) {
          a[row][k] -= factor * a[col][k];
        }
      }
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row -= 1) {
    let sum = a[row][n];
    for (let col = row + 1; col < n; col += 1) {
      sum -= a[row][col] * x[col];
    }
    x[row] = sum / a[row][row];
  }
  return x.every((value) => Number.isFinite(value)) ? x : undefined;
};

/**
 * Confidence-weighted least-squares fit of
 * `level = slope * log10(frequency) + intercept`.
 *
 * This line is the program material's own spectral tilt. Music is not flat —
 * its long-term average falls with frequency — so flattening the measurement
 * outright would strip the life out of it. Correcting only the *deviation*
 * from the fitted tilt removes resonances, boom and honk while leaving the
 * natural balance of the recording intact.
 */
export const fitSpectralTilt = (
  samples: ISpectrumSample[],
  /**
   * A slope to hold rather than one to find.
   *
   * This is the whole difference between correcting a record's bumps and
   * correcting the record. Fitted, the slope is whatever this music happens to
   * have and is therefore correct by definition, so a dull record stays dull.
   * Held, a record duller than the given slope reads as a deficit and gets
   * lifted — and, crucially, it stays lifted, because the thing it is compared
   * against does not move when the music does.
   *
   * The intercept is fitted either way. Loopback carries whatever the volume
   * knob is set to, so an absolute level here means nothing at all.
   */
  fixedSlope?: number,
) => {
  const usable = samples.filter(
    ({ frequency, level }) =>
      frequency > 0 && Number.isFinite(level) && Number.isFinite(frequency),
  );
  if (usable.length < 2) {
    return { slope: 0, intercept: 0 };
  }

  let sumW = 0;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  usable.forEach((sample) => {
    const w = weightOf(sample);
    const x = Math.log10(sample.frequency);
    sumW += w;
    sumX += w * x;
    sumY += w * sample.level;
    sumXY += w * x * sample.level;
    sumXX += w * x * x;
  });

  if (sumW <= 0) {
    return { slope: 0, intercept: 0 };
  }
  // Held slope: only the level is left to find, and the weighted mean of
  // `level - slope * x` is it.
  if (Number.isFinite(fixedSlope)) {
    const slope = fixedSlope as number;
    return { slope, intercept: (sumY - slope * sumX) / sumW };
  }
  const denominator = sumW * sumXX - sumX * sumX;
  if (Math.abs(denominator) < 1e-9) {
    return { slope: 0, intercept: sumY / sumW };
  }
  const slope = (sumW * sumXY - sumX * sumY) / denominator;
  return { slope, intercept: (sumY - slope * sumX) / sumW };
};

/**
 * Confidence-weighted fractional-octave smoothing in the log domain.
 *
 * The width may be a function of frequency rather than one number, because the
 * right amount is not the same at both ends — see `smoothingOctavesAt`.
 */
export const smoothSpectrum = (
  samples: ISpectrumSample[],
  octaves: number | ((frequency: number) => number),
): ISpectrumSample[] =>
  samples.map((sample, index) => {
    const width =
      typeof octaves === 'function' ? octaves(sample.frequency) : octaves;
    const halfWidth = Math.log10(2 ** (width / 2));
    const centre = Math.log10(sample.frequency);
    let total = 0;
    let count = 0;
    for (let offset = index; offset >= 0; offset -= 1) {
      if (
        Math.abs(Math.log10(samples[offset].frequency) - centre) > halfWidth
      ) {
        break;
      }
      const w = weightOf(samples[offset]);
      total += w * samples[offset].level;
      count += w;
    }
    for (let offset = index + 1; offset < samples.length; offset += 1) {
      if (
        Math.abs(Math.log10(samples[offset].frequency) - centre) > halfWidth
      ) {
        break;
      }
      const w = weightOf(samples[offset]);
      total += w * samples[offset].level;
      count += w;
    }
    return {
      frequency: sample.frequency,
      level: count > 0 ? total / count : sample.level,
      confidence: sample.confidence,
    };
  });

/** Linear interpolation of a spectrum field at an arbitrary frequency. */
export const sampleSpectrumAt = (
  samples: ISpectrumSample[],
  frequency: number,
  field: 'level' | 'confidence' = 'level',
): number => {
  const read = (sample: ISpectrumSample) =>
    field === 'confidence' ? weightOf(sample) : sample.level;

  if (samples.length === 0) {
    return 0;
  }
  if (frequency <= samples[0].frequency) {
    return read(samples[0]);
  }
  const last = samples[samples.length - 1];
  if (frequency >= last.frequency) {
    return read(last);
  }

  const upperIndex = samples.findIndex(
    (sample) => sample.frequency >= frequency,
  );
  const upper = samples[upperIndex];
  const lower = samples[upperIndex - 1] ?? upper;
  const span = Math.log10(upper.frequency) - Math.log10(lower.frequency);
  if (span <= 0) {
    return read(upper);
  }
  const position = (Math.log10(frequency) - Math.log10(lower.frequency)) / span;
  return read(lower) + (read(upper) - read(lower)) * position;
};

/**
 * Turn a measured spectrum into a gain for each band.
 *
 * The result is the inverse of the smoothed deviation from the program's own
 * tilt, scaled back by `strength` so the correction is a nudge rather than a
 * hard flattening, and centred so it changes tone rather than loudness. Bands
 * whose region was never heard well enough are left exactly where they are.
 */
export const buildBalancedGains = (
  spectrum: ISpectrumSample[],
  filters: IFilter[],
  options: IAutoBalanceOptions = {},
): Record<string, number> => {
  const {
    strength,
    maxBoost,
    maxCut,
    boostAllowance,
    smoothingOctaves,
    minConfidence,
    relativeToCurrentGain,
    targetCurve,
    reference,
  } = { ...DEFAULTS, ...options };

  const usable = spectrum
    .filter(
      ({ frequency, level }) =>
        Number.isFinite(level) &&
        frequency >= BALANCE_MIN_FREQUENCY &&
        frequency <= BALANCE_MAX_FREQUENCY,
    )
    .sort((left, right) => left.frequency - right.frequency);

  if (usable.length < 8 || filters.length === 0) {
    return {};
  }

  // The span gate only engages for real measurements. A hand-built spectrum
  // carries no confidence and is taken at face value.
  const hasConfidence = spectrum.some(
    (sample) => typeof sample.confidence === 'number',
  );
  if (hasConfidence) {
    const trusted = usable.filter(
      (sample) => weightOf(sample) >= minConfidence,
    );
    if (trusted.length === 0) {
      return {};
    }
    const low = trusted[0].frequency;
    const high = trusted[trusted.length - 1].frequency;
    if (
      Math.log2(high / low) < MIN_TRUSTED_OCTAVES ||
      low > TRUSTED_LOW_ANCHOR_HZ ||
      high < TRUSTED_HIGH_ANCHOR_HZ
    ) {
      return {};
    }
  }

  // The deliberate layers come off BEFORE the tilt is fitted, not after.
  //
  // The fitted line is meant to be the program material's own slope, and it is
  // the one thing here that is deliberately never corrected. A measurement
  // still carrying a bass shelf reads part of that shelf as slope, so fitting
  // first and subtracting the target afterwards leaves the target's own tilt
  // standing as a deviation — a constant drive that no gain can ever satisfy,
  // because a layer shaped like a straight line contributes nothing to the
  // residual it is supposed to cancel. Each run then adds another slice of it
  // and the correction walks off in a straight line until it hits the clamps.
  // Taking the layers out first makes the fit an estimate of the program alone,
  // which is what it always claimed to be.
  const hasTarget = targetCurve.length > 0;
  const steered = usable.map((sample) => ({
    frequency: sample.frequency,
    level:
      sample.level -
      (hasTarget ? sampleSpectrumAt(targetCurve, sample.frequency) : 0),
    confidence: sample.confidence,
  }));

  // What this record is being held to.
  //
  // A line fitted to the record itself says its own tonal signature is correct
  // by definition, so only its bumps and dips are corrected. A line at a fixed
  // slope says nothing of the sort, and a record duller than that slope is
  // lifted toward it — and stays lifted, because what it is compared against no
  // longer moves when the music does. The shape on top is the rest of a target
  // curve, when there is one. See `common/referenceCurve`.
  const fit = fitSpectralTilt(steered, reference.slope);
  const hasShape = Boolean(reference.shape?.length);
  const deviation = smoothSpectrum(
    steered.map((sample) => ({
      frequency: sample.frequency,
      level:
        sample.level -
        tiltLevelAt(fit, sample.frequency) -
        (hasShape
          ? sampleSpectrumAt(
              reference.shape as ISpectrumSample[],
              sample.frequency,
            )
          : 0),
      confidence: sample.confidence,
    })),
    smoothingOctaves,
  );

  const raw = filters.map((filter) => {
    const inBand =
      filter.frequency >= BALANCE_MIN_FREQUENCY &&
      filter.frequency <= BALANCE_MAX_FREQUENCY;
    // The per-band floor is applied here, not only by filtering the input: it
    // is what stops sampleSpectrumAt clamping an unmeasured band to the
    // nearest measured one at the edge of coverage.
    const measured = inBand
      ? clamp01(sampleSpectrumAt(deviation, filter.frequency, 'confidence'))
      : 0;
    const confidence = measured >= minConfidence ? measured : 0;
    return {
      id: filter.id,
      gain: filter.gain,
      confidence,
      // Solvable only if the band is trusted AND its type actually has a gain.
      isSolvable: confidence > 0 && !NO_GAIN_FILTER_TYPES.includes(filter.type),
      filter,
      correction: 0,
    };
  });

  /*
   * THE RECORD'S OWN ROLLOFF AT THE SPECTRUM EDGES IS NEVER FILLED.
   *
   * Every record falls away steeply below its lowest note and above what its
   * production kept, while a reference line extends straight past both. So at
   * the edges the line demands energy no master has ever had, the solver reads
   * a fifteen-decibel deficit, and the bass bands walk to their limit — a hump
   * at the bottom of the plot that grows to the cap on any record, because it
   * is not a property of the record, it is the line over-promising.
   *
   * Room correction settled this decades ago: dips and rolloffs are never
   * boosted, because the energy is not missing, it was never there. The same
   * asymmetry as everywhere else in this file — an edge with too MUCH energy is
   * still cut, since taking away something real is always safe.
   *
   * Detected from the deviation itself: a contiguous run from either end of the
   * measured span that sits more than EDGE_ROLLOFF_DB under the reference is a
   * rolloff, and its deficit is not a correction target. The run stops the
   * moment the record comes back within range of the line, so a genuine broad
   * dip in the middle of the spectrum is untouched by this.
   */
  const isEdgeRolloff = deviation.map(() => false);
  /*
   * Depth alone does not make a rolloff, and treating it as one broke the
   * mode's whole point: a record twice as dark as the reference sits more than
   * ten decibels under the line across its entire top end, and marking that as
   * "not there" refused the very lift the mode exists to give. What separates a
   * cliff from a dark master is STEEPNESS — a real rolloff falls at twenty-plus
   * decibels an octave, a dark record at three to seven — so a candidate run is
   * only believed if it falls toward the edge that fast.
   */
  const markEdgeRun = (from: number, step: number) => {
    let end = from;
    while (
      end >= 0 &&
      end < deviation.length &&
      deviation[end].level < -EDGE_ROLLOFF_DB
    ) {
      end += step;
    }
    if (end === from) {
      // The first sample already fails the depth test: no run at all.
      return;
    }
    const inner = end - step;
    const octaves = Math.abs(
      Math.log2(deviation[from].frequency / deviation[inner].frequency),
    );
    const drop = deviation[inner].level - deviation[from].level;
    if (octaves < 0.25 || drop / octaves < ROLLOFF_MIN_DB_PER_OCTAVE) {
      return;
    }
    for (let i = from; i !== end; i += step) {
      isEdgeRolloff[i] = true;
    }
  };
  markEdgeRun(0, 1);
  markEdgeRun(deviation.length - 1, -1);

  // Desired correction at every measured frequency, centred so the answer is a
  // change of tone rather than of level.
  // Two weights, and they answer different questions: confidence is whether we
  // heard this frequency, audibility is whether being wrong here matters.
  const targets = deviation.map((sample) => ({
    frequency: sample.frequency,
    weight:
      clamp01(sample.confidence ?? 1) * audibilityWeight(sample.frequency),
    want: -sample.level * strength,
  }));
  // Applied after the map so the index lines up: an edge rolloff may be cut,
  // never filled.
  targets.forEach((point, index) => {
    if (isEdgeRolloff[index] && point.want > 0) {
      point.want = 0;
      // And it carries no weight either, so ten octaves of unfillable deficit
      // cannot drag the level anchor or the joint solve toward the edge.
      point.weight = 0;
    }
  });

  /*
   * And a band that lives inside a rolloff goes HOME, not wherever it was.
   *
   * Removing the target was half the rule and the wrong half on its own: with
   * nothing asking anything of those bands, they simply held their last value —
   * a layer that arrived bent at the bottom stayed bent there forever, which is
   * path dependence in its purest form, and the divergence test measured it at
   * seven decibels.
   *
   * The right resting state for a correction aimed at energy that was never
   * there is no correction. So these bands decay toward zero, which has the one
   * property everything else here keeps fighting for: it is the same
   * destination from every starting point.
   */
  const lowEdgeHz = (() => {
    let last = -Infinity;
    for (let i = 0; i < deviation.length; i += 1) {
      if (!isEdgeRolloff[i]) {
        break;
      }
      last = deviation[i].frequency;
    }
    return last;
  })();
  const highEdgeHz = (() => {
    let first = Infinity;
    for (let i = deviation.length - 1; i >= 0; i -= 1) {
      if (!isEdgeRolloff[i]) {
        break;
      }
      first = deviation[i].frequency;
    }
    return first;
  })();
  const isInRolloff = (frequency: number) =>
    frequency < lowEdgeHz || frequency > highEdgeHz;
  const totalWeight = targets.reduce((total, point) => total + point.weight, 0);
  const wantMean =
    totalWeight > 0
      ? targets.reduce((total, point) => total + point.want * point.weight, 0) /
        totalWeight
      : 0;

  // Solve every band's gain at once against the whole measured curve, so
  // overlapping bells share the correction instead of each applying it in
  // full. This is what keeps a 31-band layout smooth rather than tripling the
  // intended boost.
  const solvable = raw.filter((entry) => entry.isSolvable);
  if (solvable.length > 0 && totalWeight > 0) {
    const n = solvable.length;
    const shapes = solvable.map((entry) =>
      targets.map((point) => filterShapeAt(entry.filter, point.frequency)),
    );

    const normal: number[][] = Array.from({ length: n }, () =>
      new Array<number>(n).fill(0),
    );
    const rhs = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i += 1) {
      for (let j = i; j < n; j += 1) {
        let sum = 0;
        for (let k = 0; k < targets.length; k += 1) {
          sum += targets[k].weight * shapes[i][k] * shapes[j][k];
        }
        normal[i][j] = sum;
        normal[j][i] = sum;
      }
      let sum = 0;
      for (let k = 0; k < targets.length; k += 1) {
        sum += targets[k].weight * shapes[i][k] * (targets[k].want - wantMean);
      }
      rhs[i] = sum;
    }

    // Ridge term. Heavily overlapping bands make the system near-singular, and
    // the unregularised answer is a huge alternating +/- comb that sums to the
    // right curve but sounds awful and eats headroom. This biases towards the
    // smallest set of gains that fits.
    const meanDiagonal =
      normal.reduce((total, row, index) => total + row[index], 0) / n;
    const ridge = Math.max(meanDiagonal * SOLVE_RIDGE, 1e-6);
    for (let i = 0; i < n; i += 1) {
      normal[i][i] += ridge;
    }

    const solved = solveLinearSystem(normal, rhs);
    if (solved) {
      solved.forEach((gain, index) => {
        solvable[index].correction = gain;
      });
    } else {
      // Fall back to the per-band reading rather than applying nothing.
      solvable.forEach((entry) => {
        entry.correction =
          -sampleSpectrumAt(deviation, entry.filter.frequency) * strength;
      });
    }
  }

  /*
   * THE CORRECTION IS ANCHORED TO THE MIDRANGE, so it changes the balance and
   * not the volume.
   *
   * This was `const mean = 0` — the remains of an earlier centring — so nothing
   * held the correction's overall level at all. Every write was free to sit a
   * little lower than the last, and over an evening of a continuous mode that
   * is what happened: most music carries more bass than the target asks for, so
   * pass after pass took a little more out, no single step looked wrong, and
   * the sound quietly got smaller. A correction meant to improve the balance
   * was paying for it in loudness.
   *
   * Subtracting the midrange average makes that impossible by construction. It
   * says exactly the same thing about the SHAPE — every band's position
   * relative to every other is untouched — and nothing at all about the level,
   * so no number of passes can accumulate one.
   *
   * WEIGHTED TOWARD THE MIDRANGE, ACROSS THE WHOLE SPECTRUM — not an average of
   * the midrange, which is the version that looks right and is not.
   *
   * A flat average over twenty octaves would let a change in the top one count
   * as much as a change at 1 kHz, and hearing does not work that way: what
   * anybody means by "the volume" is overwhelmingly what the mids are doing.
   * So the average has to lean there.
   *
   * But taking it *only* from a midrange window is worse, and the tests caught
   * it immediately: a resonance at 1 kHz sits inside that window, so the anchor
   * ends up computed from the very fault being corrected, subtracts it from
   * itself, and the correction comes out as nothing. It would have made the
   * feature blind in exactly the region it matters most.
   *
   * `audibilityWeight` is the shape that gets both: a gentle bell around 2 kHz
   * with a floor, so a narrow midrange fault contributes only its own small
   * share of a broad average and is still corrected, while a broad level shift
   * anywhere is removed. Times confidence, so a band nobody has heard cannot
   * drag the anchor and take the whole correction with it.
   *
   * OVER THE SOLVED BANDS ONLY, and that is not a detail.
   *
   * `raw` holds every band; only the solvable ones carry an answer, and the rest
   * sit at a correction of zero because the solver deliberately declined them —
   * outside the trusted span, or below the confidence floor. Averaging those
   * zeroes in pulls the anchor toward nothing, and subtracting the anchor from
   * them moves bands the measurement had explicitly refused to move. On a record
   * whose correction is mostly a bass cut, the anchor is negative, so every band
   * the solver had left alone quietly rose by that much — which reads as the
   * correction doing nothing but lifting the top.
   */
  const anchorWeightOf = (entry: (typeof raw)[number]) =>
    (reference.anchor === 'bass'
      ? bassWeight(entry.filter.frequency)
      : audibilityWeight(entry.filter.frequency)) * entry.confidence;
  /** Read twice — once to decide the anchor, once to bound the gain. */
  const allowanceOf = (entry: (typeof raw)[number]) =>
    boostAllowance ? clamp01(boostAllowance(entry.filter.frequency)) : 1;
  /*
   * A BAND THAT MAY NOT MOVE UP DOES NOT GET A VOTE ON THE LEVEL EITHER, and
   * leaving it one is a ratchet that empties the record.
   *
   * The anchor keeps a correction from changing the volume: subtract the
   * weighted mean and what is left is a change of tone. That holds only while
   * the cuts and the boosts it averages both actually happen. Once the presence
   * gate could refuse a boost, they did not — a silent range asked to come up,
   * the mean went positive, every band had that positive number subtracted, and
   * the boosts that were supposed to pay for it were never applied.
   *
   * So each pass took a little off the whole record and none of it went back.
   * Over an evening the correction slid toward its floor with the shape of a
   * deepening V, which is exactly what it looked like: the ranges that kept
   * playing held their ground while everything intermittent sank.
   *
   * The same rule the declined bands already followed, for the same reason.
   */
  const anchored = raw.filter(
    (entry) => entry.isSolvable && allowanceOf(entry) > 0,
  );
  const anchorWeight = anchored.reduce(
    (total, entry) => total + anchorWeightOf(entry),
    0,
  );
  const mean =
    anchorWeight > 0
      ? anchored.reduce(
          (total, entry) => total + entry.correction * anchorWeightOf(entry),
          0,
        ) / anchorWeight
      : 0;

  /*
   * TWO KINDS OF CORRECTION, AND ONLY ONE OF THEM SHOULD BE ALLOWED TO BE BIG.
   *
   * Flattening a resonance — a narrow bump at 200 Hz, three decibels of it — is
   * almost always right, on any record, in any genre. It is a defect.
   *
   * Imposing a TILT is a different act wearing the same clothes. Holding a
   * record to a fixed slope means any record whose own slope differs gets the
   * whole difference applied to it, and the difference between an old master
   * and a modern one is four or five decibels per decade — which over the
   * audible band is twelve decibels from end to end. That is not correcting a
   * defect, it is rewriting the record, and there is no slope that avoids it:
   * whatever value is chosen, the material furthest from it takes the largest
   * imposition. Measured across three plausible masters, every candidate slope
   * left at least one of them seven to twelve decibels out.
   *
   * Both used to share one limit, so a tilt could quietly spend the whole of
   * it. The per-band ceiling of six decibels permits twelve end to end, which is
   * exactly what it was doing — and why the long-run simulation found the
   * correction saturated against both rails with a band pinned at each.
   *
   * So the tilt is fitted out of the answer and bounded on its own, hard, and
   * what is left over keeps the per-band limit it always had. A record still
   * moves toward the house curve; it just cannot be dragged all the way there.
   *
   * This is the one form of the rule that does not depend on knowing what the
   * music is, which is the property that matters: it bounds how much may be
   * rewritten rather than asserting what is correct.
   */
  const gains: Record<string, number> = Object.fromEntries(
    raw.map((entry) => {
      // Clamp the correction, then clamp the total. The correction limit is
      // what stops one run swinging a band further than a measurement can
      // justify; the total limit is what Equalizer APO will build.
      //
      // Both now bound the Smart EQ layer alone rather than the user's band
      // plus a correction, because the bands handed in are the layer's own.
      // A band and the layer above it can therefore add up to more than ±20 dB
      // between them, which is safe: the preamp is sized from the peak of the
      // whole written chain, layers included, so the headroom follows.
      const base = relativeToCurrentGain ? entry.gain : 0;
      // A band the solver declined holds exactly where it is. The anchor is
      // subtracted only from bands that were actually answered for — applying it
      // to the others would move them on the strength of an average they took no
      // part in, which is a correction nobody measured.
      /*
       * The anchor applies only to the bands that are in it.
       *
       * A gated band was already left out of the mean — it cannot pay its share
       * of a boost it is not allowed to make — and subtracting that mean from it
       * anyway is the same mistake as anchoring a band the solver declined: it
       * moves on the strength of an average it took no part in. When the rest of
       * the spectrum wants lifting, the mean is positive, and a silent range
       * quietly gets cut by that much for no reason anybody measured.
       *
       * Which is a ratchet across records rather than within one, and that is
       * why it survived the first fix and needed a two-hundred-pass simulation
       * to find: during a passage with no bass the bass is trimmed, the next
       * record has to spend its own correction undoing that, and the two never
       * quite cancel. Left running it cost 1.8 dB of level and grew the spread
       * from ten decibels to fourteen.
       *
       * Its own correction still applies, so a range that is quiet AND genuinely
       * too loud for its target is still cut. The gate refuses one direction;
       * it does not make a band untouchable.
       */
      const anchor = allowanceOf(entry) > 0 ? mean : 0;
      // Home, for a band aimed at a rolloff — see `isInRolloff`. Scaled by
      // strength so it relaxes at the same pace everything else corrects.
      if (entry.isSolvable && isInRolloff(entry.filter.frequency)) {
        const relaxed = relativeToCurrentGain
          ? entry.gain * (1 - strength * 0.5)
          : 0;
        return [entry.id, clamp(relaxed, MIN_GAIN, MAX_GAIN)];
      }
      const correction = entry.isSolvable ? entry.correction - anchor : 0;
      /*
       * How much of a boost this band has earned, and cuts are untouched.
       *
       * A range with nothing playing in it reports a deficit forever and
       * nothing ever arrives to contradict it, so a boost there compounds until
       * it hits its limit — which is exactly what a guitar intro did to the
       * bass. A cut has no such failure: taking away something nobody could
       * hear takes away nothing. So the allowance bounds one side only.
       *
       * One at the top of the ramp and zero at its floor, which is what makes
       * the two lines on the plot the whole story. Absent means one, so a
       * caller that knows nothing about presence — every test that predates
       * this, and any synthetic frame — behaves exactly as it did.
       */
      const allowance = allowanceOf(entry);
      const gain =
        base +
        clamp(correction * entry.confidence, -maxCut, maxBoost * allowance);
      return [entry.id, clamp(gain, MIN_GAIN, MAX_GAIN)];
    }),
  );

  /*
   * THE LAYER'S OWN LEVEL IS ZERO, and nothing else makes it so.
   *
   * The reference fits its level to the measurement — rightly, since loopback
   * carries the volume knob — so a uniform offset in the layer disappears into
   * the fitted intercept and is invisible to every correction that follows. The
   * anchor centres each increment, but an inherited level is not an increment.
   * Measured: a layer that started seven decibels low SETTLED seven decibels
   * low, with the shape fully converged around it. Same record, same tone,
   * seven decibels quieter, forever — path dependence as a volume knob.
   *
   * A correction layer is a statement about tone. Level belongs to the preamp.
   * So the weighted mean of the layer is taken out of the layer, under the two
   * protections whose absence sank the first attempt at exactly this: every
   * band stays inside its own correction limits, and a band the presence gate
   * has refused is neither counted nor moved — which is also what stops the
   * gated-band ratchet this would otherwise reintroduce. The clamps mean one
   * pass may not fully centre it; the loop finishes the job, which is what a
   * loop is for.
   *
   * The weights are the anchor's own, so Detail keeps its designed shape: its
   * anchor weighs the bass, a bass-weighted mean of zero pins the bass at zero,
   * and the lift above survives intact.
   */
  const levelled = raw.filter(
    (entry) => entry.isSolvable && allowanceOf(entry) > 0,
  );
  const levelledWeight = levelled.reduce(
    (total, entry) => total + anchorWeightOf(entry),
    0,
  );
  if (levelledWeight > 0) {
    const level =
      levelled.reduce(
        (total, entry) =>
          total + (gains[entry.id] ?? 0) * anchorWeightOf(entry),
        0,
      ) / levelledWeight;
    levelled.forEach((entry) => {
      gains[entry.id] = clamp(
        (gains[entry.id] ?? 0) - level,
        Math.max(MIN_GAIN, -maxCut),
        Math.min(MAX_GAIN, maxBoost * allowanceOf(entry)),
      );
    });
  }

  /*
   * AND THE TILT OF THE RESULT IS BOUNDED, which is not the same as bounding
   * the tilt of one pass and is the version that works.
   *
   * The first attempt fitted the tilt out of the CORRECTION and scaled that.
   * Each pass was then duly gentle and the layer still walked to twelve
   * decibels end to end, because sixty gentle passes in the same direction
   * accumulate exactly as one steep one. What has to be bounded is the thing
   * that persists.
   *
   * The property being defended is worth restating, because it is the only one
   * here that holds for music nobody has heard yet. Flattening a resonance is
   * right on any record: it is a defect. Imposing a tilt is only "right"
   * relative to a slope somebody picked, and the material furthest from that
   * pick takes the largest imposition through no fault of its own — measured
   * across a modern master, an older brighter one and a dark one, every
   * candidate slope left at least one of them seven to twelve decibels out.
   * Choosing better is not on offer. Bounding what the choice may cost is.
   *
   * So the straight line through the layer is fitted and scaled back to its
   * allowance, and everything that is not a straight line survives untouched.
   * A record still moves toward the house curve; it can no longer be dragged
   * the whole way there.
   *
   * Only bands that may move are adjusted, and never upward past where they
   * are: shrinking a downward tilt raises the bottom end, and a range the
   * presence gate has refused to lift must not be lifted by the side effect of
   * a correction to something else.
   */
  const tiltable = raw.filter(
    (entry) => entry.isSolvable && entry.confidence > 0,
  );
  if (tiltable.length < 2) {
    return roundGains(gains);
  }

  let sumW = 0;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  tiltable.forEach((entry) => {
    const w = anchorWeightOf(entry);
    const x = Math.log10(entry.filter.frequency);
    const y = gains[entry.id] ?? 0;
    sumW += w;
    sumX += w * x;
    sumY += w * y;
    sumXX += w * x * x;
    sumXY += w * x * y;
  });
  const denominator = sumW * sumXX - sumX * sumX;
  if (!(Math.abs(denominator) > 1e-9)) {
    return roundGains(gains);
  }
  const slope = (sumW * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / sumW;

  const decades =
    tiltable.reduce(
      (widest, entry) => Math.max(widest, Math.log10(entry.filter.frequency)),
      -Infinity,
    ) -
    tiltable.reduce(
      (narrowest, entry) =>
        Math.min(narrowest, Math.log10(entry.filter.frequency)),
      Infinity,
    );
  const span = Math.abs(slope * decades);
  if (!(span > MAX_TILT_SPAN_DB)) {
    return roundGains(gains);
  }
  const keep = MAX_TILT_SPAN_DB / span;

  const bounded: Record<string, number> = { ...gains };
  raw.forEach((entry) => {
    if (!entry.isSolvable) {
      return;
    }
    const tilt = slope * Math.log10(entry.filter.frequency) + intercept;
    const next = (gains[entry.id] ?? 0) - tilt * (1 - keep);
    // Inside the caller's own limits, not the axis. These two passes run
    // AFTER the per-band clamp, and bounding them only by ±20 let them push a
    // band past the limit somebody had just drawn on the plot — which is the
    // one thing a line named "limit" must never appear to allow.
    const within = clamp(
      next,
      Math.max(MIN_GAIN, -maxCut),
      Math.min(MAX_GAIN, maxBoost * allowanceOf(entry)),
    );
    // A gated range may be brought down by this and never up.
    bounded[entry.id] =
      allowanceOf(entry) > 0 ? within : Math.min(gains[entry.id] ?? 0, within);
  });

  return roundGains(bounded);
};

/* -------------------------------------------------------------------------
 * FFT cells
 * ---------------------------------------------------------------------- */

/** Inclusive FFT bin range backing one point of the analysis axis. */
export interface IAxisCell {
  firstBin: number;
  lastBin: number;
}

/**
 * Map each axis point to every FFT bin inside its cell.
 *
 * Reading a single nearest bin per point — which is fine for a display trace —
 * looks at barely a tenth of the spectrum: at 48 kHz with a 4096-point FFT the
 * 1536 bins between 2 kHz and 20 kHz are represented by ~107 single-bin
 * samples, so ~93% of the treble energy is never seen and what is left is a
 * noisy lottery. Averaging the whole cell is what makes the treble reading
 * stable enough to drive an EQ.
 */
export const createAxisCells = (
  axis: readonly number[],
  sampleRate: number,
  fftSize: number,
): IAxisCell[] => {
  const binWidth = sampleRate / fftSize;
  const maxBin = Math.max(1, fftSize / 2 - 1);

  return axis.map((frequency, index) => {
    // Cell edges are the geometric midpoints to the neighbouring points, so
    // cells tile the axis without gaps or overlap.
    const lower =
      index === 0 ? frequency : Math.sqrt(axis[index - 1] * frequency);
    const upper =
      index === axis.length - 1
        ? frequency
        : Math.sqrt(frequency * axis[index + 1]);

    // Bin 0 is DC and carries no musical information.
    const firstBin = clamp(Math.round(lower / binWidth), 1, maxBin);
    const lastBin = clamp(Math.round(upper / binWidth), firstBin, maxBin);
    return { firstBin, lastBin };
  });
};

/**
 * Power mean of each cell, in absolute dBFS. Writes into `out` to avoid
 * allocating a new array on every analyser frame.
 */
export const readAbsoluteLevels = (
  frequencyData: Float32Array,
  cells: IAxisCell[],
  out: Float64Array,
): Float64Array => {
  cells.forEach((cell, index) => {
    let power = 0;
    let count = 0;
    const last = Math.min(cell.lastBin, frequencyData.length - 1);
    for (let bin = cell.firstBin; bin <= last; bin += 1) {
      const level = frequencyData[bin];
      if (Number.isFinite(level)) {
        power += 10 ** (level / 10);
        count += 1;
      }
    }
    out[index] = count > 0 ? 10 * Math.log10(power / count) : -Infinity;
  });
  return out;
};

/* -------------------------------------------------------------------------
 * Capture accumulator
 * ---------------------------------------------------------------------- */

export interface IBalanceRegion {
  label: string;
  lowFrequency: number;
  highFrequency: number;
  /** Inclusive axis-index range. */
  firstIndex: number;
  lastIndex: number;
  /** Geometric centre, used for the confidence curve and convergence probe. */
  centreFrequency: number;
}

/** One analyser frame, in absolute dBFS. */
export interface IBalanceFrame {
  levels: Float64Array;
  /** Loudest finite bin of the frame, in dBFS. */
  peakDb: number;
  /** Monotonic clock in ms, supplied by the caller. */
  timestampMs: number;
}

/** Weighted Welford state for one region's level. */
export interface IBalanceRegionState {
  weight: number;
  mean: number;
  m2: number;
}

export interface IBalanceCaptureState {
  axis: number[];
  /** Set only for a capture that never ends. See CONTINUOUS_HALF_LIFE_MS. */
  halfLifeMs?: number;
  /**
   * What the applied chain is doing at each axis point right now, in dB, so the
   * capture measures the record rather than the output. See
   * `accumulateBalanceFrame` for why that is the whole design and not an
   * adjustment to it.
   *
   * Written by the owner of the capture rather than by the accumulator, because
   * the chain changes underneath a session that never ends — every correction
   * this loop applies changes it — and the accumulator has no way to know.
   * Absent means "nothing is applied", which is what a synthetic frame in a test
   * wants.
   */
  chainGainDb?: number[];
  /**
   * Scratch for the reconstructed source. Reused rather than allocated per
   * frame: this runs about twenty times a second for as long as somebody is
   * listening.
   */
  sourceLevels?: Float64Array;
  regions: IBalanceRegion[];
  /** Sum of weight * linear power per axis point, relative to the frame's own
   * mean level. */
  power: Float64Array;
  weight: Float64Array;
  regionStates: IBalanceRegionState[];
  /**
   * The record's own recent peak in dBFS, followed the way the plot follows it.
   *
   * Instant attack, about a decibel a second of release — which is exactly what
   * `useLiveOutputSpectrum` does for the trace it draws. That is not tidiness.
   * Somebody sets the presence lines by looking at the trace, so the number the
   * detector compares against those lines has to be the number they were
   * looking at. Two followers with different time constants would put a line in
   * one place on screen and another in the maths, and the disagreement would
   * only ever surface as the correction doing something with no visible reason.
   */
  trackReferenceDb?: number;
  /**
   * What each range is doing right now, on the plot's own axis.
   *
   * Deliberately not accumulated. Coverage and confidence answer "have we heard
   * enough of this range to correct it", which is a question about the whole
   * session. This answers "is anything playing here at the moment", which is a
   * question about this second — and averaging it would defeat the entire
   * purpose, because a bass guitar that stops for a verse is precisely the
   * thing being detected.
   */
  liveDb: Float64Array;
  /**
   * How much each range is believed at this instant, from 0 to 1.
   *
   * Written by the owner of the capture rather than computed here, for the same
   * reason `chainGainDb` is: it depends on where somebody has dragged that
   * range's presence lines, which is a preference rather than a property of the
   * measurement. The accumulator multiplies its frame weight by it and asks no
   * questions.
   *
   * THIS IS WHY MOVING A LINE CHANGES HOW FAST A RANGE FILLS. The lines used to
   * bound only the boost, so dragging one changed what a range was ALLOWED and
   * not what was HEARD — and a coverage bar sitting under a line that plainly
   * did not feed it explains less than no bar at all. Evidence gathered while a
   * range is silent is evidence about silence, so it now counts for as little
   * as the boost it would have justified.
   *
   * Absent means one everywhere, which is how every synthetic frame and every
   * test predating this behaves.
   */
  presenceGate?: Float64Array;
  /**
   * What each range TYPICALLY does on this record, on the plot own axis.
   *
   * Where the presence lines place themselves from. Distinct from liveDb, which
   * is this second: this one moves at a tenth of a decibel a second, so it
   * describes the album rather than the bar. See PRESENCE_TYPICAL_DB_PER_S for
   * why that rate is the whole point.
   */
  typicalDb: Float64Array;
  frames: number;
  acceptedFrames: number;
  listenedMs: number;
  lastTimestampMs: number;
  checkpoint:
    { probe: Float64Array; holds: number; atListenedMs: number } | undefined;
  bestWeakest: number;
  bestWeakestAtMs: number;
  bestMean: number;
  bestMeanAtMs: number;
}

export interface IBalanceRegionReport {
  label: string;
  lowFrequency: number;
  highFrequency: number;
  /** Geometric centre, which is where the region's level is taken to apply. */
  centreFrequency: number;
  /**
   * What this range came out at, in dB relative to the frame's own mean level.
   *
   * The whole range as one number: a weighted mean over every frame that had
   * energy here, with `standardErrorDb` saying how much to believe it.
   *
   * Nothing corrects from these — see the note above `buildBalanceResult` for
   * why that was tried and undone. They are here because a report describing a
   * range without saying what it came out at is a report missing its answer,
   * and because the panel and the tests read them.
   */
  levelDb: number;
  /**
   * What this range is doing right now, on the plot's own axis.
   *
   * Not a session average like `levelDb` — this is the last second or so, which
   * is the only timescale on which "the bass guitar has stopped playing" is a
   * meaningful statement. Compared against the presence lines somebody has set
   * on the graph, and expressed the way the graph expresses everything so the
   * comparison means what it looks like.
   */
  liveDb: number;
  /** The same level followed slowly, which is where the lines place
   * themselves from. See PRESENCE_TYPICAL_DB_PER_S. */
  typicalDb: number;
  weight: number;
  standardErrorDb: number;
  confidence: number;
  isCovered: boolean;
}

export type BalanceCaptureStatus = 'listening' | 'ready' | 'partial';

export interface IBalanceReport {
  samples: ISpectrumSample[];
  regions: IBalanceRegionReport[];
  /** Confidence of the WEAKEST region — "all frequencies heard" is a minimum,
   * not an average, and showing the minimum explains why it is still going. */
  coverage: number;
  /** Mean region confidence. Used only for stall detection. */
  meanCoverage: number;
  weakest: IBalanceRegionReport | undefined;
  listenedMs: number;
  frames: number;
  isConverged: boolean;
  isStalled: boolean;
  status: BalanceCaptureStatus;
}

export interface IBalanceResult {
  samples: ISpectrumSample[];
  status: 'ready' | 'partial';
  lowFrequency: number;
  highFrequency: number;
  /**
   * The ranges as they stood when the measurement finished.
   *
   * Carried so a one-shot can be held to the same presence rule as the
   * continuous modes. A single press is if anything MORE exposed to it: there
   * is no second pass to notice that a range was silent and take the boost back
   * again, so whatever it decides during a quiet intro is what somebody lives
   * with until they press it again.
   */
  regions: IBalanceRegionReport[];
}

/** Per-region coverage, for drawing the measurement onto the response graph. */
export interface IBalanceProgressRegion {
  label: string;
  lowFrequency: number;
  highFrequency: number;
  centreFrequency: number;
  confidence: number;
  isCovered: boolean;
  /**
   * What this range is doing right now, on the plot's own axis.
   *
   * Carried into the picture so the presence rule can be SHOWN rather than
   * explained. Two lines on their own describe a rule and leave somebody to
   * imagine where the sound is in relation to them; a mark at this level, drawn
   * between them, is the same rule with nothing left to imagine.
   */
  liveDb: number;
  /**
   * The same level followed slowly, which is where this range's lines place
   * themselves from. See `PRESENCE_TYPICAL_DB_PER_S`.
   */
  typicalDb: number;
  /** How much evidence this range holds — see `REGION_ACTIVE_WEIGHT` for the
   * one thing the readout does with it. */
  weight: number;
}

export interface IBalanceProgress {
  /**
   * 0..100. Monotone during a one-shot, where it is progress toward an answer
   * and must never count backwards; live under the continuous modes, where it
   * is the state of nine independent ranges and has no destination.
   */
  percent: number;
  weakestLabel: string;
  isSettling: boolean;
  isSilent: boolean;
  isPaused: boolean;
  listenedMs: number;
  /** Ordered low to high, so the graph can draw them along its x axis. */
  regions: IBalanceProgressRegion[];
}

/** Regions clipped to the axis. Regions holding no axis point are dropped. */
export const createBalanceRegions = (
  axis: readonly number[],
): IBalanceRegion[] => {
  const regions: IBalanceRegion[] = [];

  for (let index = 0; index < BALANCE_REGION_EDGES.length - 1; index += 1) {
    const lowFrequency = BALANCE_REGION_EDGES[index];
    const highFrequency = BALANCE_REGION_EDGES[index + 1];
    let firstIndex = -1;
    let lastIndex = -1;

    axis.forEach((frequency, axisIndex) => {
      const isLast = index === BALANCE_REGION_EDGES.length - 2;
      const inRegion =
        frequency >= lowFrequency &&
        (isLast ? frequency <= highFrequency : frequency < highFrequency);
      if (!inRegion) {
        return;
      }
      if (firstIndex === -1) {
        firstIndex = axisIndex;
      }
      lastIndex = axisIndex;
    });

    if (firstIndex !== -1) {
      regions.push({
        label: BALANCE_REGION_LABELS[index],
        lowFrequency,
        highFrequency,
        firstIndex,
        lastIndex,
        centreFrequency: Math.sqrt(lowFrequency * highFrequency),
      });
    }
  }

  return regions;
};

export const createBalanceCaptureState = (
  axis: readonly number[],
  /**
   * How long evidence keeps its full weight, for a capture that never ends.
   * Absent means never forget, which is right for a measurement that stops of
   * its own accord — see `CONTINUOUS_HALF_LIFE_MS`.
   */
  halfLifeMs?: number,
): IBalanceCaptureState => {
  const regions = createBalanceRegions(axis);
  return {
    axis: [...axis],
    halfLifeMs,
    regions,
    power: new Float64Array(axis.length),
    weight: new Float64Array(axis.length),
    regionStates: regions.map(() => ({ weight: 0, mean: 0, m2: 0 })),
    // Starts below anything real, so a range is absent until a frame says
    // otherwise rather than being trusted before it has been heard at all.
    liveDb: new Float64Array(regions.length).fill(PRESENCE_SILENT_DB),
    typicalDb: new Float64Array(regions.length).fill(PRESENCE_SILENT_DB),
    frames: 0,
    acceptedFrames: 0,
    listenedMs: 0,
    lastTimestampMs: 0,
    checkpoint: undefined,
    bestWeakest: 0,
    bestWeakestAtMs: 0,
    bestMean: 0,
    bestMeanAtMs: 0,
  };
};

/**
 * Forget what one region has heard, because the chain under it just changed.
 *
 * This is what lets Continuous EQ correct one frequency range without
 * disturbing the others. The capture measures the output *including* whatever
 * correction is applied, so the moment a range is corrected everything already
 * averaged for that range describes a chain that no longer exists — and a solve
 * built on it would ask for the same correction a second time, and a third.
 * Clearing the range is the only honest answer, and clearing only that range is
 * what keeps the other eight accumulating undisturbed while it refills.
 *
 * The convergence probe goes too. It is sampled across the whole axis, so it is
 * stale the moment any part of the axis is.
 *
 * The tilt fit that runs over the whole spectrum still needs a wide trusted
 * span, and a freshly cleared range simply carries no confidence until it
 * refills — so a solve taken while the midrange is empty declines to answer at
 * all rather than fitting a slope through a hole. That is a cycle skipped, not
 * a wrong correction.
 */
export const resetBalanceRegion = (
  state: IBalanceCaptureState,
  regionIndex: number,
): void => {
  const region = state.regions[regionIndex];
  if (!region) {
    return;
  }
  for (let index = region.firstIndex; index <= region.lastIndex; index += 1) {
    state.power[index] = 0;
    state.weight[index] = 0;
  }
  state.regionStates[regionIndex] = { weight: 0, mean: 0, m2: 0 };
  state.checkpoint = undefined;
};

/**
 * How long evidence takes to lose half its weight, for a capture that never
 * ends.
 *
 * THE ACCUMULATOR WAS BUILT FOR A MEASUREMENT THAT STOPS. Four to twenty-five
 * seconds, everything weighted equally, and at the end an answer — for which
 * adding weight forever is not merely acceptable but correct.
 *
 * Continuous EQ then ran the same accumulator for hours, and the arithmetic
 * turns against it: after a few minutes the summed weight is so large that a
 * new frame moves the average by almost nothing. The measurement freezes at
 * whatever it heard early on and stops responding to the room, the record, or
 * anything else. Corrected ranges are cleared and recover; ranges that were
 * already right are never cleared, so they never recover — and once everything
 * is inside the deadband, nothing is cleared again and the whole thing is stuck
 * for good, still reporting confidently.
 *
 * A half-life fixes it in one line of arithmetic: old evidence fades, so the
 * estimate is always of roughly the last couple of minutes rather than of
 * everything since the mode was switched on. Confidence fades with it, which is
 * the right second-order effect — a range that stops being heard stops being
 * correctable rather than staying trusted on the strength of an old
 * measurement.
 *
 * Forty-five seconds, against a couple of seconds to reach coverage and twenty
 * between corrections: long enough that a correction is decided on far more
 * than one passage, short enough that a change of record is reflected within a
 * few minutes.
 *
 * Measured in LISTENED time, like every other clock here, so an evening with
 * the music paused does not age anything.
 */
export const CONTINUOUS_HALF_LIFE_MS = 45000;

/** Power mean of `levels` over an inclusive index range, in dB. */
const regionLevelDb = (
  levels: Float64Array,
  firstIndex: number,
  lastIndex: number,
): number => {
  let power = 0;
  let count = 0;
  for (let index = firstIndex; index <= lastIndex; index += 1) {
    const level = levels[index];
    if (Number.isFinite(level)) {
      power += 10 ** (level / 10);
      count += 1;
    }
  }
  return count > 0 ? 10 * Math.log10(power / count) : Number.NaN;
};

/**
 * Fold one frame into the state. Mutates and returns `state` so a test can
 * drive it with `Array.reduce` over synthetic frames.
 *
 * Energy is accumulated in the power domain, not in dB. An arithmetic mean of
 * dB values is the logarithm of the *geometric* mean, which under-reads
 * variable content — exactly the material this feature exists for.
 */
export const accumulateBalanceFrame = (
  state: IBalanceCaptureState,
  frame: IBalanceFrame,
): IBalanceCaptureState => {
  /*
   * THE RECORD, THROUGH THE ONE LAYER THAT IS TRYING TO FIX IT.
   *
   * The capture is a loopback, so what arrives is the output: the record with
   * every layer already on it. Neither taking that at face value nor stripping
   * it back to nothing is right, and the reasons pull in opposite directions.
   *
   * Measuring the whole output is blind to a cut. Crush 6.5 kHz by 20 dB and the
   * evidence that the cut is wrong goes with it — the range never gathers enough
   * to act on, so the measurement waits on it for the rest of the evening, and
   * the bigger the mistake the more thoroughly it hides. It also cannot tell a
   * fault from a decision, so every deliberate layer has to be handed back as a
   * list of exceptions to excuse, which is a list that was wrong about at least
   * one entry at every point in this file's history.
   *
   * Subtracting the whole chain fixes that and breaks something worse: it opens
   * the loop. A correction that cannot hear its own result cannot check it.
   * Every error in the filter model, in this subtraction, in the analyser's own
   * response would land in the sound and stay there uncontested, because nothing
   * downstream ever measures the consequence.
   *
   * So `chainGainDb` carries everything EXCEPT the Smart EQ layer. What is left
   * after the subtraction is the record plus the correction so far, which is
   * exactly the quantity worth having: how far the sound still is from where it
   * belongs, given everything already done about it. Cuts made by the user no
   * longer hide anything, because they are gone from the measurement; cuts made
   * by the correction are still audible to it, because they are the thing being
   * verified.
   *
   * Re-read every frame, because a continuous session changes the chain
   * underneath itself every time it corrects something.
   *
   * Reconstruction is not resurrection. A point at the analyser's floor carries
   * no information and adding gain to it would manufacture a spectrum out of
   * dither, so those are dropped rather than compensated — which is the one
   * thing subtraction genuinely cannot get back.
   */
  const { levels } = frame;
  let gateLevels = levels;
  let gatePeakDb = frame.peakDb;
  if (state.chainGainDb) {
    if (!state.sourceLevels || state.sourceLevels.length !== levels.length) {
      state.sourceLevels = new Float64Array(levels.length);
    }
    const source = state.sourceLevels;
    let peak = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < levels.length; index += 1) {
      const level = levels[index];
      if (!Number.isFinite(level) || level < ABS_FLOOR_DBFS) {
        source[index] = Number.NaN;
      } else {
        source[index] = level - (state.chainGainDb[index] ?? 0);
        if (source[index] > peak) {
          peak = source[index];
        }
      }
    }
    gateLevels = source;
    if (Number.isFinite(peak)) {
      gatePeakDb = peak;
    }
  }

  // Loud enough to trust, asked of the record. A chain that has turned
  // everything down does not make the music silent, and frames rejected as
  // silence because of the user's own attenuation are frames the correction
  // never gets to learn from.
  const w = clamp01(
    (gatePeakDb - FRAME_MIN_PEAK_DBFS) /
      (FRAME_FULL_PEAK_DBFS - FRAME_MIN_PEAK_DBFS),
  );

  state.frames += 1;
  const rawDelta = frame.timestampMs - state.lastTimestampMs;
  // A starved renderer must not be able to claim minutes of listening from one
  // late tick.
  const dt =
    state.frames === 1 ? 0 : clamp(rawDelta, 0, BALANCE_FRAME_INTERVAL_MS * 3);
  state.lastTimestampMs = frame.timestampMs;

  if (w <= 0) {
    // Silence buys no listened time.
    return state;
  }

  // The frame's own mean-power level is the reference. It is the
  // minimum-variance choice, and the tilt fit plus centring absorb the
  // constant, so using it changes nothing downstream except the noise.
  let refPower = 0;
  let refCount = 0;
  for (let index = 0; index < levels.length; index += 1) {
    const level = levels[index];
    if (Number.isFinite(level)) {
      refPower += 10 ** (level / 10);
      refCount += 1;
    }
  }
  if (refCount === 0) {
    return state;
  }
  const refDb = 10 * Math.log10(refPower / refCount);
  if (!Number.isFinite(refDb)) {
    return state;
  }

  // Age what is already here before adding to it.
  //
  // Everything is scaled by the same factor, so every mean is untouched and
  // only the confidence behind it shrinks — which is exactly the claim being
  // made: the estimate still says what it said, it is simply less sure of it
  // than it was a minute ago. See `CONTINUOUS_HALF_LIFE_MS`.
  if (state.halfLifeMs && dt > 0) {
    const keep = 0.5 ** (dt / state.halfLifeMs);
    for (let index = 0; index < state.power.length; index += 1) {
      state.power[index] *= keep;
      state.weight[index] *= keep;
    }
    state.regionStates.forEach((region) => {
      /* eslint-disable no-param-reassign */
      region.weight *= keep;
      region.m2 *= keep;
      /* eslint-enable no-param-reassign */
    });
  }

  state.listenedMs += dt;
  state.acceptedFrames += 1;

  /*
   * IS THIS RANGE PLAYING AT ALL — a different question from every other one
   * here, and the one that was missing.
   *
   * A range is measured if it sits within 45 dB of the frame peak, which a solo
   * passage clears easily. So a guitar intro with no bass instrument in it reads
   * as a record with no bass and the correction answers by boosting: measured on
   * a synthetic solo guitar, every mode drove 40 Hz and 50 Hz to their +6 dB
   * limit, where the same material inside a full mix is CUT by two to four.
   *
   * That gate cannot simply be tightened, because music's own tilt spans about
   * 25 dB and a threshold tight enough to catch a missing bass guitar throws
   * away the real air of acoustic material. No single number against the frame
   * peak separates "quiet because nothing is playing there" from "quiet because
   * that is what this range does".
   *
   * So each range is followed on its own, against the record's recent peak, and
   * expressed exactly as the plot expresses it — see `PRESENCE_FULL_SCALE_DB`.
   * Which is what makes the lines on the graph mean what they appear to mean.
   */
  // The record's peak, not the output's, for the same reason the levels below
  // are the record's: a reference that contains the correction moves when the
  // correction does, and everything referenced to it moves with it.
  const peak = gatePeakDb;
  if (Number.isFinite(peak)) {
    const released =
      state.trackReferenceDb === undefined
        ? peak
        : state.trackReferenceDb - (dt / 1000) * PRESENCE_RELEASE_DB_PER_S;
    state.trackReferenceDb = Math.max(peak, released);
  }
  const reference = state.trackReferenceDb;

  state.regions.forEach((region, regionIndex) => {
    const absDb = regionLevelDb(levels, region.firstIndex, region.lastIndex);
    /*
     * THE PRESENCE LINE ASKS ABOUT THE RECORD, NOT ABOUT WHAT WE DID TO IT.
     *
     * Taken from the output, this measured itself. Boost a range, its level in
     * the output rises, its typical level follows, its floor rises with it, and
     * more boost fits underneath — a loop with the correction inside it, which
     * on screen is a red line drifting up and down for no reason anybody can
     * point at. That is the report this fixes, and it is the same fault the
     * evidence gate a few lines below was already written to avoid.
     *
     * So it reads the reconstructed source, exactly as that gate does: the
     * question "is anything playing here" is about the music, and the chain is
     * not the music.
     */
    const sourceDb = regionLevelDb(
      gateLevels,
      region.firstIndex,
      region.lastIndex,
    );

    // Followed whether or not the range is accumulated below. A range under the
    // absolute floor has not stopped existing — it has gone quiet, which is the
    // single most important thing this is here to notice, and returning early
    // before recording it would leave the detector believing whatever it last
    // saw for as long as the silence lasted.
    if (reference !== undefined) {
      const chartDb = Number.isFinite(sourceDb)
        ? sourceDb - reference + PRESENCE_FULL_SCALE_DB
        : PRESENCE_SILENT_DB;
      const previous = state.liveDb[regionIndex];
      // Straight up, and down at a rate. A transient reaches its true height
      // whatever its length, which is what stops the top of the spectrum being
      // read fifteen decibels low — see `PRESENCE_LEVEL_RELEASE_DB_PER_S`.
      const live =
        previous <= PRESENCE_SILENT_DB || chartDb >= previous
          ? chartDb
          : Math.max(
              chartDb,
              previous - (dt / 1000) * PRESENCE_LEVEL_RELEASE_DB_PER_S,
            );
      state.liveDb[regionIndex] = live;

      /*
       * And the same level again, followed far more slowly.
       *
       * The lines place themselves from this rather than from the live value,
       * which is the difference between "this range is quiet on this record"
       * and "this range is quiet in this bar". Only the first is a reason to
       * move a threshold; acting on the second is how a follower talks itself
       * into believing silence.
       *
       * Rate-limited rather than smoothed, so the bound is a real one: a
       * passage of any length can move this by at most a tenth of a decibel
       * per second of it, and no amount of loudness or quiet can move it faster
       * than that. An exponential average has no such guarantee — a long enough
       * extreme drags it anywhere.
       *
       * Silence does not pull it down. A range at the silent floor says nothing
       * about what the record typically does there; it says the instrument
       * stopped, which is the one case this must not learn from.
       */
      const typical = state.typicalDb[regionIndex];
      if (live > PRESENCE_SILENT_DB) {
        const step = (dt / 1000) * PRESENCE_TYPICAL_DB_PER_S;
        state.typicalDb[regionIndex] =
          typical <= PRESENCE_SILENT_DB
            ? live
            : typical + clamp(live - typical, -step, step);
      }
    }

    if (!Number.isFinite(absDb) || absDb < ABS_FLOOR_DBFS) {
      return;
    }

    /*
     * THE GATE ASKS ABOUT THE RECORD; EVERYTHING ELSE MEASURES THE OUTPUT.
     *
     * Two different questions, and running both off the same numbers gets one
     * of them wrong whichever way it is done.
     *
     * What to correct is a question about the output, because the output is
     * what anybody hears. Whether a range CAN be corrected is a question about
     * the record, and asking it of the output is self-concealing: cut 6.5 kHz
     * by 20 dB and the evidence that the cut is wrong goes down with it, so the
     * range never gathers enough to act on and the measurement waits on it for
     * the rest of the evening. The louder the mistake, the more completely it
     * hides.
     *
     * So the gate runs on the reconstructed record — the capture with the chain
     * removed, see `chainGainDb` — and the level that is accumulated below is
     * the measured output, untouched.
     */
    const gateDb = regionLevelDb(
      gateLevels,
      region.firstIndex,
      region.lastIndex,
    );
    const e = clamp01(
      (gateDb - (gatePeakDb - REGION_FLOOR_DB)) / REGION_FLOOR_RAMP_DB,
    );
    if (e <= 0) {
      return;
    }
    // What this range has earned the right to teach, which is the same number
    // that bounds what it may be given. A silent range now fills its evidence
    // as slowly as it would have been corrected — see `presenceGate`.
    const gate = state.presenceGate
      ? clamp01(state.presenceGate[regionIndex])
      : 1;
    if (gate <= 0) {
      return;
    }
    const ww = w * e * gate;

    // Weighted Welford, so the standard error is available without keeping
    // every frame.
    const x = clamp(absDb - refDb, LEVEL_CLAMP_LO, LEVEL_CLAMP_HI);
    const s = state.regionStates[regionIndex];
    s.weight += ww;
    const delta = x - s.mean;
    s.mean += (ww / s.weight) * delta;
    s.m2 += ww * delta * (x - s.mean);

    for (let index = region.firstIndex; index <= region.lastIndex; index += 1) {
      const level = levels[index];
      if (Number.isFinite(level)) {
        const rel = clamp(level - refDb, LEVEL_CLAMP_LO, LEVEL_CLAMP_HI);
        state.power[index] += ww * 10 ** (rel / 10);
        state.weight[index] += ww;
      }
    }
  });

  return state;
};

/** True when enough listened time has passed to re-evaluate. */
export const isBalanceCheckDue = (state: IBalanceCaptureState): boolean =>
  state.checkpoint === undefined
    ? state.listenedMs > 0
    : state.listenedMs - state.checkpoint.atListenedMs >= CONVERGENCE_CHECK_MS;

/**
 * How long a capture may listen for, when the caller wants something other
 * than the defaults.
 *
 * Continuous EQ is the reason this is a parameter. It takes short looks rather
 * than one long one, so that a frequency range heard clearly in the first few
 * seconds is corrected in the first few seconds instead of waiting on a range
 * that needs twenty — the solver already leaves an untrusted band exactly where
 * it is, so a short look corrects what it heard and says nothing about the
 * rest. Over several looks the ranges come in as they are heard, which is what
 * makes the correction arrive across the spectrum in parallel rather than all
 * at the end.
 */
export interface IBalanceListenBounds {
  minListenMs?: number;
  maxListenMs?: number;
}

/**
 * Score the capture so far: per-region confidence, the averaged spectrum, and
 * whether we can stop. Mutates the convergence bookkeeping on `state`.
 */
export const evaluateBalanceCapture = (
  state: IBalanceCaptureState,
  {
    minListenMs = MIN_LISTEN_MS,
    maxListenMs = MAX_LISTEN_MS,
  }: IBalanceListenBounds = {},
): IBalanceReport => {
  const regions: IBalanceRegionReport[] = state.regions.map((region, index) => {
    const s = state.regionStates[index];
    const variance = s.weight > 0 ? s.m2 / s.weight : 0;
    const standardErrorDb = Math.sqrt(
      variance / Math.max(s.weight * EFFECTIVE_FRAME_RATIO, 1),
    );
    const evidence = clamp01(s.weight / REGION_TARGET_WEIGHT);
    // Two observations cannot support a variance estimate, so a region with
    // less than that is untrusted regardless of how it looks.
    const precision =
      s.weight >= 2
        ? clamp01(REGION_SE_TARGET_DB / Math.max(standardErrorDb, 1e-6))
        : 0;
    const confidence = Math.min(evidence, precision);
    return {
      label: region.label,
      lowFrequency: region.lowFrequency,
      highFrequency: region.highFrequency,
      centreFrequency: region.centreFrequency,
      levelDb: s.mean,
      liveDb: state.liveDb[index],
      typicalDb: state.typicalDb[index],
      weight: s.weight,
      standardErrorDb,
      confidence,
      isCovered: confidence >= REGION_COVERED_CONFIDENCE,
    };
  });

  const confidenceCurve: ISpectrumSample[] = state.regions.map(
    (region, index) => ({
      frequency: region.centreFrequency,
      level: regions[index].confidence,
    }),
  );

  const samples: ISpectrumSample[] = state.axis.map((frequency, index) => {
    const weight = state.weight[index];
    return {
      frequency,
      // A point with no weight still has to stay in the array with a finite
      // level: dropping it would let sampleSpectrumAt clamp a never-heard band
      // to the nearest measured one.
      level: weight > 0 ? 10 * Math.log10(state.power[index] / weight) : 0,
      confidence:
        weight > 0 ? clamp01(sampleSpectrumAt(confidenceCurve, frequency)) : 0,
    };
  });

  const coverage =
    regions.length > 0
      ? regions.reduce(
          (lowest, region) => Math.min(lowest, region.confidence),
          1,
        )
      : 0;
  const meanCoverage =
    regions.length > 0
      ? regions.reduce((total, region) => total + region.confidence, 0) /
        regions.length
      : 0;
  const weakest = regions.reduce<IBalanceRegionReport | undefined>(
    (lowest, region) =>
      lowest === undefined || region.confidence < lowest.confidence
        ? region
        : lowest,
    undefined,
  );

  // Convergence is judged on the quantity that actually becomes the gains. A
  // section change shifts the whole tilt, which the fit removes entirely, so
  // testing the raw spectrum would refuse to ever settle on real music.
  const usable = samples.filter(
    (sample) =>
      sample.frequency >= BALANCE_MIN_FREQUENCY &&
      sample.frequency <= BALANCE_MAX_FREQUENCY,
  );
  const { slope, intercept } = fitSpectralTilt(usable);
  const deviation = smoothSpectrum(
    usable.map((sample) => ({
      frequency: sample.frequency,
      level: sample.level - (slope * Math.log10(sample.frequency) + intercept),
      confidence: sample.confidence,
    })),
    DEFAULTS.smoothingOctaves,
  );
  const probe = new Float64Array(state.regions.length);
  state.regions.forEach((region, index) => {
    probe[index] = sampleSpectrumAt(deviation, region.centreFrequency);
  });

  let holds = 0;
  if (state.checkpoint) {
    const covered = regions
      .map((region, index) => ({ region, index }))
      .filter((entry) => entry.region.isCovered);
    const drift =
      covered.length > 0
        ? covered.reduce(
            (highest, entry) =>
              Math.max(
                highest,
                Math.abs(
                  probe[entry.index] -
                    (state.checkpoint as { probe: Float64Array }).probe[
                      entry.index
                    ],
                ),
              ),
            0,
          )
        : Infinity;
    holds = drift <= CONVERGENCE_TOLERANCE_DB ? state.checkpoint.holds + 1 : 0;
  }
  state.checkpoint = { probe, holds, atListenedMs: state.listenedMs };
  const isConverged = holds >= CONVERGENCE_HOLDS;

  if (coverage > state.bestWeakest + STALL_IMPROVEMENT) {
    state.bestWeakest = coverage;
    state.bestWeakestAtMs = state.listenedMs;
  }
  if (meanCoverage > state.bestMean + STALL_IMPROVEMENT) {
    state.bestMean = meanCoverage;
    state.bestMeanAtMs = state.listenedMs;
  }
  const isStalled =
    state.listenedMs >= minListenMs &&
    coverage < REGION_COVERED_CONFIDENCE &&
    state.listenedMs - state.bestWeakestAtMs >= STALL_GRACE_MS &&
    state.listenedMs - state.bestMeanAtMs >= STALL_GRACE_MS;

  // Order matters. The goal is tested before the ceiling so a capture that
  // reaches full coverage on its very last allowed frame is reported as the
  // good measurement it is, rather than being downgraded by the backstop.
  const meetsGoal = isConverged && coverage >= REGION_COVERED_CONFIDENCE;
  let status: BalanceCaptureStatus;
  if (state.listenedMs < minListenMs) {
    status = 'listening';
  } else if (meetsGoal) {
    status = 'ready';
  } else if (state.listenedMs >= maxListenMs) {
    status = 'partial';
  } else if (isConverged && isStalled) {
    // Only a settled measurement may be declared band-limited; otherwise a
    // quiet passage would masquerade as a missing frequency range.
    status = 'partial';
  } else {
    status = 'listening';
  }

  return {
    samples,
    regions,
    coverage,
    meanCoverage,
    weakest,
    listenedMs: state.listenedMs,
    frames: state.frames,
    isConverged,
    isStalled,
    status,
  };
};

export const shouldFinishBalanceCapture = (report: IBalanceReport): boolean =>
  report.status !== 'listening';

/*
 * THE MEASUREMENT AS NINE NUMBERS, AND WHY IT IS NOT HERE ANY MORE.
 *
 * There was a `buildRegionSpectrum` in this spot, turning the report into one
 * point per frequency range so the continuous modes could correct a range's
 * overall level rather than the detail inside it. Sturdier by construction: a
 * range level is a weighted mean over every frame that had energy in it, where
 * a point of the smoothed curve is one FFT bin averaged with its neighbours.
 *
 * It was also too blind to be useful. A resonance sits *inside* a range, so the
 * average smears it into that range's own level and there is nothing left to
 * correct — and the difference turned out to be audible, with the one-shot
 * measurement, which never used ranges, the one people prefer the sound of.
 *
 * The regions still decide WHEN a range may be corrected, through coverage and
 * confidence. They no longer decide what the correction is.
 */

export const buildBalanceResult = (report: IBalanceReport): IBalanceResult => {
  const covered = report.regions.filter((region) => region.isCovered);
  return {
    samples: report.samples,
    status: report.status === 'ready' ? 'ready' : 'partial',
    lowFrequency: covered[0]?.lowFrequency ?? 0,
    highFrequency: covered[covered.length - 1]?.highFrequency ?? 0,
    regions: report.regions,
  };
};

export const buildBalanceProgress = (
  report: IBalanceReport,
  previousPercent: number,
  flags: { isSilent: boolean; isPaused: boolean; isContinuous?: boolean },
): IBalanceProgress => {
  const isSettling =
    report.coverage >= REGION_COVERED_CONFIDENCE && !report.isConverged;
  // The weakest region for a one-shot, the average of them for a continuous
  // mode, and the difference is not cosmetic.
  //
  // "All frequencies heard" is a minimum, and a measurement that has to finish
  // is right to report the range holding it up. Nine ranges running
  // independently have nothing holding them up: each is corrected the moment it
  // alone has been heard. Reporting the minimum there hands the whole readout to
  // whichever range the music never reaches — one quiet top end and it says 0%
  // for the evening while everything else fills, corrects, and fills again.
  const heard = Math.round(
    (flags.isContinuous ? report.meanCoverage : report.coverage) * 100,
  );
  // Monotone for the one-shot: coverage dips when a new region starts
  // contributing, and a progress bar that counts backwards on its way to an
  // answer reads as a malfunction.
  //
  // NOT monotone for the continuous modes, where the same rule froze the
  // readout. Coverage there is a live state and not a journey: correcting a
  // range clears its evidence deliberately, and the half-life takes the rest
  // back when the music stops feeding it. Both are the number falling for a
  // good reason. Clamped, it reached 100 within a minute of the first track and
  // stayed there for the evening, over a row of full bars, next to the words
  // "needs deep bass" — a readout that was wrong, stuck, and arguing with itself
  // at the same time.
  const percent = (() => {
    if (flags.isContinuous) {
      return heard;
    }
    if (report.status !== 'listening') {
      return 100;
    }
    return Math.min(99, Math.max(previousPercent, heard));
  })();
  return {
    percent,
    // Named only while it is actually short. A covered region is not something
    // the measurement still needs, and saying it needed one at 100% was the
    // contradiction on screen.
    weakestLabel:
      isSettling || report.weakest?.isCovered
        ? ''
        : (report.weakest?.label ?? ''),
    isSettling,
    isSilent: flags.isSilent,
    isPaused: flags.isPaused,
    listenedMs: report.listenedMs,
    regions: report.regions.map((region) => ({
      label: region.label,
      lowFrequency: region.lowFrequency,
      highFrequency: region.highFrequency,
      confidence: region.confidence,
      isCovered: region.isCovered,
      weight: region.weight,
      liveDb: region.liveDb,
      typicalDb: region.typicalDb,
      centreFrequency: region.centreFrequency,
    })),
  };
};

/**
 * What the continuous modes are doing, which is several things at once.
 *
 * Its own describer rather than the one-shot's, because the two measurements
 * have a different shape and the sentence has to match. A one-shot converges as
 * a whole and is over when it is over, so naming the single range holding it up
 * is exactly the useful thing to say. The continuous modes never converge and
 * never finish: every range fills at its own rate, is corrected the moment it
 * alone has been heard, and is cleared on its own so it can start again while
 * its neighbours carry on undisturbed. At any moment several are mid-flight and
 * the rest are covered.
 *
 * Borrowing the one-shot's sentence for it named one of those and implied it was
 * the only one, and — because `weakest` is the least confident region rather
 * than a short one — went on naming it after everything was covered, so the
 * bubble asked for deep bass while nothing anywhere was moving.
 *
 * Ranges still filling, all of them, capped so it stays a sentence. Empty when
 * none are, which is the ordinary steady state: everything heard, nothing far
 * enough out to touch, still listening.
 */
/*
 * -------------------------------------------------------------------------
 * Saying it, in the language the app is in
 * -------------------------------------------------------------------------
 *
 * EVERY SENTENCE BELOW IS BUILT FROM PARTS, AND NONE OF THEM IS BUILT FROM
 * TRANSLATED PARTS.
 *
 * The difference is the whole reason this section exists. "Lifted air, eased
 * bass" is a verb, a range name and a separator, and the obvious way to
 * translate it — look up the verb, look up the noun, put a space between them —
 * produces a sentence that is wrong in most languages and in a way nobody who
 * only reads English will ever see. Spanish and Italian make the participle
 * agree with the noun's gender; German and Russian want it in a case the noun
 * is not in; Japanese puts the verb last. There is no ordering of two
 * separately-translated fragments that is right in all ten.
 *
 * So the clause is the unit. `eq.smart.shape.lifted` is a whole phrase with the
 * range in a placeholder, and each dictionary decides where the range goes and
 * what surrounds it — several of them deliberately phrase it as a label with a
 * colon so the noun can stay in its dictionary form, because a placeholder
 * cannot be declined.
 *
 * The range names are still their own keys, because they are also said alone,
 * in a list, after "waiting on". Even the comma is a key: a list of nouns is
 * separated by an ideographic comma in Chinese and Japanese.
 *
 * `t` is passed in rather than reached for. These functions are pure — a test
 * drives them with a translator bound to whatever locale it wants to assert
 * against — and the caller is a component that already has one.
 */

/**
 * The translation key for a region, from the label the capture carries.
 *
 * `BALANCE_REGION_LABELS` stays English on purpose: those strings are
 * identifiers. They key the flash store, they are React keys on the coverage
 * columns, and a test asserts on them. Translating them at the source would
 * turn every one of those into something that changes with the menu.
 */
export const BALANCE_REGION_KEYS: Record<string, TranslationKey> = {
  'deep bass': 'eq.smart.range.deepBass',
  bass: 'eq.smart.range.bass',
  'low mids': 'eq.smart.range.lowMids',
  mids: 'eq.smart.range.mids',
  'upper mids': 'eq.smart.range.upperMids',
  presence: 'eq.smart.range.presence',
  treble: 'eq.smart.range.treble',
  'high treble': 'eq.smart.range.highTreble',
  air: 'eq.smart.range.air',
};

/** A region's name to say out loud. Unknown labels are passed through. */
export const balanceRangeName = (label: string, t: Translate): string => {
  const key = BALANCE_REGION_KEYS[label];
  return key ? t(key) : label;
};

/**
 * Sentence case, for a line assembled from clauses that are written lowercase
 * so they can also appear second and third.
 *
 * A no-op in Chinese, Japanese and Devanagari, which have no case, and correct
 * in German, where the first word of these clauses is a noun and already
 * capitalised.
 */
const asSentence = (said: string): string =>
  said ? said.charAt(0).toUpperCase() + said.slice(1) : '';

export const describeContinuousProgress = (
  progress: IBalanceProgress,
  t: Translate,
): string => {
  if (progress.isPaused) {
    return t('eq.smart.status.paused');
  }
  if (progress.isSilent) {
    return t('eq.smart.status.waitingForSound');
  }
  // Filling right now — uncovered AND actually being fed. The second half is
  // what stops the sentence going stale: a range with no content never covers,
  // so on the first test alone it stayed named forever and the bubble was frozen
  // on a request nothing was ever going to satisfy.
  const filling = progress.regions
    .filter(
      (region) => !region.isCovered && region.weight >= REGION_ACTIVE_WEIGHT,
    )
    .map((region) => region.label);
  if (filling.length === 0) {
    return t('eq.smart.status.listening');
  }
  const named = filling
    .slice(0, MAX_NAMED_RANGES)
    .map((label) => balanceRangeName(label, t))
    .join(t('eq.smart.range.separator'));
  const rest = filling.length - MAX_NAMED_RANGES;
  // "Waiting on", not "needs".
  //
  // Both mean "has not heard this range well enough yet", and only one of them
  // survives being read quickly. "Needs air" over a top end somebody has just
  // boosted by seventeen decibels reads as the app asking for more of it, which
  // is the opposite of what it means and makes the whole readout look like it is
  // not listening to the same sound the user is.
  //
  // The overflow is its own key rather than a "+3" stapled onto the end of the
  // other one. Same reason as everything else here: a language that ends the
  // sentence with the verb has nowhere to staple it.
  return rest > 0
    ? t('eq.smart.status.waitingOnMore', {
        percent: progress.percent,
        ranges: named,
        count: rest,
      })
    : t('eq.smart.status.waitingOn', {
        percent: progress.percent,
        ranges: named,
      });
};

/**
 * A frequency as a listener reads it.
 *
 * The unit goes through the dictionary too, which looks like ceremony over two
 * characters until you notice that Russian writes them Гц and кГц.
 */
export const formatBalanceFrequency = (
  frequency: number,
  t: Translate,
): string =>
  frequency >= 1000
    ? t('eq.smart.frequency.khz', { value: Math.round(frequency / 100) / 10 })
    : t('eq.smart.frequency.hz', { value: Math.round(frequency) });

export const describeBalanceProgress = (
  progress: IBalanceProgress,
  t: Translate,
): string => {
  if (progress.isPaused) {
    return t('eq.smart.status.pausedResume');
  }
  if (progress.isSilent) {
    return t('eq.smart.status.pausedSilent');
  }
  if (progress.isSettling) {
    return t('eq.smart.status.settling', { percent: progress.percent });
  }
  if (!progress.weakestLabel) {
    return t('eq.smart.status.listeningPercent', { percent: progress.percent });
  }
  // "Waiting on" rather than "needs", for the reason written out in
  // `describeContinuousProgress`: this names a range the measurement has not
  // heard enough of, and "needs" reads as a request to boost it.
  return t('eq.smart.status.waitingOn', {
    percent: progress.percent,
    ranges: balanceRangeName(progress.weakestLabel, t),
  });
};

/**
 * How far a range has to average before it is worth naming, in dB.
 *
 * Under a decibel is not a thing anybody can hear on a broad band, and saying
 * it would turn a description into a readout — nine ranges all reporting a
 * fraction, none of it audible, changing every time it is looked at.
 */
export const NAMEABLE_CORRECTION_DB = 0.8;

/** At most this many, biggest first. A list of nine is not a description. */
export const MAX_NAMED_RANGES = 3;

/**
 * What a correction is actually doing, in words, from the gains it applied.
 *
 * Read off the layer rather than off the measurement, and that is the whole
 * point: the measurement is what was heard, which is a claim about the room the
 * app cannot verify, while the gains are what FluidEQ has done and can be
 * checked against the config file on disk. Nothing here is inferred, guessed or
 * rounded up to sound impressive — a range is named only if the bands inside it
 * really do average that far from zero.
 *
 * By range and not by band, because "more air" is a sentence and "+1.2 at 10k,
 * +0.9 at 12.5k, +1.4 at 8k" is a table. The ranges are the same nine the
 * measurement already reports coverage for, so the words line up with the
 * columns drawn on the graph while it listens.
 */
export const describeCorrectionShape = (
  filters: IFilter[],
  t: Translate,
): string => {
  const named = BALANCE_REGION_LABELS.map((label, index) => {
    const low = BALANCE_REGION_EDGES[index];
    const high = BALANCE_REGION_EDGES[index + 1];
    const inside = filters.filter(
      (filter) => filter.frequency >= low && filter.frequency < high,
    );
    const mean = inside.length
      ? inside.reduce((total, filter) => total + filter.gain, 0) / inside.length
      : 0;
    return { label, mean };
  })
    .filter((entry) => Math.abs(entry.mean) >= NAMEABLE_CORRECTION_DB)
    .sort((left, right) => Math.abs(right.mean) - Math.abs(left.mean))
    .slice(0, MAX_NAMED_RANGES)
    // Verbs, because this is a thing that was done rather than a column of
    // numbers. "Lifted air" is what somebody would say about it out loud; "air
    // +2.4" is what the config file already says, better.
    //
    // Past tense, and that is not a nicety. This is read off the gains of a
    // finished layer and printed next to the word that says the measurement is
    // over — "lifting air" beside "Balanced" reads as a run still going, which
    // is the one thing the sentence must not imply.
    //
    // One key per clause, not a verb glued to a noun. See the note above
    // `BALANCE_REGION_KEYS` for why that distinction is the whole of this.
    .map((entry) =>
      t(entry.mean > 0 ? 'eq.smart.shape.lifted' : 'eq.smart.shape.eased', {
        range: balanceRangeName(entry.label, t),
      }),
    );

  return asSentence(named.join(t('eq.smart.range.separator')));
};

/**
 * What the correction still owes the music, in words.
 *
 * The sibling of `describeCorrectionShape`, and the difference is which
 * question it answers. That one says what the correction adds up to, which is
 * the right thing to report at the end of a measurement. This one says what is
 * about to change, which is the right thing to report while a mode is running.
 *
 * Handed the gains the layer WOULD have — `stepSmartEqGains` against the
 * long-run destination — rather than the destination itself, and that is what
 * makes it honest. A band inside the deadband does not move, and a band already
 * at the ceiling cannot, so neither can be named: the step function has already
 * decided both, and reading its answer means this cannot promise a correction
 * that is never going to happen. It stays true for as long as the gap does,
 * which is the whole time the mode is working toward it and no longer.
 *
 * Only bands that move count toward a range's average. Averaging the still ones
 * in as zeroes is how a range with one band a long way out reported a quarter of
 * what it was about to do.
 *
 * Phrased as a need rather than as an operation. "Needs more air" is what the
 * thing is for; "lifting air" is a description of a subroutine.
 */
export const describeCorrectionNeed = (
  bands: IFilter[],
  next: Record<string, number>,
  // After the data and before the ranges, because the ranges have a default and
  // a defaulted parameter cannot come before a required one.
  t: Translate,
  regions: {
    label: string;
    lowFrequency: number;
    highFrequency: number;
  }[] = BALANCE_REGION_LABELS.map((label, index) => ({
    label,
    lowFrequency: BALANCE_REGION_EDGES[index],
    highFrequency: BALANCE_REGION_EDGES[index + 1],
  })),
): string => {
  const named = regions
    .map((region) => {
      const moving = bands
        .filter(
          (band) =>
            band.frequency >= region.lowFrequency &&
            band.frequency < region.highFrequency,
        )
        .map((band) =>
          Number.isFinite(next[band.id]) ? next[band.id] - band.gain : 0,
        )
        .filter((delta) => delta !== 0);
      const delta = moving.length
        ? moving.reduce((total, entry) => total + entry, 0) / moving.length
        : 0;
      return { label: region.label, delta };
    })
    .filter((entry) => entry.delta !== 0)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, MAX_NAMED_RANGES)
    // What is wrong, not what is being done about it. "Easing air" is a
    // description of a subroutine; "too much air" is the observation that made
    // it run, and it is the half somebody can agree or disagree with — which
    // matters, because the commonest reason to look at this is to check whether
    // the thing is hearing the same sound you are.
    .map((entry) =>
      t(entry.delta > 0 ? 'eq.smart.need.more' : 'eq.smart.need.less', {
        range: balanceRangeName(entry.label, t),
      }),
    );

  return asSentence(named.join(t('eq.smart.range.separator')));
};

export const describeBalanceResult = (
  result: IBalanceResult,
  t: Translate,
): string => {
  if (result.status === 'ready') {
    return t('eq.smart.result.fullRange');
  }
  return t('eq.smart.result.range', {
    low: formatBalanceFrequency(result.lowFrequency, t),
    high: formatBalanceFrequency(result.highFrequency, t),
  });
};
