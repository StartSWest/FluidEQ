/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, renderHook } from '@testing-library/react';
import useStudioSize from '../../../renderer/studio/useStudioSize';

/**
 * Leaving full screen — Escape, its own button, a double click — used to land
 * on the graph's size whatever the stage had been, so somebody testing the
 * narrow panel was put back on the wide one every time.
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

  it('toggles full screen back to the size chosen before it', () => {
    const { result } = sized();
    act(() => result.current.choose('narrow'));
    expect(result.current.size).toBe('narrow');
    act(() => result.current.toggleFullscreen());
    expect(result.current.size).toBe('full');
    act(() => result.current.toggleFullscreen());
    expect(result.current.size).toBe('narrow');
  });

  it('leaves full screen for the last windowed size, not the graph’s', () => {
    const { result } = sized();
    act(() => result.current.choose('wide'));
    act(() => result.current.toggleFullscreen());
    act(() => result.current.exitFullscreen());
    expect(result.current.size).toBe('wide');

    // The size chosen last wins, however many came before it.
    act(() => result.current.choose('narrow'));
    act(() => result.current.toggleFullscreen());
    act(() => result.current.exitFullscreen());
    expect(result.current.size).toBe('narrow');
  });

  it('keeps the windowed size when full screen is chosen from the size menu', () => {
    const { result } = sized();
    act(() => result.current.choose('narrow'));
    act(() => result.current.choose('full'));
    expect(result.current.size).toBe('full');
    act(() => result.current.exitFullscreen());
    expect(result.current.size).toBe('narrow');

    act(() => result.current.choose('full'));
    act(() => result.current.toggleFullscreen());
    expect(result.current.size).toBe('narrow');
  });

  it('leaves a windowed size alone when asked to leave full screen', () => {
    const { result } = sized();
    act(() => result.current.choose('wide'));
    act(() => result.current.exitFullscreen());
    expect(result.current.size).toBe('wide');
  });

  // The stage's full-screen effect depends on exitFullscreen: a new function
  // every render would tear it down and run it again, re-requesting full
  // screen and re-subscribing to fullscreenchange on each render.
  it('hands out the same functions across renders', () => {
    const { result } = sized();
    const first = result.current;
    act(() => result.current.choose('narrow'));
    act(() => result.current.toggleFullscreen());
    expect(result.current.choose).toBe(first.choose);
    expect(result.current.exitFullscreen).toBe(first.exitFullscreen);
    expect(result.current.toggleFullscreen).toBe(first.toggleFullscreen);
  });
});
