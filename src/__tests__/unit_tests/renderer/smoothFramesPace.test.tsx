/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The wave, the meter, the graph's 2D looks and the ambient layer draw on
 * every frame the display offers. With Rainbow mode off they used to be held
 * to thirty a second (Ivan, 2026-09-27: "when rainbow is off is cap so no more
 * caps pls"). A consumer's own pace (a scene's, `minFrameMs`) is still kept.
 */

import { act, renderHook } from '@testing-library/react';
import useSmoothFrames from '../../../renderer/utils/useSmoothFrames';

const HZ = 144;

/** How many frames one second of a 144 Hz display draws. */
const drawnInASecond = (minFrameMs?: () => number) => {
  const frames: FrameRequestCallback[] = [];
  const raf = jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
  const now = jest.spyOn(performance, 'now').mockReturnValue(1000);
  let drawn = 0;
  try {
    const { result, unmount } = renderHook(() =>
      useSmoothFrames(
        () => {
          drawn += 1;
          return true;
        },
        { isEnabled: true, minFrameMs },
      ),
    );
    act(() => result.current());
    for (let frame = 1; frame <= HZ; frame += 1) {
      act(() => frames.shift()?.(1000 + (frame * 1000) / HZ));
    }
    unmount();
  } finally {
    raf.mockRestore();
    now.mockRestore();
  }
  return drawn;
};

afterEach(() => document.documentElement.classList.remove('is-euphoric'));

it.each([false, true])(
  'draws every frame a 144 Hz display offers, Rainbow mode %s',
  (euphoric) => {
    document.documentElement.classList.toggle('is-euphoric', euphoric);
    expect(drawnInASecond()).toBe(HZ);
  },
);

// The control: the same display, and a consumer that asks for thirty.
it('holds a consumer to the pace it asks for', () => {
  const drawn = drawnInASecond(() => 1000 / 30);
  expect(drawn).toBeGreaterThanOrEqual(28);
  expect(drawn).toBeLessThanOrEqual(36);
});
