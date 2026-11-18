/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window colour editors open the time the scene's hour is nearer, and
 * follow the hour across the middle of the day (Ivan, 2026-11-18: "que el
 * slider también seleccione el card de colores de día si paso a día y así
 * para si paso a noche"). A tab pressed by hand stays until the hour crosses
 * again. The hour here follows the Brightness, its default.
 */

import { act, renderHook } from '@testing-library/react';
import { setThemeShade } from 'renderer/utils/theme';
import useEditedTime from 'renderer/utils/useEditedTime';

afterEach(() => {
  act(() => setThemeShade(38));
  window.localStorage.clear();
});

describe('the time an editor opens on', () => {
  it('is the night below the middle of the day and the day above it', () => {
    act(() => setThemeShade(20));
    expect(renderHook(() => useEditedTime()).result.current[0]).toBe('night');
    act(() => setThemeShade(80));
    expect(renderHook(() => useEditedTime()).result.current[0]).toBe('day');
  });

  it('follows the hour as it crosses the middle, both ways', () => {
    act(() => setThemeShade(20));
    const { result } = renderHook(() => useEditedTime());
    expect(result.current[0]).toBe('night');
    act(() => setThemeShade(70));
    expect(result.current[0]).toBe('day');
    act(() => setThemeShade(30));
    expect(result.current[0]).toBe('night');
  });

  it('keeps a tab pressed by hand until the hour crosses again', () => {
    act(() => setThemeShade(20));
    const { result } = renderHook(() => useEditedTime());
    act(() => result.current[1]('day'));
    expect(result.current[0]).toBe('day');
    // The hour moves, but on the same side: the pressed tab stays.
    act(() => setThemeShade(30));
    expect(result.current[0]).toBe('day');
    // It crosses: the editor follows it again.
    act(() => setThemeShade(70));
    expect(result.current[0]).toBe('day');
    act(() => setThemeShade(30));
    expect(result.current[0]).toBe('night');
  });
});
