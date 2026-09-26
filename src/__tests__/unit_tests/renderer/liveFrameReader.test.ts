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
import {
  createLiveGraphBand,
  followGraphReference,
  graphLevelTickFormat,
  lowBandFftSize,
  readGraphLevels,
  writeGraphPoints,
} from '../../../renderer/graph/liveGraphBand';
import { GRAPH_START } from '../../../renderer/graph/ChartController';
import { MAX_GAIN, MIN_GAIN } from '../../../common/constants';
import { createAxisCells } from '../../../renderer/utils/autoBalanceCapture';

const RATE = 48_000;
const axis = createFrequencyAxis(RATE);
const cells = createAxisCells(axis, RATE, FFT_SIZE);

/**
 * The graph band's long window, as an analyser whose level the test sets, on
 * a context that hands it out.
 */
const fakeLowBand = () => {
  let levelAt = (_bin: number) => -30;
  const lowAnalyser = {
    fftSize: 0,
    minDecibels: 0,
    maxDecibels: 0,
    smoothingTimeConstant: 0.8,
    get frequencyBinCount() {
      return lowAnalyser.fftSize / 2;
    },
    getFloatFrequencyData: (out: Float32Array) => {
      for (let bin = 0; bin < out.length; bin += 1) {
        out[bin] = levelAt(bin);
      }
    },
  };
  const context = {
    sampleRate: RATE,
    createAnalyser: () => lowAnalyser,
  } as unknown as BaseAudioContext;
  const source = { connect: jest.fn() } as unknown as AudioNode;
  return {
    band: createLiveGraphBand(context, source, FFT_SIZE),
    lowAnalyser,
    source,
    level: (db: number) => {
      levelAt = () => db;
    },
  };
};

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
  const low = fakeLowBand();
  return {
    fake,
    low,
    trackReference,
    frames: createLiveFrameReader({
      analyser: fake.analyser,
      channelAnalysers: [fakeChannel(0.5), fakeChannel(0.25)],
      axis,
      cells,
      graph: low.band,
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

  // What the titlebar measures a silence on: the audio that passed, not how
  // often the drawing asked.
  it('dates each block by the audio clock it was read at', () => {
    const { fake, frames } = reader();
    fake.at(250);
    expect(frames.read().audioMs).toBe(250);
    expect(frames.read().audioMs).toBe(250);
    fake.at(280);
    expect(frames.read().audioMs).toBe(280);
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

describe('the graphs’ own points', () => {
  it('span the whole plot, up to Nyquist, and go with the sound', () => {
    const { fake, frames } = reader();
    fake.level(-200);
    fake.at(10);
    expect(frames.read().graphPoints).toBe(NO_POINTS);
    fake.level(-30);
    fake.at(20);
    const { graphPoints, points } = frames.read();
    // POSITIVE CONTROL: the shared points still stop at 20 Hz and 20 kHz,
    // which is what everything but the graphs is tuned to.
    expect(points[0].x).toBeCloseTo(20, 6);
    expect(points[points.length - 1].x).toBeCloseTo(20000, 6);
    expect(graphPoints[0].x).toBeCloseTo(GRAPH_START, 6);
    expect(graphPoints[graphPoints.length - 1].x).toBeCloseTo(RATE / 2, 6);
  });

  it('read a slice of an octave from either window, with no join to see', () => {
    const { fake, low, frames } = reader();
    // The long window has bins under 3 Hz wide at 48 kHz, eight times finer
    // than the fast one's.
    expect(lowBandFftSize(RATE)).toBe(16384);
    expect(low.lowAnalyser.fftSize).toBe(16384);
    expect(low.source.connect).toHaveBeenCalledWith(low.lowAnalyser);
    // White noise: each bin holds power in proportion to its width, so the
    // long window's bins read 9 dB under the fast one's — the difference the
    // old join drew as a cliff at 40 to 80 Hz.
    fake.level(-30);
    low.level(-30 - 10 * Math.log10(16384 / FFT_SIZE));
    fake.at(10);
    const upper = frames
      .read()
      .graphPoints.filter(({ x }) => x > 160 && x < 20_000);
    // A twelfth of an octave widens with frequency, so white noise climbs
    // 3 dB an octave, 1.5 plot units at eighty decibels across forty: the
    // same climb from 160 Hz through the hand-over near 1.2 kHz and on.
    // POSITIVE CONTROL: the points span both windows' ground.
    expect(upper[0].x).toBeLessThan(300);
    expect(upper[upper.length - 1].x).toBeGreaterThan(5_000);
    for (let index = 1; index < upper.length; index += 1) {
      const octaves = Math.log2(upper[index].x / upper[index - 1].x);
      expect(upper[index].y - upper[index - 1].y).toBeCloseTo(1.5 * octaves, 2);
    }
  });

  it('take the bottom’s loudness from the fast window, its shape from the long', () => {
    const { band, lowAnalyser, level } = fakeLowBand();
    const white = (db: number) => new Float32Array(FFT_SIZE / 2).fill(db);
    const at60 = band.axis.findIndex((frequency) => frequency >= 60);
    level(-30 - 10 * Math.log10(lowAnalyser.fftSize / FFT_SIZE));
    const steady = readGraphLevels(band, white(-30))[at60];
    // A hit the fast window has heard and the long one, a sixth of a second
    // behind, has not: the bottom rises with it at once.
    const hit = readGraphLevels(band, white(-10))[at60];
    expect(hit - steady).toBeCloseTo(20, 4);
    // POSITIVE CONTROL: held, the two windows agree and nothing moves.
    expect(readGraphLevels(band, white(-30))[at60]).toBeCloseTo(steady, 6);
  });

  it('keep their scale at the loudest slice, falling a decibel a second', () => {
    const graph = {
      axis: [100, 1000],
      levels: Float64Array.of(-20, -35),
      reference: undefined as number | undefined,
    };
    expect(followGraphReference(graph, Number.POSITIVE_INFINITY)).toBe(-20);
    graph.levels = Float64Array.of(-30, -40);
    expect(followGraphReference(graph, 2_000)).toBeCloseTo(-22, 6);
    // A louder slice takes the scale at once.
    graph.levels = Float64Array.of(-5, -40);
    expect(followGraphReference(graph, 10)).toBe(-5);
  });

  it('are labelled eighty decibels deep on the right', () => {
    expect(
      [MIN_GAIN, -10, 0, 10, MAX_GAIN].map((tick) =>
        graphLevelTickFormat(tick),
      ),
    ).toEqual(['-80 dB', '-60 dB', '-40 dB', '-20 dB', '0 dB']);
    // The top rule is the programme's peak, the bottom one 80 dB below it.
    const target = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ];
    writeGraphPoints(target, [100, 1000], Float64Array.of(-12, -92), -12);
    expect(target.map(({ y }) => y)).toEqual([MAX_GAIN, MIN_GAIN]);
  });
});
