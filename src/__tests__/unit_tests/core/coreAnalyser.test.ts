/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The core's analyser against Chromium's own, on the same samples.
 *
 * The desktop backgrounds used to move to numbers Chromium's AnalyserNode
 * computed in the window; the core computes them now
 * (`core/liveFrames/analyser.ts`). The readings below were taken from
 * Chromium itself (`.erb/scripts/generate-analyser-reference.cjs`), at the
 * frames and smoothing the drawing's reader uses, over a signal both sides
 * build from one seed. Every bin above the float noise has to agree within a
 * thousandth of a decibel or so — what single and double precision leave
 * between the two transforms — and a control one sample late has to fail.
 */
import { createCoreAnalyser } from 'core/liveFrames/analyser';
import reference from '../../data/read_only/liveFrames/chromium-analyser.json';
import {
  SIGNAL_RATE,
  analyserSignal,
  signalBlocks,
} from '../../utils/analyserSignal';

/** Bins Chromium reads under this are its float rounding, not the signal. */
const FLOOR_DB = -150;
const TOLERANCE_DB = 0.002;

/** The worst disagreement with Chromium over every reading, in dB. */
const worstAgainstChromium = (lateBy: number): number => {
  const signal = analyserSignal();
  const analyser = createCoreAnalyser(2048);
  const frequency = new Float32Array(1024);
  let fed = 0;
  let worst = 0;
  reference.reads.forEach((read) => {
    const until = read.frame - lateBy;
    signalBlocks(signal, fed, until).forEach((block) => analyser.push(block));
    fed = until;
    analyser.readFrequency(frequency, read.smoothing);
    read.frequencyDb.forEach((chromium, bin) => {
      if (chromium !== null && chromium > FLOOR_DB) {
        worst = Math.max(worst, Math.abs(frequency[bin] - chromium));
      }
    });
  });
  return worst;
};

describe('the core’s analyser', () => {
  it('reads what Chromium’s reads, bin for bin', () => {
    expect(reference.rate).toBe(SIGNAL_RATE);
    expect(worstAgainstChromium(0)).toBeLessThan(TOLERANCE_DB);
  });

  it('is caught one sample out', () => {
    expect(worstAgainstChromium(1)).toBeGreaterThan(TOLERANCE_DB * 10);
  });

  it('hands back each channel’s newest samples, oldest first', () => {
    const signal = analyserSignal();
    const analyser = createCoreAnalyser(2048);
    signalBlocks(signal, 0, 5000).forEach((block) => analyser.push(block));
    const left = new Float32Array(2048);
    const right = new Float32Array(2048);
    analyser.readChannel(0, left);
    analyser.readChannel(1, right);

    expect(Array.from(left)).toEqual(Array.from(signal.left.slice(2952, 5000)));
    expect(Array.from(right)).toEqual(
      Array.from(signal.right.slice(2952, 5000)),
    );
  });

  it('counts the audio heard, and keeps counting across a new format', () => {
    const analyser = createCoreAnalyser(2048);
    const block = (sampleRate: number, channels: number, frames: number) => ({
      sampleRate,
      channels,
      frames,
      sequence: 0,
      pcm: new Float32Array(frames * channels).buffer,
    });
    analyser.push(block(48000, 2, 480));
    expect(analyser.audioMs()).toBeCloseTo(10, 9);
    expect(analyser.channelCount()).toBe(2);

    analyser.push(block(44100, 1, 441));
    expect(analyser.audioMs()).toBeCloseTo(20, 9);
    expect(analyser.sampleRate()).toBe(44100);
    expect(analyser.channelCount()).toBe(1);
  });

  it('takes the front pair of a wider output', () => {
    const analyser = createCoreAnalyser(4);
    const pcm = new Float32Array([1, 2, 9, 9, 9, 9, 3, 4, 9, 9, 9, 9]);
    analyser.push({
      sampleRate: 48000,
      channels: 6,
      frames: 2,
      sequence: 0,
      pcm: pcm.buffer,
    });
    const left = new Float32Array(2);
    const right = new Float32Array(2);
    analyser.readChannel(0, left);
    analyser.readChannel(1, right);

    expect(analyser.channelCount()).toBe(2);
    expect(Array.from(left)).toEqual([1, 3]);
    expect(Array.from(right)).toEqual([2, 4]);
  });

  it('reads silence before anything is heard', () => {
    const analyser = createCoreAnalyser(2048);
    const frequency = new Float32Array(1024);
    analyser.readFrequency(frequency, 0);
    const left = new Float32Array(16).fill(1);
    analyser.readChannel(0, left);

    expect(frequency.every((value) => value === -Infinity)).toBe(true);
    expect(left.every((value) => value === 0)).toBe(true);
  });
});
