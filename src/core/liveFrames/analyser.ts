/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fftInPlace from '../../common/dsp/fft';
import type { ISystemSoundBlock } from '../systemSound/systemSound';

/**
 * Chromium's `AnalyserNode`, over the blocks the core hears.
 *
 * The desktop backgrounds used to be fed by the window's analysers, so a
 * background moved to numbers Chromium computed. The core reads the same
 * output and has to hand them the same numbers, or the same visualizer would
 * move differently on the desktop than on the graph. So this is the Web Audio
 * specification's analysis as Blink's `RealtimeAnalyser` carries it out:
 *
 * - the input folded to mono the way the node folds a stereo input — half the
 *   sum of the two channels, the front pair of anything wider, as the window's
 *   capture is only ever given those two;
 * - the most recent `fftSize` samples under a Blackman window (alpha 0.16);
 * - a forward transform, each bin's magnitude scaled by `1 / fftSize`, so a
 *   full-scale sine reads 0 dB less the window's own loss;
 * - averaged with the previous reading by the smoothing constant, held in
 *   single precision as Blink holds it, a reading that is not finite reset;
 * - and in decibels, `20 log10`, where silence is `-Infinity`.
 *
 * Held against Chromium's own analyser on the same samples
 * (`coreAnalyser.test.ts`).
 */
export interface ICoreAnalyser {
  /** A block as the core heard it: interleaved, in its own format. */
  push(block: ISystemSoundBlock): void;
  /** Hz of what was heard last; 0 before anything was. */
  sampleRate(): number;
  /** How many channels a reading has: the front pair, or one. */
  channelCount(): number;
  /**
   * Milliseconds of audio heard so far. Only ever grows, across a change of
   * format too: a reading is due when it moves, and the averaging spans it.
   */
  audioMs(): number;
  /** `getFloatFrequencyData`, `fftSize / 2` bins, at this smoothing. */
  readFrequency(target: Float32Array, smoothing: number): void;
  /** `getFloatTimeDomainData` of one channel of the front pair. */
  readChannel(channel: number, target: Float32Array): void;
}

/** Blackman's three terms for alpha 0.16, as the specification gives them. */
const BLACKMAN_A0 = 0.42;
const BLACKMAN_A1 = 0.5;
const BLACKMAN_A2 = 0.08;

const blackman = (size: number): Float64Array => {
  const window = new Float64Array(size);
  for (let n = 0; n < size; n += 1) {
    const phase = (2 * Math.PI * n) / size;
    window[n] =
      BLACKMAN_A0 -
      BLACKMAN_A1 * Math.cos(phase) +
      BLACKMAN_A2 * Math.cos(2 * phase);
  }
  return window;
};

/** The last `capacity` samples of one channel, oldest overwritten. */
interface IHistory {
  samples: Float32Array;
  /** Where the next sample goes, which is also the oldest one held. */
  next: number;
}

const newHistory = (capacity: number): IHistory => ({
  samples: new Float32Array(capacity),
  next: 0,
});

/** The newest `target.length` samples of `history`, oldest first. */
const copyNewest = (history: IHistory, target: Float32Array): void => {
  const { samples } = history;
  const capacity = samples.length;
  const count = Math.min(target.length, capacity);
  const start = (history.next - count + capacity) % capacity;
  for (let index = 0; index < count; index += 1) {
    target[target.length - count + index] = samples[(start + index) % capacity];
  }
  target.fill(0, 0, target.length - count);
};

/**
 * An analyser of `fftSize` over the channels the core hears. `historySize`
 * is how far back a channel reading can reach; the window's meter analysers
 * read 2048 samples, as its spectrum's does.
 */
export const createCoreAnalyser = (
  fftSize: number,
  historySize: number = fftSize,
): ICoreAnalyser => {
  const capacity = Math.max(fftSize, historySize);
  const window = blackman(fftSize);
  const real = new Float64Array(fftSize);
  const imaginary = new Float64Array(fftSize);
  const mono = new Float32Array(fftSize);
  const left = new Float32Array(fftSize);
  const right = new Float32Array(fftSize);
  // Single precision, as Blink keeps the running magnitudes.
  const magnitudes = new Float32Array(fftSize / 2);
  let channels: IHistory[] = [];
  let rate = 0;
  let format = '';
  let heardMs = 0;

  const fold = (): void => {
    copyNewest(channels[0], left);
    if (channels.length < 2) {
      mono.set(left);
      return;
    }
    copyNewest(channels[1], right);
    for (let index = 0; index < fftSize; index += 1) {
      mono[index] = 0.5 * (left[index] + right[index]);
    }
  };

  return {
    push: (block) => {
      const count = Math.min(2, block.channels);
      const now = `${block.sampleRate}/${count}`;
      // A new format starts a new history and a new average: Blink's node is
      // rebuilt with a new context, and samples of two rates are not one
      // signal.
      if (now !== format) {
        format = now;
        rate = block.sampleRate;
        channels = Array.from({ length: count }, () => newHistory(capacity));
        magnitudes.fill(0);
      }
      const pcm = new Float32Array(block.pcm);
      for (let frame = 0; frame < block.frames; frame += 1) {
        for (let channel = 0; channel < count; channel += 1) {
          const history = channels[channel];
          history.samples[history.next] = pcm[frame * block.channels + channel];
          history.next = (history.next + 1) % capacity;
        }
      }
      heardMs += (block.frames * 1000) / block.sampleRate;
    },
    sampleRate: () => rate,
    channelCount: () => channels.length,
    audioMs: () => heardMs,
    readFrequency: (target, smoothing) => {
      if (channels.length === 0) {
        target.fill(-Infinity);
        return;
      }
      fold();
      for (let n = 0; n < fftSize; n += 1) {
        real[n] = mono[n] * window[n];
        imaginary[n] = 0;
      }
      fftInPlace(real, imaginary, false);
      const k = Math.min(1, Math.max(0, smoothing));
      const scale = 1 / fftSize;
      const bins = Math.min(target.length, magnitudes.length);
      for (let bin = 0; bin < bins; bin += 1) {
        const magnitude = Math.hypot(real[bin], imaginary[bin]) * scale;
        const averaged = k * magnitudes[bin] + (1 - k) * magnitude;
        magnitudes[bin] = Number.isFinite(averaged) ? averaged : 0;
        target[bin] = 20 * Math.log10(magnitudes[bin]);
      }
    },
    readChannel: (channel, target) => {
      const history = channels[channel];
      if (!history) {
        target.fill(0);
        return;
      }
      copyNewest(history, target);
    },
  };
};
