/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What a listener who has asked for less motion gets from a scene.
 *
 * The clock is the one lever that reaches every scene: a member writes
 * whatever shader they like, and the only things all of them are handed are a
 * time and an elapsed.
 */

import { renderHook, act } from '@testing-library/react';
import {
  REDUCED_MOTION_SPEED,
  useSceneMotionSpeed,
} from '../../../renderer/graph/sceneMotionSpeed';

/** A `matchMedia` that answers `reduce` and can change its mind. */
const asking = (reduced: boolean) => {
  const listeners = new Set<() => void>();
  const query = {
    matches: reduced,
    addEventListener: (_: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) =>
      listeners.delete(listener),
  };
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (text: string) =>
      text.includes('prefers-reduced-motion')
        ? query
        : {
            matches: false,
            addEventListener: () => {},
            removeEventListener: () => {},
          },
  });
  return {
    set: (next: boolean) => {
      query.matches = next;
      listeners.forEach((listener) => listener());
    },
  };
};

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia');
});

it('runs a scene at full speed for a listener who has not asked', () => {
  asking(false);
  const { result } = renderHook(() => useSceneMotionSpeed());
  expect(result.current).toBe(1);
});

it('slows a scene’s own time for a listener who has', () => {
  asking(true);
  const { result } = renderHook(() => useSceneMotionSpeed());
  expect(result.current).toBe(REDUCED_MOTION_SPEED);
});

it('never stops a scene, because reduce is not remove', () => {
  // The ambient layer answers this setting by drawing nothing, which costs a
  // listener some decoration over the app. A visualizer held still is the
  // feature switched off, so this has to stay above zero — and far enough
  // below one to be worth asking for.
  expect(REDUCED_MOTION_SPEED).toBeGreaterThan(0);
  expect(REDUCED_MOTION_SPEED).toBeLessThan(0.5);
});

it('follows the setting while a scene is playing', () => {
  const query = asking(false);
  const { result } = renderHook(() => useSceneMotionSpeed());
  expect(result.current).toBe(1);
  act(() => query.set(true));
  expect(result.current).toBe(REDUCED_MOTION_SPEED);
  act(() => query.set(false));
  expect(result.current).toBe(1);
});

it('animates where the question cannot be asked at all', () => {
  // Under a test environment, or a renderer still booting: reduced motion is
  // the answer only when it is actually set.
  Reflect.deleteProperty(window, 'matchMedia');
  const { result } = renderHook(() => useSceneMotionSpeed());
  expect(result.current).toBe(1);
});
