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

import { act, render, renderHook } from '@testing-library/react';
import {
  BOTTOM_WAKE_EDGE_PX,
  CHROME_IDLE_MS,
  revealChromeNow,
  useIsChromeIdle,
  useIsPointerNearBottom,
  watchChromeIdle,
} from '../../../renderer/utils/idleChrome';

const movePointer = (target: EventTarget, clientY: number): void => {
  act(() => {
    target.dispatchEvent(
      new MouseEvent('pointermove', { bubbles: true, clientY }),
    );
  });
};

describe('idle chrome', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    act(() => watchChromeIdle(false));
  });

  afterEach(() => {
    act(() => watchChromeIdle(false));
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

    // Controls can now use the space down to ten pixels above the foot without
    // summoning the transport.
    act(() => {
      window.dispatchEvent(
        new MouseEvent('pointermove', {
          clientY: window.innerHeight - BOTTOM_WAKE_EDGE_PX - 1,
        }),
      );
    });
    expect(result.current).toBe(true);

    // The last ten pixels are the deliberate reveal target.
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

  it.each(['look-designer', 'karaoke-playlist', 'karaoke-pitch'])(
    'keeps the transport open while the pointer is inside %s',
    (className) => {
      const idle = renderHook(() => useIsChromeIdle());
      const nearBottom = renderHook(() => useIsPointerNearBottom());
      const panel = render(
        <div className={className} data-testid="bottom-chrome-surface">
          <button type="button">Control</button>
        </div>,
      );

      act(() => watchChromeIdle(true));
      act(() => jest.advanceTimersByTime(CHROME_IDLE_MS));
      expect(idle.result.current).toBe(true);

      movePointer(window, window.innerHeight - 4);
      expect(idle.result.current).toBe(false);
      expect(nearBottom.result.current).toBe(true);

      movePointer(
        panel.getByRole('button'),
        Math.round(window.innerHeight / 2),
      );
      act(() => jest.advanceTimersByTime(CHROME_IDLE_MS));
      expect(idle.result.current).toBe(false);
      expect(nearBottom.result.current).toBe(true);

      movePointer(window, Math.round(window.innerHeight / 2));
      expect(nearBottom.result.current).toBe(false);
    },
  );
});
