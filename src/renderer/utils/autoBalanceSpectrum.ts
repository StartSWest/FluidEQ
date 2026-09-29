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
  NO_GAIN_FILTER_TYPES,
} from 'common/constants';

// The measured spectrum as the balance reads it: a sample's weight, the
// filter shapes, the tilt fitted through it, its smoothing and its value at
// a frequency. autoBalance.ts re-exports all of it.

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

export const weightOf = (sample: ISpectrumSample) => sample.confidence ?? 1;

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
export const solveLinearSystem = (
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

/**
 * Linear interpolation of a spectrum field at an arbitrary frequency.
 *
 * `samples` must be in ascending frequency, which every curve here is: the
 * measurement is sorted before it is used, and the response curves are built
 * on an ascending grid. The neighbour is found by bisection rather than by
 * scanning from the front — the chain curve has a thousand points, and this
 * is asked for once per axis point for every solve and, until it was cached,
 * on every frame.
 */
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

  // The first sample at or above `frequency`, which the guards above have
  // already placed strictly inside the array.
  let low = 0;
  let high = samples.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (samples[middle].frequency >= frequency) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }
  const upperIndex = low;
  const upper = samples[upperIndex];
  const lower = samples[upperIndex - 1] ?? upper;
  const span = Math.log10(upper.frequency) - Math.log10(lower.frequency);
  if (span <= 0) {
    return read(upper);
  }
  const position = (Math.log10(frequency) - Math.log10(lower.frequency)) / span;
  return read(lower) + (read(upper) - read(lower)) * position;
};
