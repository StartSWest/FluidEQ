/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createLiveFrameReader } from '../../../renderer/graph/liveFrameReader';
import {
  FFT_SIZE,
  NO_POINTS,
  UPDATE_INTERVAL_MS,
  createFrequencyAxis,
} from '../../../renderer/graph/liveSpectrumFrames';
import { createAxisCells } from '../../../renderer/utils/autoBalanceCapture';

const RATE = 48_000;
const axis = createFrequencyAxis(RATE);
const cells = createAxisCells(axis, RATE, FFT_SIZE);

/** An analyser whose next reading and whose audio clock the test sets. */
const fakeAnalyser = () => {
  const context = { currentTime: 0 };
  let levelDb = -30;
  const smoothings: number[] = [];
  const analyser = {
    context,
    frequencyBinCount: FFT_SIZE / 2,
    smoothingTimeConstant: 0.8,
    getFloatFrequencyData: jest.fn((out: Float32Array) => {
      smoothings.push(analyser.smoothingTimeConstant);
      out.fill(levelDb);
    }),
  };
  return {
    analyser: analyser as unknown as AnalyserNode,
    reads: analyser.getFloatFrequencyData,
    smoothings,
    at: (ms: number) => {
      context.currentTime = ms / 1000;
    },
    level: (db: number) => {
      levelDb = db;
    },
  };
};

const fakeChannel = (peak: number) =>
  ({
    fftSize: 64,
    getFloatTimeDomainData: (out: Float32Array) => {
      out.fill(0);
      out[10] = peak;
    },
  }) as unknown as AnalyserNode;

const reader = (
  trackReference = { current: undefined as number | undefined },
) => {
  const fake = fakeAnalyser();
  return {
    fake,
    trackReference,
    frames: createLiveFrameReader({
      analyser: fake.analyser,
      channelAnalysers: [fakeChannel(0.5), fakeChannel(0.25)],
      axis,
      cells,
      trackReference,
    }),
  };
};

describe('live frame reader', () => {
  it('transforms once per block of audio, however many drawings ask', () => {
    const { fake, frames } = reader();
    fake.at(100);
    const first = frames.read();
    expect(frames.read()).toBe(first);
    expect(fake.reads).toHaveBeenCalledTimes(1);
    // Positive control: new audio is a new transform.
    fake.at(110);
    frames.read();
    expect(fake.reads).toHaveBeenCalledTimes(2);
  });

  it('averages by the audio that passed, not by how often it is read', () => {
    const { fake, frames } = reader();
    fake.at(0);
    frames.read();
    fake.at(UPDATE_INTERVAL_MS);
    frames.read();
    fake.at(UPDATE_INTERVAL_MS * 1.5);
    frames.read();
    // Nothing to average with on the first read; the pump's 0.2 squared per
    // tick; half a tick is its square root.
    expect(fake.smoothings[0]).toBe(0);
    expect(fake.smoothings[1]).toBeCloseTo(0.04, 10);
    expect(fake.smoothings[2]).toBeCloseTo(0.2, 10);
  });

  it('raises the shared track reference but leaves the falling to the pump', () => {
    const { fake, frames, trackReference } = reader({ current: -20 });
    fake.level(-10);
    fake.at(10);
    frames.read();
    expect(trackReference.current).toBe(-10);
    fake.level(-40);
    fake.at(20);
    frames.read();
    expect(trackReference.current).toBe(-10);
  });

  it('reads silence as no points, and sound as the whole axis', () => {
    const { fake, frames } = reader();
    fake.level(-200);
    fake.at(10);
    expect(frames.read().points).toBe(NO_POINTS);
    fake.level(-30);
    fake.at(20);
    expect(frames.read().points).toHaveLength(axis.length);
  });

  it('takes the waveform from the loudest real channel', () => {
    const { fake, frames } = reader();
    fake.at(10);
    const { waveform } = frames.read();
    expect(Math.max(...waveform)).toBe(0.5);
  });

  // The meter's bars: each channel apart, never the louder one twice.
  it("gives each channel's own peak for the meter", () => {
    const { fake, frames } = reader();
    fake.at(10);
    expect(frames.read().channelPeaks).toEqual([0.5, 0.25]);
  });
});
