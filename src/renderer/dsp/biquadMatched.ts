/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FilterTypeEnum } from '../../common/constants';
import type { IBandSpec, IBiquadCoefficients } from './biquad';

/**
 * The analog-matched bands the rack's EQ plays under Treble: Precise,
 * transcribed from `native/dsp-core/src/biquad_matched.cpp` so this page
 * draws the coefficients that play rather than a formula for them.
 *
 * Martin Vicanek, "Matched Second Order Digital Filters" (2016) for the bell
 * and the pass filters, and his two-pole shelf note (2024, revised 2025) for
 * the Butterworth shelf: the analog poles kept by impulse invariance, the
 * numerator solved from the squared magnitude, the minimum-phase root taken.
 * The main graph draws the analog prototype instead (`analogGainDb` in
 * `graph/utils.ts`), which is within a few tenths of a decibel of this; the
 * rack's own graph has always evaluated coefficients, and keeps doing so.
 */

/** RBJ's S = 1 shelf, the one the two-pole design is exact for. */
const BUTTERWORTH_Q = Math.SQRT1_2;

/**
 * How far from Butterworth a shelf may be and still be matched:
 * `kButterworthTolerance`, and `BUTTERWORTH_TOLERANCE` in the main graph.
 */
const BUTTERWORTH_TOLERANCE = 0.02;

interface IDenominator {
  a1: number;
  a2: number;
  A0: number;
  A1: number;
  A2: number;
}

interface IPhis {
  phi0: number;
  phi1: number;
  phi2: number;
}

/** The analog pole pair mapped by impulse invariance, `w` per sample. */
const matchedPoles = (w: number, zeta: number): IDenominator => {
  const decay = Math.exp(-zeta * w);
  const a1 =
    zeta <= 1
      ? -2 * decay * Math.cos(w * Math.sqrt(1 - zeta * zeta))
      : -2 * decay * Math.cosh(w * Math.sqrt(zeta * zeta - 1));
  const a2 = Math.exp(-2 * zeta * w);
  return {
    a1,
    a2,
    A0: (1 + a1 + a2) * (1 + a1 + a2),
    A1: (1 - a1 + a2) * (1 - a1 + a2),
    A2: -4 * a2,
  };
};

const phisAt = (w: number): IPhis => {
  const half = Math.sin(w / 2);
  const phi1 = half * half;
  const phi0 = 1 - phi1;
  return { phi0, phi1, phi2: 4 * phi0 * phi1 };
};

/** Square roots that rounding can push a hair below zero. */
const root = (value: number): number => Math.sqrt(value > 0 ? value : 0);

/** A band at 0 dB: unity on the poles the design has beside it (`unity_on`). */
const unityOn = (a1: number, a2: number): IBiquadCoefficients => ({
  b0: 1,
  b1: a1,
  b2: a2,
  a1,
  a2,
});

/** Unity at DC, the band's gain at its centre; a cut is the boost inverted. */
const bell = (w0: number, gainDb: number, quality: number) => {
  if (gainDb === 0) {
    const flat = matchedPoles(w0, 1 / (2 * quality));
    return unityOn(flat.a1, flat.a2);
  }
  const g = 10 ** (Math.abs(gainDb) / 20);
  const d = matchedPoles(w0, 1 / (2 * quality * Math.sqrt(g)));
  const p = phisAt(w0);
  const B0 = d.A0;
  const R1 = (d.A0 * p.phi0 + d.A1 * p.phi1 + d.A2 * p.phi2) * g * g;
  const R2 = (-d.A0 + d.A1 + 4 * (p.phi0 - p.phi1) * d.A2) * g * g;
  const B2 = (R1 - R2 * p.phi1 - B0) / (4 * p.phi1 * p.phi1);
  const B1 = R2 + B0 + 4 * (p.phi1 - p.phi0) * B2;
  const W = 0.5 * (root(B0) + root(B1));
  const b0 = 0.5 * (W + root(W * W + B2));
  const boost = {
    b0,
    b1: 0.5 * (root(B0) - root(B1)),
    b2: -B2 / (4 * b0),
    a1: d.a1,
    a2: d.a2,
  };
  if (gainDb > 0) {
    return boost;
  }
  return {
    b0: 1 / boost.b0,
    b1: boost.a1 / boost.b0,
    b2: boost.a2 / boost.b0,
    a1: boost.b1 / boost.b0,
    a2: boost.b2 / boost.b0,
  };
};

const lowPass = (w0: number, quality: number): IBiquadCoefficients => {
  const d = matchedPoles(w0, 1 / (2 * quality));
  const p = phisAt(w0);
  const B0 = d.A0;
  const R1 =
    (d.A0 * p.phi0 + d.A1 * p.phi1 + d.A2 * p.phi2) * quality * quality;
  const B1 = (R1 - B0 * p.phi0) / p.phi1;
  const b0 = 0.5 * (root(B0) + root(B1));
  return { b0, b1: root(B0) - b0, b2: 0, a1: d.a1, a2: d.a2 };
};

const highPass = (w0: number, quality: number): IBiquadCoefficients => {
  const d = matchedPoles(w0, 1 / (2 * quality));
  const p = phisAt(w0);
  const b0 =
    (quality * root(d.A0 * p.phi0 + d.A1 * p.phi1 + d.A2 * p.phi2)) /
    (4 * p.phi1);
  return { b0, b1: -2 * b0, b2: b0, a1: d.a1, a2: d.a2 };
};

const bandPass = (w0: number, quality: number): IBiquadCoefficients => {
  const d = matchedPoles(w0, 1 / (2 * quality));
  const p = phisAt(w0);
  const R1 = d.A0 * p.phi0 + d.A1 * p.phi1 + d.A2 * p.phi2;
  const R2 = -d.A0 + d.A1 + 4 * (p.phi0 - p.phi1) * d.A2;
  const B2 = (R1 - R2 * p.phi1) / (4 * p.phi1 * p.phi1);
  const B1 = R2 + 4 * (p.phi1 - p.phi0) * B2;
  const b1 = -0.5 * root(B1);
  const b0 = 0.5 * (root(B2 + b1 * b1) - b1);
  return { b0, b1, b2: -b0 - b1, a1: d.a1, a2: d.a2 };
};

/**
 * The two-pole Butterworth shelf, `fc` its half-gain frequency in units of
 * Nyquist (it may exceed 1). A low shelf is the high shelf of the reciprocal
 * gain, scaled.
 */
const shelf = (
  high: boolean,
  fc: number,
  gainDb: number,
): IBiquadCoefficients => {
  const G = 10 ** (gainDb / 20);
  let g = high ? G : 1 / G;
  if (Math.abs(1 - g) < 1e-6) {
    g = 1.00001;
  }
  const fc4 = fc * fc * fc * fc;
  const hNyquist = (fc4 + g) / (fc4 + 1 / g);
  // The paper's two fitting frequencies, chosen for accuracy over fc.
  const f1 = fc / Math.sqrt(0.16 + 1.543 * fc * fc);
  const f2 = fc / Math.sqrt(0.947 + 3.806 * fc * fc);
  const hAt = (f: number) => {
    const f4 = f * f * f * f;
    return (fc4 + f4 * g) / (fc4 + f4 / g);
  };
  const h1 = hAt(f1);
  const h2 = hAt(f2);
  const s1 = Math.sin((Math.PI * f1) / 2);
  const s2 = Math.sin((Math.PI * f2) / 2);
  const p1 = s1 * s1;
  const p2 = s2 * s2;
  const d1 = (h1 - 1) * (1 - p1);
  const d2 = (h2 - 1) * (1 - p2);
  const c11 = -p1 * d1;
  const c12 = p1 * p1 * (hNyquist - h1);
  const c21 = -p2 * d2;
  const c22 = p2 * p2 * (hNyquist - h2);
  const alpha = (c22 * d1 - c12 * d2) / (c11 * c22 - c12 * c21);
  const AA1 = (d1 - c11 * alpha) / c12;
  const BB1 = hNyquist * AA1;
  const AA2 = (alpha - AA1) / 4;
  const BB2 = (alpha - BB1) / 4;
  const v = 0.5 * (1 + root(AA1));
  const w = 0.5 * (1 + root(BB1));
  const a0 = 0.5 * (v + root(v * v + AA2));
  const beta0 = 0.5 * (w + root(w * w + BB2));
  const scale = high ? 1 : G;
  return {
    b0: (beta0 / a0) * scale,
    b1: ((1 - w) / a0) * scale,
    b2: (-BB2 / (4 * beta0 * a0)) * scale,
    a1: (1 - v) / a0,
    a2: -AA2 / (4 * a0 * a0),
  };
};

const isUsable = (k: IBiquadCoefficients): boolean =>
  [k.b0, k.b1, k.b2, k.a1, k.a2].every(Number.isFinite) &&
  k.b0 !== 0 &&
  Math.abs(k.a2) < 1 &&
  Math.abs(k.a1) < 1 + k.a2;

/**
 * Whether a band has a matched design at all: bells, the pass filters, and
 * shelves at Butterworth. Everything else plays the cookbook under Precise
 * too, as `feq_biquad_coefficients_matched` and `playsAnalogMatched` say.
 */
export const hasMatchedDesign = ({
  type,
  quality,
}: Pick<IBandSpec, 'type' | 'quality'>): boolean => {
  switch (type) {
    case FilterTypeEnum.PK:
    case FilterTypeEnum.LPQ:
    case FilterTypeEnum.HPQ:
    case FilterTypeEnum.BP:
      return true;
    case FilterTypeEnum.LSC:
    case FilterTypeEnum.HSC:
      return Math.abs(quality - BUTTERWORTH_Q) <= BUTTERWORTH_TOLERANCE;
    default:
      return false;
  }
};

/**
 * The band analog-matched, or `cookbook` — the same band on the cookbook,
 * which the caller has already built — where there is no matched design for
 * its shape or the design would not be stable.
 */
const matchedCoefficients = (
  spec: IBandSpec,
  sampleRate: number,
  cookbook: IBiquadCoefficients,
): IBiquadCoefficients => {
  const { type, frequency, gainDb, quality } = spec;
  if (!(sampleRate > 0) || !(frequency > 0) || !(quality > 0)) {
    return cookbook;
  }
  if (!hasMatchedDesign(spec)) {
    return cookbook;
  }
  // The cookbook's own bound: a band at or past Nyquist has no digital
  // centre to match.
  const w0 =
    (2 * Math.PI * Math.min(frequency, sampleRate * 0.499)) / sampleRate;
  let matched: IBiquadCoefficients;
  if (type === FilterTypeEnum.PK) {
    matched = bell(w0, gainDb, quality);
  } else if (type === FilterTypeEnum.LPQ) {
    matched = lowPass(w0, quality);
  } else if (type === FilterTypeEnum.HPQ) {
    matched = highPass(w0, quality);
  } else if (type === FilterTypeEnum.BP) {
    matched = bandPass(w0, quality);
  } else {
    // The shelf's own corner, not the bell's bound, capped at twice the rate
    // as the engine caps it.
    matched = shelf(
      type === FilterTypeEnum.HSC,
      Math.min(frequency, 2 * sampleRate) / (sampleRate / 2),
      gainDb,
    );
    if (gainDb === 0) {
      // `shelf` designs a hair of gain there; its poles are the limit's.
      matched = unityOn(matched.a1, matched.a2);
    }
  }
  return isUsable(matched) ? matched : cookbook;
};

export default matchedCoefficients;
