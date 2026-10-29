/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TDeEsserMode } from '../../common/dsp/deEsser';
import type { ITrebleNow } from './deEsserPlot';

/** A complex number, as the analog prototypes below need. */
type TComplex = readonly [number, number];

const divide = ([a, b]: TComplex, [c, d]: TComplex): TComplex => {
  const scale = c * c + d * d;
  return [(a * c + b * d) / scale, (b * c - a * d) / scale];
};

/** The Q whose -3 dB points are `octaves` apart (`quality_for`). */
const qualityFor = (octaves: number) => {
  const half = 2 ** (octaves / 2);
  return 1 / (half - 1 / half);
};

/**
 * The cut at one frequency, dB, as the engine makes it in each mode: the
 * parallel form `x + (g - 1) * part(x)` from `deesser_process.cpp`, on the
 * analog prototypes of its filters. Spectral sums every band's band-pass at
 * its own gain; Treble takes the part over a Butterworth split at 0.9 of the
 * range's bottom (`kSplitBelow`), whose small rise at the corner is drawn
 * too; Whole voice scales everything. The gains are the engine's own
 * (`band_cut_db`); only the curve between them is computed here.
 */
export const cutAt = (
  hz: number,
  treble: ITrebleNow,
  mode: TDeEsserMode,
  lowHz: number,
): number => {
  const { hz: centres, cutDb } = treble;
  if (centres.length === 0) {
    return 0;
  }
  const deepest = Math.min(0, ...cutDb);
  if (mode === 'whole') {
    return deepest;
  }
  let real = 1;
  let imaginary = 0;
  if (mode === 'treble') {
    const w = hz / (lowHz * 0.9);
    const over = divide([-w * w, Math.SQRT2 * w], [1 - w * w, Math.SQRT2 * w]);
    const gain = 10 ** (deepest / 20) - 1;
    real += gain * over[0];
    imaginary += gain * over[1];
  } else {
    // The bands' width, as `build_layout` lays them: the step between
    // centres, never under a sixth of an octave.
    const step =
      centres.length > 1
        ? Math.log2((centres[centres.length - 1] ?? 1) / (centres[0] ?? 1)) /
          (centres.length - 1)
        : 1 / 3;
    const quality = qualityFor(Math.max(step, 1 / 6));
    centres.forEach((centre, band) => {
      const w = hz / centre;
      const pass = divide([0, w / quality], [1 - w * w, w / quality]);
      const gain = 10 ** ((cutDb[band] ?? 0) / 20) - 1;
      real += gain * pass[0];
      imaginary += gain * pass[1];
    });
  }
  return 10 * Math.log10(Math.max(1e-12, real * real + imaginary * imaginary));
};

/**
 * Fit the picture to the deepest response, not the per-band cut limit:
 * the combined response can dip below that limit. Clamping each point to
 * the dial's range flattened the tips of both the live and tuning curves.
 */
export const sampleCutCurve = (
  treble: ITrebleNow,
  mode: TDeEsserMode,
  lowHz: number,
  fromHz: number,
  toHz: number,
  steps: number,
  spanDb: number,
) => {
  const points = Array.from({ length: steps + 1 }, (_, step) =>
    Math.min(
      0,
      cutAt(fromHz * (toHz / fromHz) ** (step / steps), treble, mode, lowHz),
    ),
  );
  const depth = -Math.min(0, ...points);
  return {
    points,
    bottomDb: -(depth > spanDb ? Math.ceil(depth / 6) * 6 : spanDb),
  };
};
