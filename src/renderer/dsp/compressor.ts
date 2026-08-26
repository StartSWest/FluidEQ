/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IBandSettings } from '../../common/dsp/chain';

export interface ICompressorState {
  /** Smoothed gain reduction, 0-1. Held across process blocks. */
  gain: number;
}

export const createCompressorState = (): ICompressorState => ({ gain: 1 });

const dbToLinear = (db: number): number => 10 ** (db / 20);

const requiredGain = (
  magnitude: number,
  threshold: number,
  ratio: number,
): number => {
  if (magnitude <= threshold) {
    return 1;
  }
  const over = magnitude / threshold;
  return over ** (1 / ratio - 1);
};

/**
 * Per-sample smoothing coefficient for a time constant in milliseconds.
 *
 * The standard one-pole form: after `milliseconds` the gain has travelled
 * 1 - 1/e of the way to its target, which is what every compressor's attack
 * and release dials mean.
 */
const coefficientFor = (milliseconds: number, sampleRate: number): number =>
  Math.exp(-1 / ((milliseconds / 1_000) * sampleRate));

/**
 * Compress one band in place.
 *
 * Feed-forward: the gain comes from the INPUT level, not from the already
 * reduced output. A feedback design makes the ratio dial mean something
 * different at every level, because the detector is looking at a signal the
 * compressor has itself changed. Feed-forward means 4:1 is 4:1 everywhere.
 *
 * The detector is peak, not RMS, and follows the smoothed gain rather than a
 * smoothed level — so `attackMs` and `releaseMs` describe how fast the GAIN
 * moves, which is what a user turning those dials is listening for.
 *
 * A band whose peaks never reach the threshold comes back bit-identical apart
 * from makeup. That is asserted by a null test, and by a positive control
 * beside it: without the control, a function that returned its input
 * unchanged would pass the null test perfectly while doing nothing at all.
 */
export const processBand = (
  state: ICompressorState,
  buffer: Float32Array,
  settings: IBandSettings,
  sampleRate: number,
): void => {
  const threshold = dbToLinear(settings.thresholdDb);
  const makeup = dbToLinear(settings.makeupDb);
  const attack = coefficientFor(settings.attackMs, sampleRate);
  const release = coefficientFor(settings.releaseMs, sampleRate);
  for (let i = 0; i < buffer.length; i += 1) {
    const magnitude = Math.abs(buffer[i]);
    // Gain that puts the overshoot back by the ratio: a signal `over` times
    // the threshold should end up `over ** (1 / ratio)` times it.
    const target = requiredGain(magnitude, threshold, settings.ratio);
    const coefficient = target < state.gain ? attack : release;
    state.gain = target + (state.gain - target) * coefficient;
    buffer[i] *= state.gain * makeup;
  }
};

/**
 * Compress matching L/R band buffers with one detector and one gain envelope.
 *
 * A dual-mono compressor turns whichever channel contains the loudest transient
 * down by itself, which moves a centred source sideways. The linked detector
 * listens to the louder channel but applies the exact same gain to both, so the
 * inter-channel level ratio—and therefore the stereo position—cannot move.
 */
export const processBandLinked = (
  state: ICompressorState,
  buffers: readonly Float32Array[],
  settings: IBandSettings,
  sampleRate: number,
  channelCount: number = buffers.length,
): void => {
  const frames = buffers[0]?.length ?? 0;
  if (frames === 0) {
    return;
  }
  const channels = Math.min(channelCount, buffers.length);
  const threshold = dbToLinear(settings.thresholdDb);
  const makeup = dbToLinear(settings.makeupDb);
  const attack = coefficientFor(settings.attackMs, sampleRate);
  const release = coefficientFor(settings.releaseMs, sampleRate);
  for (let frame = 0; frame < frames; frame += 1) {
    let magnitude = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      magnitude = Math.max(magnitude, Math.abs(buffers[channel][frame]));
    }
    const target = requiredGain(magnitude, threshold, settings.ratio);
    const coefficient = target < state.gain ? attack : release;
    state.gain = target + (state.gain - target) * coefficient;
    const gain = state.gain * makeup;
    for (let channel = 0; channel < channels; channel += 1) {
      buffers[channel][frame] *= gain;
    }
  }
};
