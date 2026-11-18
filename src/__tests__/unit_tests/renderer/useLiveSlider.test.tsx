/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A slider whose setting restyles the whole window (`useLiveSlider`): the
 * thumb follows the pointer at once, the setting follows on a painted frame
 * with the newest value only, and after an apply it rests a number of
 * painted frames before the next (Ivan, 2026-11-18, of the Tint's colour
 * picker: "update less often so the user can move the picker better, and
 * when they stop, apply quickly"). Counted in frames, never milliseconds:
 * the frames here are handed out by hand.
 */

import { act, renderHook } from '@testing-library/react';
import useLiveSlider from 'renderer/utils/useLiveSlider';

let queued = new Map<number, FrameRequestCallback>();
let nextId = 0;

beforeEach(() => {
  queued = new Map();
  nextId = 0;
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    nextId += 1;
    queued.set(nextId, callback);
    return nextId;
  });
  jest
    .spyOn(window, 'cancelAnimationFrame')
    .mockImplementation((id) => queued.delete(id));
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** One painted frame: every callback waiting for it runs. */
const paint = () => {
  const due = [...queued.values()];
  queued = new Map();
  act(() => due.forEach((callback) => callback(0)));
};

const mount = (restFrames?: number) => {
  const applied: number[] = [];
  let setting = 0;
  const hook = renderHook(() =>
    useLiveSlider(
      setting,
      (next: number) => {
        setting = next;
        applied.push(next);
      },
      restFrames,
    ),
  );
  return { hook, applied };
};

describe('a heavy slider under the pointer', () => {
  it('shows the pointer’s value at once and applies only the newest on the next frame', () => {
    const { hook, applied } = mount();
    act(() => hook.result.current.set(10));
    act(() => hook.result.current.set(20));
    expect(hook.result.current.shown).toBe(20);
    expect(applied).toEqual([]);
    paint();
    expect(applied).toEqual([20]);
  });

  it('rests one painted frame after an apply by default', () => {
    const { hook, applied } = mount();
    act(() => hook.result.current.set(1));
    paint();
    act(() => hook.result.current.set(2));
    // The frame after an apply is the thumb's alone.
    paint();
    expect(applied).toEqual([1]);
    paint();
    expect(applied).toEqual([1, 2]);
  });

  it('rests as many painted frames as it is asked, and no more', () => {
    const { hook, applied } = mount(6);
    act(() => hook.result.current.set(1));
    paint();
    expect(applied).toEqual([1]);
    act(() => hook.result.current.set(2));
    for (let frame = 0; frame < 6; frame += 1) {
      paint();
      expect(applied).toEqual([1]);
    }
    // The seventh painted frame after the apply takes the newest.
    paint();
    expect(applied).toEqual([1, 2]);
  });

  it('applies the newest value at once when the control says it has settled', () => {
    const { hook, applied } = mount(6);
    act(() => hook.result.current.set(1));
    paint();
    act(() => hook.result.current.set(5));
    act(() => hook.result.current.flush());
    expect(applied).toEqual([1, 5]);
    // CONTROL: nothing is left to apply on a later frame.
    for (let frame = 0; frame < 8; frame += 1) {
      paint();
    }
    expect(applied).toEqual([1, 5]);
  });

  it('applies a value still waiting when the slider goes away', () => {
    const { hook, applied } = mount();
    act(() => hook.result.current.set(7));
    hook.unmount();
    expect(applied).toEqual([7]);
  });

  it('asks for no frame while nothing is moving', () => {
    const { hook } = mount(3);
    act(() => hook.result.current.set(1));
    for (let frame = 0; frame < 5; frame += 1) {
      paint();
    }
    // Rested out with nothing new: the loop has stopped asking.
    expect(queued.size).toBe(0);
  });
});
