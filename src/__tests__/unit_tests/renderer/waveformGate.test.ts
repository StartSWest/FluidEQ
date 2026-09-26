/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The titlebar wave's gate: how a block is scaled to the pane, and when
 * silence becomes the flat line.
 *
 * Ivan, 2026-09-26: soft, slow music lay on the baseline, "is the silence line
 * only if really silent", and "it needs to wait for 500 ms at least so is not
 * that flashy". Every silence case here sits beside a sounding one fed
 * through the same gate, so "drew no line" cannot pass by drawing nothing.
 */

import type { IChartPointData } from 'renderer/graph/ChartController';
import {
  NO_POINTS,
  WAVEFORM_POINT_COUNT,
} from 'renderer/graph/liveSpectrumFrames';
import {
  WAVE_REST_HOLD_MS,
  createWaveGate,
  type IWaveGate,
  type TWaveClock,
} from 'renderer/waveformGate';

/** One display frame, the pace the drawing reads the capture at. */
const FRAME_MS = 1000 / 60;

/** A block of music peaking at `db` dBFS, shaped like a real envelope. */
const music = (db: number) => {
  const peak = 10 ** (db / 20);
  return Array.from(
    { length: WAVEFORM_POINT_COUNT },
    (_value, index) => peak * (0.3 + 0.7 * Math.abs(Math.sin(index * 0.21))),
  );
};

const silence = () => Array.from({ length: WAVEFORM_POINT_COUNT }, () => 0);

const spectrum = (y: number): IChartPointData[] =>
  Array.from({ length: 8 }, (_value, index) => ({ x: 100 * (index + 1), y }));

/** Feeds `samples` as fresh blocks, one per display frame, for `forMs`. */
const feed = (
  gate: IWaveGate,
  samples: readonly number[],
  fromMs: number,
  forMs: number,
  clock: TWaveClock = 'audio',
  points: readonly IChartPointData[] = NO_POINTS,
) => {
  let at = fromMs;
  const until = fromMs + forMs;
  while (at <= until) {
    gate.take(samples, points, at, clock);
    at += FRAME_MS;
  }
  return until;
};

const tallest = (gate: IWaveGate) => Math.max(...gate.target());

describe('the titlebar wave on soft music', () => {
  it('draws a record at -45 dBFS as a wave that fills the pane', () => {
    const gate = createWaveGate();
    feed(gate, music(-45), 0, 1000);
    expect(tallest(gate)).toBeCloseTo(1, 6);
    expect(gate.isResting()).toBe(false);
    expect(gate.isHolding()).toBe(false);
    // It is the record's shape, not a block of full-height columns.
    expect(Math.min(...gate.target())).toBeLessThan(0.5);
  });

  it('counts -65 dBFS as sound and -75 dBFS as silence', () => {
    const quiet = createWaveGate();
    feed(quiet, music(-65), 0, 1000);
    expect(quiet.isResting()).toBe(false);
    expect(tallest(quiet)).toBeCloseTo(1, 6);

    const inaudible = createWaveGate();
    const at = feed(inaudible, music(-20), 0, 200);
    feed(inaudible, music(-75), at + FRAME_MS, 600);
    expect(inaudible.isResting()).toBe(true);
    expect(tallest(inaudible)).toBe(0);
  });

  it('follows a soft passage down within half a second', () => {
    const gate = createWaveGate();
    const tick = 1000 / 30;
    const at = feed(gate, music(-6), 0, 1000);
    gate.take(music(-36), NO_POINTS, at + tick, 'audio');
    // Thirty decibels under the loud passage, and the pane has not caught up
    // on the first block — a follower, not a per-frame normaliser.
    expect(tallest(gate)).toBeLessThan(0.1);
    feed(gate, music(-36), at + tick * 2, 500);
    expect(tallest(gate)).toBeGreaterThan(0.7);
  });
});

describe('the flat line', () => {
  it('waits out a silence shorter than the hold, holding the last sound', () => {
    const gate = createWaveGate();
    const at = feed(gate, music(-20), 0, 500);
    const sounding = [...gate.target()];
    feed(gate, silence(), at + FRAME_MS, 300);
    expect(gate.isHolding()).toBe(true);
    expect(gate.isResting()).toBe(false);
    expect(gate.target()).toEqual(sounding);
  });

  it('is drawn once silence has lasted 600 ms', () => {
    const gate = createWaveGate();
    const at = feed(gate, music(-20), 0, 500);
    feed(gate, silence(), at + FRAME_MS, 600);
    expect(gate.isResting()).toBe(true);
    expect(gate.isHolding()).toBe(false);
    expect(tallest(gate)).toBe(0);
    expect(gate.target()).toHaveLength(WAVEFORM_POINT_COUNT);
  });

  it('comes at the hold exactly, measured from the first silent block', () => {
    const gate = createWaveGate();
    gate.take(music(-20), NO_POINTS, 0, 'audio');
    gate.take(silence(), NO_POINTS, 100, 'audio');
    gate.take(silence(), NO_POINTS, 100 + WAVE_REST_HOLD_MS - 1, 'audio');
    expect(gate.isResting()).toBe(false);
    gate.take(silence(), NO_POINTS, 100 + WAVE_REST_HOLD_MS, 'audio');
    expect(gate.isResting()).toBe(true);
  });

  it('goes the moment sound returns', () => {
    const gate = createWaveGate();
    const at = feed(gate, music(-20), 0, 500);
    const rested = feed(gate, silence(), at + FRAME_MS, 2000);
    expect(gate.isResting()).toBe(true);
    // Measured afresh, not against the louder record before the silence.
    gate.take(music(-45), NO_POINTS, rested + FRAME_MS, 'audio');
    expect(gate.isResting()).toBe(false);
    expect(tallest(gate)).toBeCloseTo(1, 6);
  });

  it('counts a block once however often it is read', () => {
    const gate = createWaveGate();
    gate.take(music(-20), NO_POINTS, 0, 'audio');
    for (let read = 0; read < 100; read += 1) {
      gate.take(silence(), NO_POINTS, 10, 'audio');
    }
    expect(gate.isResting()).toBe(false);
    // Positive control: the same silence, as blocks that move the clock.
    gate.take(silence(), NO_POINTS, 10 + WAVE_REST_HOLD_MS, 'audio');
    expect(gate.isResting()).toBe(true);
  });

  it('measures a silence on one clock only', () => {
    const gate = createWaveGate();
    const at = feed(gate, music(-20), 0, 500);
    feed(gate, silence(), at + FRAME_MS, 400);
    // A published frame is dated by another clock: the run starts again.
    gate.take(silence(), NO_POINTS, 90_000, 'arrival');
    expect(gate.isResting()).toBe(false);
    gate.take(silence(), NO_POINTS, 90_000 + WAVE_REST_HOLD_MS, 'arrival');
    expect(gate.isResting()).toBe(true);
  });

  it('is the line at once for a capture that starts in silence', () => {
    const gate = createWaveGate();
    gate.take(silence(), NO_POINTS, 0, 'audio');
    expect(gate.isResting()).toBe(true);
    expect(gate.target()).toHaveLength(WAVEFORM_POINT_COUNT);
  });

  it('draws nothing at all with no capture', () => {
    const gate = createWaveGate();
    feed(gate, music(-20), 0, 200);
    gate.take([], NO_POINTS, 1000, 'arrival');
    expect(gate.target()).toHaveLength(0);
    expect(gate.isHolding()).toBe(false);
    expect(gate.isResting()).toBe(false);
  });
});

describe('the spectrum beside the wave', () => {
  it('holds the last sound’s bands through the hold and lets them go after', () => {
    const gate = createWaveGate();
    // The capture's buffers are overwritten in place, so the gate has to
    // keep its own copy.
    const buffer = spectrum(12);
    const at = feed(gate, music(-20), 0, 200, 'audio', buffer);
    buffer.forEach((point) => {
      point.y = -20;
    });
    feed(gate, silence(), at + FRAME_MS, 300, 'audio', NO_POINTS);
    expect(gate.points().map(({ y }) => y)).toEqual(Array(8).fill(12));

    feed(gate, silence(), at + FRAME_MS * 2 + 300, 400, 'audio', NO_POINTS);
    expect(gate.isResting()).toBe(true);
    expect(gate.points()).toBe(NO_POINTS);
  });
});
