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
  getAutoPreAmpGain,
  getCombinedResponsePeakGain,
  getResponseGainAtFrequencies,
  ICombinedResponse,
  SAMPLE_FREQUENCIES,
} from './response';

/**
 * Auto-normalize that reserves what the music needs instead of what the chain
 * could theoretically need.
 *
 * THE QUANTITY IS AN EXCESS, NOT A LEVEL, AND THAT IS THE WHOLE DESIGN.
 *
 * The obvious formulation measures how loud the programme is in dBFS and adds
 * the chain to it. It does not survive contact with an FFT: a spectral cell
 * level is not a sample peak, the two differ by the crest factor, and the crest
 * factor of music varies by more than the headroom this feature is trying to
 * recover. Any absolute comparison inherits that error whole.
 *
 * So the question asked here is a difference of two spectra instead:
 *
 *     excess = max_f [ programme(f) + chain(f) ] - max_f [ programme(f) ]
 *
 * How much louder the chain makes the programme's own peak. Both terms are in
 * the same units against the same unknown reference, so the reference cancels
 * — the analyser's absolute calibration cannot affect the answer, and neither
 * can the Windows volume slider.
 *
 * It also carries its own safety proof. Since max(a + b) <= max(a) + max(b),
 * the excess can never exceed the chain's own peak gain, which is exactly what
 * today's worst case reserves. So the adaptive preamp is bounded:
 *
 *     worst-case preamp  <=  adaptive preamp  <=  preamp for no chain at all
 *
 * It can only ever be louder than what shipped, never louder than unity, and a
 * completely wrong measurement degrades it to today's behaviour rather than to
 * distortion. See `getSmartPreAmpGain`.
 */

/**
 * What the excess is allowed to be wrong by, in dB.
 *
 * The excess is evidence about material that HAS played. A passage that
 * concentrates more of its energy at the chain's peak than anything heard so
 * far is louder than the measurement predicts, and this is the room left for
 * it.
 *
 * Three decibels rather than the 0.2 the deterministic path uses, because that
 * 0.2 protects an arithmetic identity — the chain peak is *known* — while this
 * protects an estimate. It is not the last line of defence either: the sample
 * peak supervisor sits downstream of it and answers for everything this margin
 * does not, including error in the filter model and in the analyser's own
 * response.
 */
export const SMART_HEADROOM_MARGIN_DB = 3;

/**
 * The band the capture speaks for, and the regions it reports in.
 *
 * Outside this span there is no evidence, and `programmeGainAt` deliberately
 * declines to claim any recovery there rather than extrapolating the nearest
 * region outwards — a 22 kHz boost is not made safe by the air band having been
 * quiet.
 *
 * DELIBERATELY NOT THE BALANCE REGIONS, which stop at 15 kHz. Those edges span
 * the band Smart EQ is willing to *correct*, which is a different question from
 * the band it can *hear*, and borrowing them cost most of the recovery on
 * exactly the chains this feature exists for: a 6 dB boost at 10 kHz still has
 * about 3 dB of skirt left at 15 kHz, so with everything above 15 kHz assumed
 * as loud as the loudest thing measured, a 6 dB treble boost recovered 2.9 dB
 * instead of nearly all of it. The analyser sees to Nyquist; the fix was to
 * measure the band rather than to soften the rule about not guessing.
 *
 * Ten roughly-octave regions covering the whole response grid, so the fallback
 * is reached only below 20 Hz — where the grid has four points and music has
 * no energy worth reserving for.
 */
export const SMART_HEADROOM_REGION_EDGES = [
  20, 40, 80, 160, 320, 640, 1250, 2500, 5000, 10000, 20000,
];

export const SMART_HEADROOM_MIN_FREQUENCY = SMART_HEADROOM_REGION_EDGES[0];
export const SMART_HEADROOM_MAX_FREQUENCY =
  SMART_HEADROOM_REGION_EDGES[SMART_HEADROOM_REGION_EDGES.length - 1];

/** One measured point of the programme's own spectrum. */
export interface IProgrammePoint {
  frequency: number;
  /**
   * Level in dB against an arbitrary but consistent reference. Only
   * differences between points are read, so the reference never has to be
   * established — see the excess formulation above.
   */
  gain: number;
}

const isUsablePoint = (point: IProgrammePoint): boolean =>
  Number.isFinite(point.frequency) &&
  Number.isFinite(point.gain) &&
  point.frequency > 0;

/**
 * The programme's level at one frequency, interpolated in log-frequency.
 *
 * Outside the measured points the answer is the loudest point measured
 * anywhere. That is the conservative choice and it is deliberate: it makes the
 * excess at an unmeasured frequency equal to the chain's own gain there, so an
 * unmeasured band claims no recovery at all and falls back to exactly what the
 * worst case would have reserved. Extending the nearest point outwards instead
 * would let a quiet air band pay for an ultrasonic boost.
 */
const programmeGainAt = (
  sorted: IProgrammePoint[],
  loudest: number,
  frequency: number,
): number => {
  /*
   * The edges are compared with a hair of tolerance, and it is not cosmetic.
   *
   * The response grid's last point is 10 ** (log10(20000)) recomputed through a
   * thousand steps, which lands at 20000.000000000004 — just outside a strict
   * comparison against 20 kHz. That put the top grid point in the
   * no-evidence branch, where the programme is assumed as loud as its own peak,
   * and the excess for a 6 dB boost at 10 kHz became exactly the chain's
   * remaining 1.44 dB of skirt at 20 kHz rather than nothing. A floating-point
   * hair at one grid point out of a thousand was costing a decibel and a half
   * of output on any treble-boosting chain.
   */
  const tolerance = 1 + 1e-9;
  if (
    frequency < SMART_HEADROOM_MIN_FREQUENCY / tolerance ||
    frequency > SMART_HEADROOM_MAX_FREQUENCY * tolerance
  ) {
    return loudest;
  }
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (frequency <= first.frequency) {
    return first.gain;
  }
  if (frequency >= last.frequency) {
    return last.gain;
  }
  let low = 0;
  let high = sorted.length - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (sorted[middle].frequency <= frequency) {
      low = middle;
    } else {
      high = middle;
    }
  }
  const a = sorted[low];
  const b = sorted[high];
  const span = Math.log10(b.frequency) - Math.log10(a.frequency);
  if (span <= 0) {
    return Math.max(a.gain, b.gain);
  }
  const t = (Math.log10(frequency) - Math.log10(a.frequency)) / span;
  return a.gain + (b.gain - a.gain) * t;
};

/**
 * How much the chain raises the programme's own peak, in dB.
 *
 * Negative for a chain that only cuts, which is the honest answer: such a chain
 * lowers the peak, and that headroom is as recoverable as any other.
 *
 * Evaluated on the response grid rather than on the measurement's own points,
 * because the chain is the spiky term. A high-Q boost sitting between two
 * measured points is invisible to a nine-point evaluation and would be reserved
 * for at whatever the interpolation happened to say — which is the one error
 * that makes the output louder than intended.
 */
export const getProgrammeChainExcessDb = (
  response: ICombinedResponse,
  programme: readonly IProgrammePoint[],
): number => {
  const sorted = programme
    .filter(isUsablePoint)
    .slice()
    .sort((a, b) => a.frequency - b.frequency);
  if (sorted.length === 0) {
    // Nothing heard yet. The excess is the chain's own peak, which reproduces
    // the worst case exactly — a cold start is today's behaviour, by
    // construction rather than by a special case at the caller.
    return getCombinedResponsePeakGain(response);
  }

  const loudest = sorted.reduce(
    (peak, point) => (point.gain > peak ? point.gain : peak),
    Number.NEGATIVE_INFINITY,
  );
  const chainGains = getResponseGainAtFrequencies(response, SAMPLE_FREQUENCIES);

  let peakWithChain = Number.NEGATIVE_INFINITY;
  let peakProgramme = Number.NEGATIVE_INFINITY;
  SAMPLE_FREQUENCIES.forEach((frequency, index) => {
    const chain = chainGains[index];
    const level = programmeGainAt(sorted, loudest, frequency);
    if (!Number.isFinite(chain) || !Number.isFinite(level)) {
      return;
    }
    if (level > peakProgramme) {
      peakProgramme = level;
    }
    const combined = level + chain;
    if (combined > peakWithChain) {
      peakWithChain = combined;
    }
  });

  if (!Number.isFinite(peakWithChain) || !Number.isFinite(peakProgramme)) {
    return getCombinedResponsePeakGain(response);
  }

  /*
   * The bound is enforced rather than trusted.
   *
   * It holds algebraically, but the two maxima above are taken over slightly
   * different things — the chain peak sees the curve points added to the grid,
   * this sees only the grid — and a floating-point excess a hair above the
   * chain peak would be a preamp a hair louder than the worst case is willing
   * to allow. Clamping costs nothing and makes the safety property true of the
   * code rather than of the algebra it was derived from.
   */
  const excess = peakWithChain - peakProgramme;
  const chainPeak = getCombinedResponsePeakGain(response);
  return Math.round(Math.min(excess, chainPeak) * 100) / 100;
};

/**
 * Preamp for a chain, given what the music playing through it actually is.
 *
 * `supervisorTrimDb` is the sample peak supervisor's standing correction and is
 * never positive: it only ever takes level away. It exists because everything
 * above this line is open-loop — the excess is computed from a model of the
 * filters and a measurement of the spectrum, and neither can see its own error.
 * The supervisor measures the one quantity that matters, the true output peak,
 * and answers for whatever the model got wrong. See the renderer engine for how
 * it is derived.
 */
export const getSmartPreAmpGain = (
  response: ICombinedResponse,
  programme: readonly IProgrammePoint[],
  supervisorTrimDb = 0,
): number => {
  const filters = response.filters ?? [];
  const curves = (response.curves ?? []).filter(
    (curve) => Array.isArray(curve) && curve.length > 0,
  );
  const constantGain = Number.isFinite(response.constantGain)
    ? (response.constantGain ?? 0)
    : 0;
  // An empty chain is left alone, exactly as the deterministic path leaves it.
  // Automatic normalization enabled is not a reason to attenuate a profile that
  // does nothing.
  if (filters.length === 0 && curves.length === 0 && constantGain === 0) {
    return 0;
  }
  const excess = getProgrammeChainExcessDb(
    { filters, curves, constantGain },
    programme,
  );
  const trim = Number.isFinite(supervisorTrimDb)
    ? Math.min(0, supervisorTrimDb)
    : 0;

  /*
   * NEVER QUIETER THAN THE SWITCH POSITION BELOW IT.
   *
   * The excess is bounded by the chain peak, so the estimate alone is always at
   * least as loud as the worst case — but the two margins are not the same
   * size, and 3 dB against 0.2 dB is enough to invert the result whenever the
   * measurement finds less than 2.8 dB to give back. A chain whose peak sits
   * exactly where the music does is the ordinary case for that, and it made
   * Smart the quiet option on precisely the material it could not help with.
   * Turning Smart on must never cost level; where it has nothing to offer it
   * falls back to Normalize rather than below it.
   *
   * The supervisor's trim is applied after the floor, because it answers for
   * measured output and outranks both estimates.
   */
  const worstCase = getAutoPreAmpGain({ filters, curves, constantGain });
  const estimate = -(excess + SMART_HEADROOM_MARGIN_DB);
  const gain = Math.max(estimate, worstCase) + trim;
  return Math.round(gain * 100) / 100;
};
