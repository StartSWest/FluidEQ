/*
<AQUA: System-wide parametric audio equalizer interface>
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
  CHROME_IDLE_MS,
  revealChromeNow,
  useIsChromeIdle,
  watchChromeIdle,
} from '../../../renderer/utils/idleChrome';

describe('idle chrome', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    watchChromeIdle(false);
  });

  afterEach(() => {
    watchChromeIdle(false);
    jest.useRealTimers();
  });

  it('hides after five seconds and wakes only for a move into the chrome bands', () => {
    const { result } = renderHook(() => useIsChromeIdle());

    act(() => watchChromeIdle(true));
    expect(CHROME_IDLE_MS).toBe(5000);
    expect(result.current).toBe(false);

    act(() => jest.advanceTimersByTime(CHROME_IDLE_MS - 1));
    expect(result.current).toBe(false);

    act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe(true);

    // The middle of the screen is somebody watching, or a hand resting on a
    // mouse. Waking for that was a bar that never stayed away.
    act(() => {
      window.dispatchEvent(
        new MouseEvent('pointermove', {
          clientY: Math.round(window.innerHeight / 2),
        }),
      );
    });
    expect(result.current).toBe(true);

    // The foot of the window is where the transport is, and going there is
    // reaching for it.
    act(() => {
      window.dispatchEvent(
        new MouseEvent('pointermove', { clientY: window.innerHeight - 4 }),
      );
    });
    expect(result.current).toBe(false);

    act(() => jest.advanceTimersByTime(CHROME_IDLE_MS));
    expect(result.current).toBe(true);

    // And the head of it is where the graph's own toolbar is.
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientY: 4 }));
    });
    expect(result.current).toBe(false);

    act(() => jest.advanceTimersByTime(CHROME_IDLE_MS));
    expect(result.current).toBe(true);

    act(() => revealChromeNow());
    expect(result.current).toBe(false);
  });
});
