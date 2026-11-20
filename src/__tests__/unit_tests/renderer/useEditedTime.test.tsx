/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The end of the day the scene's hour is nearer (`useNearerEnd`), which the
 * Studio's Brightness lights under its track. It is what is left of
 * `useEditedTime`: the window colour editors opened the night's or the day's
 * colours by it and followed the hour across the middle of the day (Ivan,
 * 2026-11-18), then five points (999171dd0), and since 58d70ea7e a scene has
 * one set, so there is no tab to open or press - the case for a tab pressed
 * by hand went with them. The hour here follows the Brightness, its default.
 */

import { act, renderHook } from '@testing-library/react';
import { setThemeShade } from 'renderer/utils/theme';
import { useNearerEnd } from 'renderer/utils/useNearerEnd';

afterEach(() => {
  act(() => setThemeShade(38));
  window.localStorage.clear();
});

describe('the end of the day the hour is nearer', () => {
  it('is the night below the middle of the day and the day above it', () => {
    act(() => setThemeShade(20));
    expect(renderHook(() => useNearerEnd()).result.current).toBe('night');
    act(() => setThemeShade(80));
    expect(renderHook(() => useNearerEnd()).result.current).toBe('day');
  });

  it('follows the hour as it crosses the middle, both ways', () => {
    act(() => setThemeShade(20));
    const { result } = renderHook(() => useNearerEnd());
    expect(result.current).toBe('night');
    act(() => setThemeShade(30));
    // On the same side: still the night.
    expect(result.current).toBe('night');
    act(() => setThemeShade(70));
    expect(result.current).toBe('day');
    act(() => setThemeShade(30));
    expect(result.current).toBe('night');
  });
});
