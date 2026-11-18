/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Over a full-screen picture the header, the page's options row and the
 * transport come and go as one (Ivan, 2026-11-17: "whether I move up or
 * down, always all together, so both panels open"). The top and bottom
 * edges had a flag each for a day, and the row, which answered the clock
 * alone, came out with either, so going up or down showed two of the three.
 * Now one idle state: either edge brings the whole frame back, the clock
 * takes it all away, and in full screen the faded row no longer wakes the
 * frame by itself.
 */

import { act, renderHook } from '@testing-library/react';
import {
  CHROME_IDLE_MS,
  useIsChromeIdle,
  watchChromeIdle,
} from '../../../renderer/utils/idleChrome';

let now = 0;
const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;

/** Time passes and the frames waiting on it are painted. */
const advance = (milliseconds: number) => {
  act(() => {
    now += milliseconds;
    const due = [...frames.values()];
    frames.clear();
    due.forEach((callback) => callback(now));
  });
};

const moveTo = (clientX: number, clientY: number) => {
  act(() => {
    document.body.dispatchEvent(
      new MouseEvent('pointermove', { bubbles: true, clientX, clientY }),
    );
  });
};

/** The window in full screen, as the shell marks it, or in its panes. */
const fullScreen = (isFull: boolean) => {
  document.body.innerHTML = `<div class="app-workspace${
    isFull ? ' is-app-full' : ''
  }"></div>`;
};

/** A page's options row, faded, standing mid-window at 300 to 330px. */
const addOptionsRow = () => {
  const row = document.createElement('div');
  row.className = 'view-bar';
  const control = document.createElement('button');
  row.append(control);
  document.body.append(row);
  jest.spyOn(control, 'getBoundingClientRect').mockReturnValue({
    x: 100,
    y: 300,
    left: 100,
    top: 300,
    right: 200,
    bottom: 330,
    width: 100,
    height: 30,
    toJSON: () => ({}),
  });
};

beforeEach(() => {
  now = 0;
  frames.clear();
  jest.spyOn(performance, 'now').mockImplementation(() => now);
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    nextFrame += 1;
    frames.set(nextFrame, callback);
    return nextFrame;
  });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
});

afterEach(() => {
  act(() => watchChromeIdle(false));
  document.body.innerHTML = '';
  jest.restoreAllMocks();
});

/** Watching, and left still until the chrome has gone. */
const watchUntilIdle = () => {
  const idle = renderHook(() => useIsChromeIdle());
  act(() => watchChromeIdle(true));
  expect(idle.result.current).toBe(false);
  advance(CHROME_IDLE_MS);
  expect(idle.result.current).toBe(true);
  return idle;
};

it('brings the whole frame back from either edge, and the clock takes it all away', () => {
  fullScreen(true);
  const idle = watchUntilIdle();

  // The bottom edge: the one state, so the header and the row come too.
  moveTo(400, window.innerHeight - 2);
  expect(idle.result.current).toBe(false);
  advance(CHROME_IDLE_MS);
  expect(idle.result.current).toBe(true);

  // The top edge, the same state.
  moveTo(400, 2);
  expect(idle.result.current).toBe(false);
});

it('POSITIVE CONTROL: brings nothing back for a move in the middle of the picture', () => {
  fullScreen(true);
  const idle = watchUntilIdle();
  moveTo(400, window.innerHeight / 2);
  expect(idle.result.current).toBe(true);
});

it('is not woken in full screen by the faded options row, as it is in a pane', () => {
  fullScreen(true);
  addOptionsRow();
  const full = watchUntilIdle();
  moveTo(150, 315);
  expect(full.result.current).toBe(true);
  act(() => watchChromeIdle(false));
  full.unmount();

  // In a pane the row is found where it faded, and brings the chrome back.
  fullScreen(false);
  addOptionsRow();
  const pane = watchUntilIdle();
  moveTo(150, 315);
  expect(pane.result.current).toBe(false);
});
