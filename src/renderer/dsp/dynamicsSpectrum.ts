/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createGraphSliceReader } from '../graph/graphSlices';
import { followSpectrum, powerOf } from './dspEqSpectrum';
import type { IDspAnalyser } from './store';

/** The output spectrum, not an estimate of the Dynamics detector or its gain. */
export default function createDynamicsSpectrum() {
  let bins = new Float32Array(0);
  let slices: ReturnType<typeof createGraphSliceReader> | undefined;
  const held = new Float64Array(256);
  const target = new Float64Array(256);
  const levels = new Float64Array(256).fill(-120);
  let steppedAt = Number.NEGATIVE_INFINITY;

  return {
    read(analyser: IDspAnalyser, sampleRate: number, now: number) {
      if (bins.length !== analyser.frequencyBinCount) {
        bins = new Float32Array(analyser.frequencyBinCount);
      }
      if (
        !slices ||
        slices.sampleRate !== sampleRate ||
        slices.fftSize !== bins.length * 2
      ) {
        slices = createGraphSliceReader(
          sampleRate,
          bins.length * 2,
          levels.length,
        );
        held.fill(0);
      }
      analyser.getFloatFrequencyData(bins);
      powerOf(slices.read(bins), target);
      followSpectrum(held, target, now - steppedAt, levels);
      steppedAt = now;
      return { axis: slices.axis, levels };
    },
    reset() {
      held.fill(0);
      levels.fill(-120);
      steppedAt = Number.NEGATIVE_INFINITY;
    },
  };
}
