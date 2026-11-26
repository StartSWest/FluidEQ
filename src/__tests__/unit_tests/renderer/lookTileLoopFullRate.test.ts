/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Ivan, 2026-11-26: "only the selected one, and at full unlimited fps". The
 * look picker's one live tile is drawn on every animation frame the display
 * gives - 60, 144 or 240 a second - with each frame's own step, where it
 * used to be held to twelve a second under a shared budget. Nothing is drawn
 * or asked for once no drawing is registered, or while the window is
 * hidden.
 */

import { createLookTileLoop } from '../../../renderer/graph/lookTileLoop';

let frames: FrameRequestCallback[] = [];
let hidden = false;

beforeAll(() => {
  window.requestAnimationFrame = (callback) => {
    frames.push(callback);
    return frames.length;
  };
  window.cancelAnimationFrame = () => {
    frames = [];
  };
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hidden,
  });
});

beforeEach(() => {
  frames = [];
  hidden = false;
});

/** A drawing that keeps every step it was handed. */
const drawingOn = (loop: ReturnType<typeof createLookTileLoop>) => {
  const steps: number[] = [];
  const remove = loop.add({
    draw: (deltaMs) => steps.push(deltaMs),
    canvas: () => null,
  });
  return { steps, remove };
};

/** A second of a display giving `hz` frames. */
const runSecond = (hz: number, from: number) => {
  for (let index = 1; index <= hz; index += 1) {
    const due = frames;
    frames = [];
    due.forEach((callback) => callback(from + (index * 1000) / hz));
  }
};

it.each([60, 144, 240])(
  'draws the tile on every one of a %i Hz display’s frames',
  (hz) => {
    const loop = createLookTileLoop();
    const { steps } = drawingOn(loop);
    runSecond(hz, 1000);
    expect(steps).toHaveLength(hz);
    // Each frame's own step after the first, so the drawing moves at the
    // music's pace whatever the display.
    steps.slice(1).forEach((step) => expect(step).toBeCloseTo(1000 / hz, 6));
    loop.dispose();
  },
);

it('asks for no frame once the drawing is let go, and again when one comes', () => {
  const loop = createLookTileLoop();
  const { steps, remove } = drawingOn(loop);
  runSecond(60, 1000);
  remove();
  runSecond(60, 2000);
  expect(frames).toHaveLength(0);
  expect(steps).toHaveLength(60);
  // The control: a new drawing starts the loop again.
  const next = drawingOn(loop);
  runSecond(60, 3000);
  expect(next.steps).toHaveLength(60);
  loop.dispose();
});

it('draws nothing while the window is hidden, and the first frame back is one step', () => {
  const loop = createLookTileLoop();
  const { steps } = drawingOn(loop);
  runSecond(60, 1000);
  hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  expect(frames).toHaveLength(0);
  hidden = false;
  document.dispatchEvent(new Event('visibilitychange'));
  // Ten seconds later: the absence is not drawn as one long step.
  const due = frames;
  frames = [];
  due.forEach((callback) => callback(12000));
  expect(steps).toHaveLength(61);
  expect(steps[60]).toBeLessThanOrEqual(1000 / 60);
  loop.dispose();
});

it('stops for good once disposed', () => {
  const loop = createLookTileLoop();
  drawingOn(loop);
  loop.dispose();
  expect(frames).toHaveLength(0);
});
