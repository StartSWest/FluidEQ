/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { act, renderHook } from '@testing-library/react';
import {
  INACTIVE_PLAYER_DISPOSE_MS,
  useIdlePlayerMount,
} from '../../../renderer/audio/useIdlePlayerMount';

describe('inactive player disposal', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('disposes a loaded silent player after the bounded tab-switch lease', () => {
    const hook = renderHook(
      ({ isActive, isPlaying }) =>
        useIdlePlayerMount({
          isActive,
          hasLoadedSource: true,
          isPlaying,
        }),
      { initialProps: { isActive: true, isPlaying: false } },
    );

    hook.rerender({ isActive: false, isPlaying: false });
    expect(hook.result.current).toBe(true);

    act(() => jest.advanceTimersByTime(INACTIVE_PLAYER_DISPOSE_MS - 1));
    expect(hook.result.current).toBe(true);

    act(() => jest.advanceTimersByTime(1));
    expect(hook.result.current).toBe(false);
  });

  it('cancels disposal when hidden playback starts', () => {
    const hook = renderHook(
      ({ isPlaying }) =>
        useIdlePlayerMount({
          isActive: false,
          hasLoadedSource: true,
          isPlaying,
        }),
      { initialProps: { isPlaying: false } },
    );

    act(() => jest.advanceTimersByTime(INACTIVE_PLAYER_DISPOSE_MS - 1));
    hook.rerender({ isPlaying: true });
    act(() => jest.advanceTimersByTime(INACTIVE_PLAYER_DISPOSE_MS));

    expect(hook.result.current).toBe(true);
  });

  it('drops an empty hidden player immediately and remounts on return', () => {
    const hook = renderHook(
      ({ isActive }) =>
        useIdlePlayerMount({
          isActive,
          hasLoadedSource: false,
          isPlaying: false,
        }),
      { initialProps: { isActive: false } },
    );

    expect(hook.result.current).toBe(false);
    hook.rerender({ isActive: true });
    expect(hook.result.current).toBe(true);
  });
});
