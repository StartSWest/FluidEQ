/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IBiquadCoefficients, IBiquadState, createBiquadState } from './biquad';
import { oversampleFactorForSampleRate } from './oversample';
import { createTruePeakState, truePeakOfSample } from './truePeak';

/**
 * The measurement half of input normalization, with no decoding in it.
 *
 * It was inside `analyzeInputTrack`, which needs an `AudioContext` to decode
 * and a `requestAnimationFrame` to yield — neither of which exists outside a
 * renderer. That put the arithmetic somewhere no test could reach it and,
 * during the native port, somewhere the parity fixtures could not call either.
 * Splitting the loop out is what lets one function be the reference for both
 * the TypeScript player and `loudness.cpp`.
 *
 * Streaming rather than whole-buffer so the caller keeps its own yield
 * boundary: `feed` is arithmetic only and never yields, and feeding a track in
 * one call or in one-second chunks produces bit-identical results because all
 * the state lives here.
 */

export const SILENCE_DB = -120;
export const ABSOLUTE_GATE_LUFS = -70;
const RELATIVE_GATE_LU = -10;
/**
 * BS.1770's calibration offset. A constant of the standard, not a tuning value.
 *
 * It very nearly cancels the K-weighting's own +0.667 dB at 1 kHz, which is
 * what makes a stereo 1 kHz sine at -23 dBFS read -23 LUFS. That cancellation
 * is the reason a wrong shelf shows up as a wrong reading on the one signal a
 * conforming meter has no freedom over.
 */
const LOUDNESS_OFFSET = -0.691;
/** Flushes the true-peak FIR's half-window at end of file. */
const FLUSH_SAMPLES = 12;

export interface ILoudnessMeasurement {
  integratedLufs: number;
  truePeakDbtp: number;
}

export const dbFromMagnitude = (magnitude: number): number =>
  magnitude > 0 ? 20 * Math.log10(magnitude) : SILENCE_DB;

const loudnessFromEnergy = (energy: number): number =>
  energy > 0 ? LOUDNESS_OFFSET + 10 * Math.log10(energy) : SILENCE_DB;

const processOne = (
  state: IBiquadState,
  sample: number,
  { b0, b1, b2, a1, a2 }: IBiquadCoefficients,
): number => {
  const output =
    b0 * sample + b1 * state.x1 + b2 * state.x2 - a1 * state.y1 - a2 * state.y2;
  state.x2 = state.x1;
  state.x1 = sample;
  state.y2 = state.y1;
  state.y1 = output;
  return output;
};

/**
 * The two cascaded filters that BS.1770 calls K-weighting.
 *
 * NOT the RBJ cookbook, which is what this used to be and what made the meter
 * wrong. The standard publishes its coefficients only at 48 kHz, so a filter
 * that runs at other rates has to be re-derived — and the cookbook's high
 * shelf is a different design from the standard's, not a re-derivation of it.
 * Measured against the published table: agreement below 200 Hz and above
 * 8 kHz, and 0.67 dB against 0.45 dB at 1 kHz, 3.03 against 2.66 at 2 kHz.
 * Under-weighting the presence region by a third of a dB is a whole-track
 * reading that is optimistic on anything with vocals in it.
 *
 * The derivation below reproduces BS.1770-4's Table 1 and Table 2 at 48 kHz to
 * within 4e-14 on every coefficient — the same filter, expressed so it can be
 * designed at 44.1 or 96 kHz too.
 *
 * Every digit is kept: rounding 1681.974450955533 to 1682 moves the shelf
 * enough to shift a measurement in the last tenth of a LU.
 */
const SHELF_HZ = 1_681.974450955533;
const SHELF_GAIN_DB = 3.999843853973347;
const SHELF_QUALITY = 0.7071752369554196;
/**
 * The bandwidth gain's exponent, and it is 0.499666774155 rather than 0.5.
 *
 * The half-power point of a shelf whose two ends differ by exactly 4 dB is not
 * quite the geometric mean, and this is the value that makes the derived
 * coefficients land on the standard's printed ones instead of near them.
 */
const SHELF_BANDWIDTH_EXPONENT = 0.499666774155;
const HIGHPASS_HZ = 38.13547087602444;
const HIGHPASS_QUALITY = 0.5003270373238773;

const kWeighting = (sampleRate: number) => {
  const shelfK = Math.tan((Math.PI * SHELF_HZ) / sampleRate);
  const shelfHigh = 10 ** (SHELF_GAIN_DB / 20);
  const shelfBand = shelfHigh ** SHELF_BANDWIDTH_EXPONENT;
  const shelfA0 = 1 + shelfK / SHELF_QUALITY + shelfK * shelfK;

  const highK = Math.tan((Math.PI * HIGHPASS_HZ) / sampleRate);
  const highA0 = 1 + highK / HIGHPASS_QUALITY + highK * highK;

  return {
    shelf: {
      b0:
        (shelfHigh + (shelfBand * shelfK) / SHELF_QUALITY + shelfK * shelfK) /
        shelfA0,
      b1: (2 * (shelfK * shelfK - shelfHigh)) / shelfA0,
      b2:
        (shelfHigh - (shelfBand * shelfK) / SHELF_QUALITY + shelfK * shelfK) /
        shelfA0,
      a1: (2 * (shelfK * shelfK - 1)) / shelfA0,
      a2: (1 - shelfK / SHELF_QUALITY + shelfK * shelfK) / shelfA0,
    },
    highpass: {
      // The RLB curve's numerator is a plain second-order difference, which is
      // why it is written out rather than designed: the standard's b terms are
      // exactly 1, -2, 1 at every rate.
      b0: 1,
      b1: -2,
      b2: 1,
      a1: (2 * (highK * highK - 1)) / highA0,
      a2: (1 - highK / HIGHPASS_QUALITY + highK * highK) / highA0,
    },
  };
};

const meanAbove = (energies: readonly number[], threshold: number): number => {
  let total = 0;
  let count = 0;
  energies.forEach((energy) => {
    if (loudnessFromEnergy(energy) > threshold) {
      total += energy;
      count += 1;
    }
  });
  return count > 0 ? total / count : 0;
};

const integratedLoudness = (blockEnergies: readonly number[]): number => {
  // Gated twice, in the order the standard gives: the absolute gate first, and
  // a relative gate derived from what survived it. Deriving the relative gate
  // from the ungated mean instead lets a long silence drag the threshold down
  // and quietly raise the measurement of everything after it.
  const absolute = meanAbove(blockEnergies, ABSOLUTE_GATE_LUFS);
  if (absolute <= 0) {
    return SILENCE_DB;
  }
  const relativeGate = loudnessFromEnergy(absolute) + RELATIVE_GATE_LU;
  return loudnessFromEnergy(meanAbove(blockEnergies, relativeGate));
};

export interface ILoudnessAnalyzer {
  /** Planar, one array per channel. `from`/`to` are frame indices into them. */
  feed: (channels: readonly Float32Array[], from: number, to: number) => void;
  finish: () => ILoudnessMeasurement;
}

/**
 * Four-hundred-millisecond blocks overlapping by 75%, gated per BS.1770.
 *
 * Channels above two are ignored, matching what the player feeds: the
 * standard's surround weights are not implemented here, and inventing them
 * would make a 5.1 file measure differently from the stereo fold-down that is
 * actually played.
 */
export const createLoudnessAnalyzer = (
  sampleRate: number,
  channelCount: number,
): ILoudnessAnalyzer => {
  const channels = Math.min(2, channelCount);
  const filters = kWeighting(sampleRate);
  const truePeakStates = Array.from({ length: channels }, () =>
    createTruePeakState(oversampleFactorForSampleRate(sampleRate)),
  );
  const shelfStates = Array.from({ length: channels }, () =>
    createBiquadState(),
  );
  const highpassStates = Array.from({ length: channels }, () =>
    createBiquadState(),
  );
  const blockFrames = Math.max(1, Math.round(sampleRate * 0.4));
  const hopFrames = Math.max(1, Math.round(sampleRate * 0.1));
  // A rolling sum over one block, so the cost is per sample and not per block.
  const energyWindow = new Float64Array(blockFrames);
  const blockEnergies: number[] = [];
  let energySum = 0;
  let truePeakMagnitude = 0;
  let position = 0;

  return {
    feed: (input, from, to) => {
      for (let frame = from; frame < to; frame += 1) {
        let combinedEnergy = 0;
        for (let channel = 0; channel < channels; channel += 1) {
          const sample = input[channel][frame];
          truePeakMagnitude = Math.max(
            truePeakMagnitude,
            truePeakOfSample(truePeakStates[channel], sample),
          );
          const shelf = processOne(shelfStates[channel], sample, filters.shelf);
          const weighted = processOne(
            highpassStates[channel],
            shelf,
            filters.highpass,
          );
          combinedEnergy += weighted * weighted;
        }

        const windowAt = position % blockFrames;
        energySum += combinedEnergy - energyWindow[windowAt];
        energyWindow[windowAt] = combinedEnergy;
        position += 1;
        if (
          position >= blockFrames &&
          (position - blockFrames) % hopFrames === 0
        ) {
          blockEnergies.push(energySum / blockFrames);
        }
      }
    },
    finish: () => {
      // Complete the interpolation window at EOF; otherwise a last-sample peak
      // sits in the half-window the true-peak FIR has not observed yet.
      for (let flush = 0; flush < FLUSH_SAMPLES; flush += 1) {
        for (let channel = 0; channel < truePeakStates.length; channel += 1) {
          truePeakMagnitude = Math.max(
            truePeakMagnitude,
            truePeakOfSample(truePeakStates[channel], 0),
          );
        }
      }
      return {
        truePeakDbtp: Math.max(SILENCE_DB, dbFromMagnitude(truePeakMagnitude)),
        integratedLufs: Math.max(SILENCE_DB, integratedLoudness(blockEnergies)),
      };
    },
  };
};
