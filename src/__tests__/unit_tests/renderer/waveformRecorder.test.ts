/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The top wave's Recorder style (Ivan, 2026-11-16: "a true waveform"; "just a
 * normal waveform"; "a bit more compressed in time"; 2026-11-17: "dont show
 * the centr line"): which samples it takes, the loudness it prints, and the
 * one filled shape it draws.
 */

import { createSampleCursor } from 'renderer/waveformSampleCursor';
import { createShortTermLoudness } from 'renderer/waveformLoudness';
import {
  SCROLL_CSS_PX_PER_SECOND,
  createWaveRecorder,
} from 'renderer/waveformRecorder';

const RATE = 48_000;

const sine = (seconds: number, amplitude: number, hz = 1000) =>
  Float32Array.from(
    { length: Math.round(seconds * RATE) },
    (_, index) => amplitude * Math.sin((2 * Math.PI * hz * index) / RATE),
  );

describe('the sample cursor', () => {
  it('takes nothing on the first read, then exactly what the clock passed', () => {
    const cursor = createSampleCursor();
    expect(cursor.advance(1000, RATE, 2048)).toBeUndefined();
    // 10 ms at 48 kHz is 480 new samples at the window's end.
    expect(cursor.advance(1010, RATE, 2048)).toEqual({
      from: 2048 - 480,
      to: 2048,
      unseen: 0,
    });
    // A read with no audio rendered since takes nothing.
    expect(cursor.advance(1010, RATE, 2048)).toBeUndefined();
  });

  it('counts what fell out of the window as unseen', () => {
    const cursor = createSampleCursor();
    cursor.advance(0, RATE, 2048);
    // 100 ms is 4800 samples; the window holds the newest 2048.
    expect(cursor.advance(100, RATE, 2048)).toEqual({
      from: 0,
      to: 2048,
      unseen: 4800 - 2048,
    });
  });

  it('starts again at a new rate, a clock that went back, or a reset', () => {
    const cursor = createSampleCursor();
    cursor.advance(500, RATE, 2048);
    expect(cursor.advance(510, 44_100, 2048)).toBeUndefined();
    expect(cursor.advance(400, 44_100, 2048)).toBeUndefined();
    expect(cursor.advance(410, 44_100, 2048)?.to).toBe(2048);
    cursor.reset();
    expect(cursor.advance(420, 44_100, 2048)).toBeUndefined();
  });
});

describe('the short-term loudness', () => {
  const feedAll = (left: Float32Array, right: Float32Array) => {
    const meter = createShortTermLoudness();
    for (let at = 0; at < left.length; at += 480) {
      const end = Math.min(left.length, at + 480);
      meter.feed([left, right], at, end, 0, RATE);
    }
    return meter.read();
  };

  it('reads a stereo 1 kHz sine at -23 dBFS as -23 LUFS', () => {
    // BS.1770's own check: the K-weighting's +0.667 dB at 1 kHz and the
    // -0.691 calibration all but cancel on this one signal.
    const tone = sine(3, 10 ** (-23 / 20));
    const lufs = feedAll(tone, tone);
    expect(lufs).toBeDefined();
    expect(Math.abs((lufs ?? 0) + 23)).toBeLessThan(0.1);
  });

  it('reads 10 dB quieter as 10 LU lower', () => {
    const loud = sine(3, 0.2);
    const quiet = sine(3, 0.2 * 10 ** (-10 / 20));
    const difference =
      (feedAll(loud, loud) ?? 0) - (feedAll(quiet, quiet) ?? 0);
    expect(Math.abs(difference - 10)).toBeLessThan(0.05);
  });

  it('says nothing for silence, or before 400 ms are heard', () => {
    const silence = new Float32Array(3 * RATE);
    expect(feedAll(silence, silence)).toBeUndefined();
    const tone = sine(0.3, 0.5);
    expect(feedAll(tone, tone)).toBeUndefined();
  });
});

/** A context that records the shape's points and fills. */
const recordingContext = (width = 438, height = 56) => {
  const points: [number, number][] = [];
  const fills: string[] = [];
  const context = {
    canvas: { width, height },
    fillStyle: '' as unknown,
    setTransform: jest.fn(),
    clearRect: jest.fn(() => {
      points.length = 0;
      fills.length = 0;
    }),
    fillRect: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(),
    closePath: jest.fn(),
    moveTo: jest.fn((x: number, y: number) => points.push([x, y])),
    lineTo: jest.fn((x: number, y: number) => points.push([x, y])),
    quadraticCurveTo: jest.fn(
      (_cx: number, _cy: number, x: number, y: number) => points.push([x, y]),
    ),
    fill: jest.fn(() => {
      fills.push(String(context.fillStyle));
    }),
  };
  return {
    context: context as unknown as CanvasRenderingContext2D,
    points,
    fills,
    fillRect: context.fillRect,
  };
};

const BOX = { x: 10, y: 10, width: 418, height: 36 };
const PALETTE = { fill: 'ACCENT', paused: 'PAUSED' };
const draw = (
  recorder: ReturnType<typeof createWaveRecorder>,
  context: CanvasRenderingContext2D,
  isPaused = false,
) => recorder.draw(context, { box: BOX, ratio: 1, palette: PALETTE, isPaused });

/** How far the shape reaches above the centre, as a share of its reach. */
const heightOf = (points: readonly [number, number][]) => {
  const centre = BOX.y + BOX.height / 2;
  const reach = BOX.height / 2 - 1;
  return points.reduce((top, [, y]) => Math.max(top, (centre - y) / reach), 0);
};

describe('the recorder', () => {
  it('fits about nine seconds across the strip', () => {
    expect(BOX.width / SCROLL_CSS_PX_PER_SECOND).toBeGreaterThan(8);
    expect(BOX.width / SCROLL_CSS_PX_PER_SECOND).toBeLessThan(10);
  });

  it('draws one filled shape in the accent, mirrored, as tall as the music', () => {
    const recorder = createWaveRecorder();
    const tone = sine(2, 0.5, 220);
    recorder.feed([tone, tone], 0, tone.length, 0, RATE);
    const { context, points, fills } = recordingContext();
    expect(draw(recorder, context)).toBe(true);
    expect(fills).toEqual(['ACCENT']);
    expect(heightOf(points)).toBeGreaterThan(0.48);
    expect(heightOf(points)).toBeLessThan(0.51);
    // As far below the centre as above it.
    const centre = BOX.y + BOX.height / 2;
    const bottom = points.reduce((low, [, y]) => Math.max(low, y - centre), 0);
    expect(bottom / (BOX.height / 2 - 1)).toBeCloseTo(heightOf(points), 5);
  });

  it('draws no centre line, so silence is an empty strip', () => {
    const recorder = createWaveRecorder();
    const silence = new Float32Array(RATE);
    recorder.feed([silence, silence], 0, silence.length, 0, RATE);
    const { context, points, fillRect } = recordingContext();
    expect(draw(recorder, context)).toBe(false);
    expect(fillRect).not.toHaveBeenCalled();
    expect(heightOf(points)).toBe(0);
  });

  it('holds a sample past full scale at the rail', () => {
    const recorder = createWaveRecorder();
    const hot = sine(1, 1.6, 220);
    recorder.feed([hot, hot], 0, hot.length, 0, RATE);
    const { context, points } = recordingContext();
    draw(recorder, context);
    expect(heightOf(points)).toBeLessThanOrEqual(1 + 1e-6);
    expect(heightOf(points)).toBeGreaterThan(0.99);
  });

  it('keeps moving until the music has scrolled away, then stops', () => {
    const recorder = createWaveRecorder();
    const tone = sine(1, 0.5);
    recorder.feed([tone, tone], 0, tone.length, 0, RATE);
    const { context } = recordingContext();
    // Five seconds of silence: the music is still on the strip.
    const silence = new Float32Array(5 * RATE);
    recorder.feed([silence, silence], 0, silence.length, 0, RATE);
    expect(draw(recorder, context)).toBe(true);
    // Ten more, passed as unseen audio: it has gone off the left.
    recorder.feed([silence, silence], 0, 0, 10 * RATE, RATE);
    expect(draw(recorder, context)).toBe(false);
  });

  it('freezes in the paused colour while paused', () => {
    const recorder = createWaveRecorder();
    const tone = sine(2, 0.5, 220);
    recorder.feed([tone, tone], 0, tone.length, 0, RATE);
    const { context, fills } = recordingContext();
    expect(draw(recorder, context, true)).toBe(false);
    expect(fills).toEqual(['PAUSED']);
  });

  it('forgets the music when cleared', () => {
    const recorder = createWaveRecorder();
    const tone = sine(1, 0.5);
    recorder.feed([tone, tone], 0, tone.length, 0, RATE);
    recorder.clear();
    const { context, points } = recordingContext();
    expect(draw(recorder, context)).toBe(false);
    expect(points).toHaveLength(0);
  });

  it('fills the time of published readings at their level', () => {
    const recorder = createWaveRecorder();
    recorder.feedLevel(0.4, 2000);
    const { context, points } = recordingContext();
    expect(draw(recorder, context)).toBe(true);
    expect(heightOf(points)).toBeGreaterThan(0.39);
    expect(heightOf(points)).toBeLessThan(0.41);
  });
});
