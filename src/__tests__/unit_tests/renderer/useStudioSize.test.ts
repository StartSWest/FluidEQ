/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, renderHook } from '@testing-library/react';
import useStudioSize from '../../../renderer/studio/useStudioSize';

/**
 * The stage is tried at the graph's own shape or full screen; the Narrow and
 * Wide sizes went (Ivan, 2026-09-27). Every way out of full screen lands back
 * on the graph's.
 */

const sized = () => renderHook(() => useStudioSize());

describe('the Studio stage size', () => {
  it('starts at the graph’s size, and full screen gives it back', () => {
    const { result } = sized();
    expect(result.current.size).toBe('graph');
    act(() => result.current.toggleFullscreen());
    expect(result.current.size).toBe('full');
    act(() => result.current.exitFullscreen());
    expect(result.current.size).toBe('graph');
  });

  it('toggles full screen on and off', () => {
    const { result } = sized();
    act(() => result.current.toggleFullscreen());
    expect(result.current.size).toBe('full');
    act(() => result.current.toggleFullscreen());
    expect(result.current.size).toBe('graph');
  });

  it('leaves the graph’s size alone when asked to leave full screen', () => {
    const { result } = sized();
    act(() => result.current.exitFullscreen());
    expect(result.current.size).toBe('graph');
  });

  // The stage's full-screen effect depends on exitFullscreen: a new function
  // every render would tear it down and run it again, re-requesting full
  // screen and re-subscribing to fullscreenchange on each render.
  it('hands out the same functions across renders', () => {
    const { result } = sized();
    const first = result.current;
    act(() => result.current.toggleFullscreen());
    expect(result.current.exitFullscreen).toBe(first.exitFullscreen);
    expect(result.current.toggleFullscreen).toBe(first.toggleFullscreen);
  });
});
