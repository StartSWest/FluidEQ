/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  createFrameCadence,
  judgedIntervalMs,
} from '../../../renderer/graph/frameCadence';

describe('the frame cadence', () => {
  it('assumes sixty a second before any frame has been drawn', () => {
    expect(createFrameCadence().intervalMs()).toBeCloseTo(1000 / 60, 3);
  });

  it('reads the display interval from the gaps between frames', () => {
    const cadence = createFrameCadence();
    for (let i = 0; i < 30; i += 1) {
      cadence.note(10 + (i % 3) * 0.1);
    }
    expect(cadence.intervalMs()).toBeCloseTo(10, 0);
  });

  /** A stalled page makes long gaps; the display's beat is the short ones. */
  it('is not fooled by a few stalls of the page', () => {
    const cadence = createFrameCadence();
    for (let i = 0; i < 24; i += 1) {
      cadence.note(i % 4 === 0 ? 120 : 6.94);
    }
    expect(cadence.intervalMs()).toBeCloseTo(6.94, 1);
  });

  it('follows a cap the moment frames arrive at it', () => {
    const cadence = createFrameCadence();
    for (let i = 0; i < 40; i += 1) {
      cadence.note(8.3);
    }
    for (let i = 0; i < 40; i += 1) {
      cadence.note(33.3);
    }
    expect(cadence.intervalMs()).toBeCloseTo(33.3, 0);
  });

  it('clamps nonsense to what a display can do and ignores bad gaps', () => {
    const cadence = createFrameCadence();
    cadence.note(0);
    cadence.note(-5);
    cadence.note(Number.NaN);
    expect(cadence.intervalMs()).toBeCloseTo(1000 / 60, 3);
    for (let i = 0; i < 24; i += 1) {
      cadence.note(0.5);
    }
    expect(cadence.intervalMs()).toBe(4);
    cadence.reset();
    for (let i = 0; i < 24; i += 1) {
      cadence.note(5000);
    }
    expect(cadence.intervalMs()).toBe(100);
  });
});

/**
 * The budget a frame's GPU cost is judged against, when the worker offers its
 * own number for it.
 *
 * A worker that skips animation frames because the GPU is still busy reports
 * a gap equal to the frame's own cost. Judged against that, a scene's cost
 * over its budget is one whatever the scene does — so nothing ever reads slow,
 * nothing ever reads hopeless, and everything reads smooth. That is how a
 * member's scene climbed the warm-up ladder to full size on twelve "smooth"
 * frames of any cost at all.
 */
describe('the interval a cost is judged against', () => {
  const DISPLAY = 1000 / 60;

  it('never takes a gap longer than the display’s own beat', () => {
    expect(judgedIntervalMs(DISPLAY, 500)).toBeCloseTo(DISPLAY, 6);
    expect(judgedIntervalMs(DISPLAY, DISPLAY * 3)).toBeCloseTo(DISPLAY, 6);
  });

  it('takes the worker’s when the page is the slower of the two', () => {
    expect(judgedIntervalMs(100, 16)).toBe(16);
  });

  it('falls back to the display’s beat when there is no other', () => {
    expect(judgedIntervalMs(DISPLAY, undefined)).toBeCloseTo(DISPLAY, 6);
  });

  // What the defect looked like from the ladder's side: a scene costing a
  // third of a second, pacing itself, read as comfortably inside its budget.
  it('stops a frame being measured against itself', () => {
    const cost = 333;
    expect(cost / judgedIntervalMs(DISPLAY, cost)).toBeGreaterThan(10);
  });
});
