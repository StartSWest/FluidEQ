/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Q's tail carries the music (Ivan, 2026-11-26): the capture's waveform
 * taken down to a few dozen smoothed points, shaped so the join with the
 * letter never moves and the far end fades out, over a still flourish that
 * is all that is left in silence.
 */

import {
  TAIL_POINTS,
  TAIL_SWAY_PX,
  calmSignal,
  tailAnchors,
  tailEnvelope,
  tailOffsets,
  tailOutline,
  tailRest,
  tailSignal,
} from 'renderer/shell/wordmark/wordmarkTail';

// Every point of a block at its own size scribbled — worst on the 22px
// flourish the tail has at 1920 — so it is drawn as a sway through a few.
describe('the tail’s sway', () => {
  const zigzag = Array.from({ length: TAIL_POINTS }, (_, i) =>
    i % 2 ? 0.8 : -0.8,
  );

  it('keeps a few points on a short flourish and more on a long tail', () => {
    expect(tailAnchors(22)).toBeLessThan(tailAnchors(300));
  });

  it('turns a scribble into a smooth line', () => {
    const calm = calmSignal(zigzag, 4);
    const steps = calm.slice(1).map((value, i) => Math.abs(value - calm[i]));
    const rawSteps = zigzag
      .slice(1)
      .map((value, i) => Math.abs(value - zigzag[i]));
    expect(Math.max(...steps)).toBeLessThan(Math.max(...rawSteps) / 10);
  });

  it('keeps the music’s swing rather than averaging it away', () => {
    // Two swings of the bass across the block: their mean is nothing, and
    // a tail drawn from means would never move.
    const bass = Array.from({ length: TAIL_POINTS }, (_, i) =>
      Math.sin((i / TAIL_POINTS) * Math.PI * 4),
    );
    const calm = calmSignal(bass, 12);
    expect(Math.max(...calm.map(Math.abs))).toBeGreaterThan(0.7);
  });

  it('passes a signal through untouched when asked for every point', () => {
    expect(calmSignal(zigzag, TAIL_POINTS)).toEqual(zigzag);
  });
});

const tone = (amplitude: number, cycles = 3, length = 1024) =>
  Array.from(
    { length },
    (_, i) => amplitude * Math.sin((i / length) * cycles * Math.PI * 2),
  );

describe('the tail’s signal', () => {
  it('is nothing in silence and for an empty block', () => {
    expect(tailSignal(new Array(1024).fill(0))).toEqual(
      new Array(TAIL_POINTS).fill(0),
    );
    expect(tailSignal([])).toEqual(new Array(TAIL_POINTS).fill(0));
  });

  it('follows the music: louder moves it further, and the shape is kept', () => {
    const quiet = tailSignal(tone(0.05));
    const loud = tailSignal(tone(0.3));
    const peak = (values: number[]) => Math.max(...values.map(Math.abs));
    // The control for the null test above: real sound is not flattened.
    expect(peak(quiet)).toBeGreaterThan(0.05);
    expect(peak(loud)).toBeGreaterThan(peak(quiet) * 2);
    // A sine's first half is above the line and its second below.
    expect(loud[2]).toBeGreaterThan(0);
    expect(loud[Math.round(TAIL_POINTS / 6) + 2]).toBeLessThan(0);
  });

  it('bends but never breaks on a block at full scale', () => {
    const clipped = tailSignal(new Array(1024).fill(1));
    clipped.forEach((value) => {
      expect(value).toBeLessThan(1);
      expect(value).toBeGreaterThan(0.99);
    });
  });

  it('smooths a single sample out rather than drawing a spike', () => {
    const block = new Array(1024).fill(0);
    block[512] = 1;
    const spike = tailSignal(block);
    expect(Math.max(...spike)).toBeLessThan(0.2);
  });
});

describe('the tail’s shape', () => {
  it('carries nothing at the join, all of it a quarter along, nothing at the end', () => {
    expect(tailEnvelope(0)).toBe(0);
    expect(tailEnvelope(0.25)).toBeGreaterThan(0.8);
    expect(tailEnvelope(1)).toBe(0);
  });

  it('rests on its still flourish when the music is silent', () => {
    const offsets = tailOffsets(new Array(TAIL_POINTS).fill(0));
    offsets.forEach((offset, i) => {
      expect(offset).toBeCloseTo(tailRest(i / (TAIL_POINTS - 1)), 10);
    });
    // Still a flourish, not a straight line.
    expect(Math.max(...offsets.map(Math.abs))).toBeGreaterThan(0.5);
  });

  it('moves with the music everywhere but the join with the letter', () => {
    const music = new Array(TAIL_POINTS).fill(1);
    const moved = tailOffsets(music);
    const rest = tailOffsets(new Array(TAIL_POINTS).fill(0));
    expect(moved[0]).toBe(rest[0]);
    expect(moved[Math.round(TAIL_POINTS / 4)]).toBeGreaterThan(
      rest[Math.round(TAIL_POINTS / 4)] + TAIL_SWAY_PX * 0.7,
    );
    // Calmer where a title sits on it.
    const calm = tailOffsets(music, TAIL_SWAY_PX * 0.75);
    expect(calm[Math.round(TAIL_POINTS / 4)]).toBeLessThan(
      moved[Math.round(TAIL_POINTS / 4)],
    );
  });

  it('is drawn as an outline that leaves the Q at the pen’s width and thins out', () => {
    const outline = tailOutline(new Array(5).fill(0), 100, 12, 4);
    const points = outline
      .replace(/^M|Z$/g, '')
      .split('L')
      .map((pair) => pair.split(' ').map(Number));
    // Five along the top, five back along the bottom.
    expect(points).toHaveLength(10);
    const [startTop, , , , endTop, endBottom, , , , startBottom] = points;
    expect(startTop[0]).toBe(0);
    expect(endTop[0]).toBe(100);
    expect(startBottom[1] - startTop[1]).toBeCloseTo(4, 5);
    expect(endBottom[1] - endTop[1]).toBeCloseTo(1.5, 5);
  });
});
