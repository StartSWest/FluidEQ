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

import type { ReactNode } from 'react';
import { act, render, renderHook } from '@testing-library/react';
import {
  BOTTOM_WAKE_EDGE_PX,
  CHROME_IDLE_MS,
  SIDE_WAKE_EDGE_PX,
  revealChromeNow,
  toggleChromeNow,
  useIsChromeIdle,
  useIsPointerNearSideChrome,
  watchChromeIdle,
} from '../../../renderer/utils/idleChrome';

const movePointer = (target: EventTarget, clientY: number): void => {
  act(() => {
    target.dispatchEvent(
      new MouseEvent('pointermove', { bubbles: true, clientY }),
    );
  });
};

// The side tabs are the one piece of chrome that reads the horizontal
// position, so these moves have to state both.
const movePointerAt = (
  target: EventTarget,
  clientX: number,
  clientY: number,
): void => {
  act(() => {
    target.dispatchEvent(
      new MouseEvent('pointermove', { bubbles: true, clientX, clientY }),
    );
  });
};

const pressKey = (key: string): void => {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
  });
};

/** The window's workspace as full screen marks it, for the store to find. */
const FullScreen = ({ children }: { children?: ReactNode }) => (
  <div className="app-workspace is-app-full">{children}</div>
);

const idleFrames = new Map<number, FrameRequestCallback>();
let idleFrameId = 0;
const advanceIdleTime = (milliseconds: number) => {
  jest.advanceTimersByTime(milliseconds);
  const callbacks = [...idleFrames.values()];
  idleFrames.clear();
  callbacks.forEach((callback) => callback(performance.now()));
};

describe('idle chrome', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    idleFrames.clear();
    jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        idleFrameId += 1;
        idleFrames.set(idleFrameId, callback);
        return idleFrameId;
      });
    jest
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation((id) => idleFrames.delete(id));
    act(() => watchChromeIdle(false));
  });

  afterEach(() => {
    act(() => watchChromeIdle(false));
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each([
    'view-bar',
    'graph-look-menu',
    'graph-auto-cycle-menu',
    'anchored-menu',
  ])(
    'keeps the chrome out while choosing inside %s, a stationary pointer included',
    (place) => {
      const idle = renderHook(() => useIsChromeIdle());
      const panel = render(
        place === 'anchored-menu' ? (
          <div data-anchored-menu="">
            <button type="button">Text size</button>
          </div>
        ) : (
          <div className={place}>
            <button type="button">Next look</button>
          </div>
        ),
      );
      act(() => watchChromeIdle(true));
      movePointer(panel.getByRole('button'), 200);
      act(() => advanceIdleTime(CHROME_IDLE_MS * 3));
      expect(idle.result.current).toBe(false);
      // The control: off the row, the same stillness puts everything away.
      movePointer(window, 300);
      act(() => advanceIdleTime(CHROME_IDLE_MS));
      expect(idle.result.current).toBe(true);
    },
  );

  it('does not hold the chrome for a pointer on what used to be the graph strip', () => {
    // The graph's strip became a page's options row (`.view-bar`); the old
    // class holds nothing now, or a stale selector would keep the frame up.
    const idle = renderHook(() => useIsChromeIdle());
    const panel = render(
      <div className="live-output-controls">
        <button type="button">Look</button>
      </div>,
    );
    act(() => watchChromeIdle(true));
    movePointer(panel.getByRole('button'), 200);
    act(() => advanceIdleTime(CHROME_IDLE_MS));
    expect(idle.result.current).toBe(true);
  });

  it('reveals the current look while cycling with Space', () => {
    const idle = renderHook(() => useIsChromeIdle());
    act(() => watchChromeIdle(true));
    act(() => advanceIdleTime(CHROME_IDLE_MS));
    expect(idle.result.current).toBe(true);
    act(() =>
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', code: 'Space' }),
      ),
    );
    expect(idle.result.current).toBe(false);
    act(() => advanceIdleTime(CHROME_IDLE_MS - 1));
    expect(idle.result.current).toBe(false);
  });

  it('releases a menu hold when the menu disappears without a pointer move', () => {
    const idle = renderHook(() => useIsChromeIdle());
    const panel = render(
      <div className="graph-look-menu">
        <button type="button">Look</button>
      </div>,
    );
    act(() => watchChromeIdle(true));
    movePointer(panel.getByRole('button'), 200);
    act(() => advanceIdleTime(CHROME_IDLE_MS));
    expect(idle.result.current).toBe(false);
    panel.unmount();
    act(() => advanceIdleTime(CHROME_IDLE_MS));
    expect(idle.result.current).toBe(true);
  });

  it('holds the chrome while the keyboard has its focus in the portalled list', () => {
    const idle = renderHook(() => useIsChromeIdle());
    const panel = render(
      <div className="graph-look-menu">
        <button type="button">Look</button>
      </div>,
    );
    act(() => watchChromeIdle(true));
    pressKey('Tab');
    act(() => panel.getByRole('button').focus());
    act(() => advanceIdleTime(CHROME_IDLE_MS * 3));
    expect(idle.result.current).toBe(false);
    act(() => panel.getByRole('button').blur());
    act(() => advanceIdleTime(CHROME_IDLE_MS));
    expect(idle.result.current).toBe(true);
  });

  it('lets a button that keeps the focus after a click go with the rest', () => {
    // A button keeps the focus after a press; as a hold, that kept the row up
    // until a press somewhere else took the focus away.
    const idle = renderHook(() => useIsChromeIdle());
    const panel = render(
      <div className="view-bar">
        <button type="button">Fit</button>
      </div>,
    );
    act(() => watchChromeIdle(true));
    act(() => panel.getByRole('button').focus());
    // The pointer leaves the row: the focus stays on its button.
    movePointer(window, 300);
    act(() => advanceIdleTime(CHROME_IDLE_MS));
    expect(idle.result.current).toBe(true);
  });

  it('hides after three still seconds and wakes only at the top and bottom edges', () => {
    const { result } = renderHook(() => useIsChromeIdle());

    act(() => watchChromeIdle(true));
    expect(CHROME_IDLE_MS).toBe(3000);
    expect(result.current).toBe(false);

    act(() => advanceIdleTime(CHROME_IDLE_MS - 1));
    expect(result.current).toBe(false);

    act(() => advanceIdleTime(1));
    expect(result.current).toBe(true);

    // The middle of the screen is somebody watching, or a hand resting on a
    // mouse. Waking for that was a bar that never stayed away.
    movePointer(window, Math.round(window.innerHeight / 2));
    expect(result.current).toBe(true);

    // Controls can use the space down to ten pixels above the foot without
    // summoning the transport.
    movePointer(window, window.innerHeight - BOTTOM_WAKE_EDGE_PX - 1);
    expect(result.current).toBe(true);

    // The last ten pixels are the deliberate reveal target.
    movePointer(window, window.innerHeight - 4);
    expect(result.current).toBe(false);

    act(() => advanceIdleTime(CHROME_IDLE_MS));
    expect(result.current).toBe(true);

    // And the head of the window, in a pane, is a generous band.
    movePointer(window, 100);
    expect(result.current).toBe(false);

    act(() => advanceIdleTime(CHROME_IDLE_MS));
    expect(result.current).toBe(true);

    act(() => revealChromeNow());
    expect(result.current).toBe(false);
  });

  it('wakes full screen only at the very top, so reaching the row never brings the header', () => {
    const { result } = renderHook(() => useIsChromeIdle());
    render(<FullScreen />);

    act(() => watchChromeIdle(true));
    act(() => advanceIdleTime(CHROME_IDLE_MS));
    expect(result.current).toBe(true);

    // The row stands 7-11px under the top: a reach for its buttons is not
    // the edge. The same move in a pane wakes the chrome (above).
    movePointer(window, 10);
    expect(result.current).toBe(true);

    movePointer(window, 3);
    expect(result.current).toBe(false);
  });

  it('puts full screen away on a click on the drawing, and nothing in a pane', () => {
    const { result } = renderHook(() => useIsChromeIdle());
    act(() => watchChromeIdle(true));
    // A click on the plot in a pane is editing a band.
    act(() => toggleChromeNow());
    expect(result.current).toBe(false);

    const frame = render(<FullScreen />);
    act(() => toggleChromeNow());
    expect(result.current).toBe(true);
    // And a second click brings nothing back: the chrome comes from the edges.
    act(() => toggleChromeNow());
    expect(result.current).toBe(true);
    frame.unmount();
  });

  it.each(['now-playing-bar', 'look-designer'])(
    'in full screen keeps the chrome out while the pointer is inside %s, but never summons it from there',
    (className) => {
      const idle = renderHook(() => useIsChromeIdle());
      const panel = render(
        <FullScreen>
          <div className={className}>
            <button type="button">Control</button>
          </div>
        </FullScreen>,
      );
      const middle = Math.round(window.innerHeight / 2);

      act(() => watchChromeIdle(true));
      act(() => advanceIdleTime(CHROME_IDLE_MS));
      expect(idle.result.current).toBe(true);

      // The panel can hold a bar that is out, but cannot bring one from the
      // middle of the screen by itself.
      movePointer(panel.getByRole('button'), middle);
      expect(idle.result.current).toBe(true);

      movePointer(window, window.innerHeight - 4);
      expect(idle.result.current).toBe(false);

      movePointer(panel.getByRole('button'), middle);
      act(() => advanceIdleTime(CHROME_IDLE_MS * 3));
      expect(idle.result.current).toBe(false);

      // Leaving it starts the grace period rather than snapping it shut.
      movePointer(window, middle);
      expect(idle.result.current).toBe(false);
      act(() => advanceIdleTime(CHROME_IDLE_MS - 1));
      expect(idle.result.current).toBe(false);
      act(() => advanceIdleTime(1));
      expect(idle.result.current).toBe(true);
    },
  );

  it('holds nothing from the transport docked under a pane', () => {
    // Docked, the bar pushes nothing; a hand resting on it would otherwise
    // keep the graph's strip up for good.
    const idle = renderHook(() => useIsChromeIdle());
    const panel = render(
      <div className="now-playing-bar">
        <button type="button">Control</button>
      </div>,
    );
    act(() => watchChromeIdle(true));
    movePointer(panel.getByRole('button'), Math.round(window.innerHeight / 2));
    act(() => advanceIdleTime(CHROME_IDLE_MS));
    expect(idle.result.current).toBe(true);
  });

  it.each(['karaoke-playlist', 'karaoke-pitch'])(
    'lets the Karaoke %s go with the rest under a resting pointer',
    (className) => {
      // They fill most of a full-screen stage: a pointer resting on either
      // held the header and the bar up for good (2026-11-16).
      const idle = renderHook(() => useIsChromeIdle());
      const panel = render(
        <FullScreen>
          <div className={className}>
            <button type="button">Line</button>
          </div>
        </FullScreen>,
      );
      act(() => watchChromeIdle(true));
      movePointer(window, window.innerHeight - 4);
      movePointer(
        panel.getByRole('button'),
        Math.round(window.innerHeight / 2),
      );
      act(() => advanceIdleTime(CHROME_IDLE_MS));
      expect(idle.result.current).toBe(true);
    },
  );

  it('summons the drawer tabs from either side edge without waking the bars', () => {
    const idle = renderHook(() => useIsChromeIdle());
    const nearSide = renderHook(() => useIsPointerNearSideChrome());
    const middleY = Math.round(window.innerHeight / 2);
    const middleX = Math.round(window.innerWidth / 2);

    act(() => watchChromeIdle(true));
    act(() => advanceIdleTime(CHROME_IDLE_MS));
    expect(idle.result.current).toBe(true);
    expect(nearSide.result.current).toBe(false);

    // The middle of the picture is somebody watching it.
    movePointerAt(window, middleX, middleY);
    expect(nearSide.result.current).toBe(false);

    // Reaching an edge shows the handle there — and nothing else. The header
    // and the transport are a separate errand and stay where they were.
    movePointerAt(window, 4, middleY);
    expect(nearSide.result.current).toBe(true);
    expect(idle.result.current).toBe(true);

    movePointerAt(window, middleX, middleY);
    expect(nearSide.result.current).toBe(false);

    movePointerAt(window, window.innerWidth - 4, middleY);
    expect(nearSide.result.current).toBe(true);

    // Just inside the band, and just outside it.
    movePointerAt(window, SIDE_WAKE_EDGE_PX, middleY);
    expect(nearSide.result.current).toBe(true);
    movePointerAt(window, SIDE_WAKE_EDGE_PX + 1, middleY);
    expect(nearSide.result.current).toBe(false);
    expect(idle.result.current).toBe(true);
  });

  it('holds a tab under a resting pointer and drops it three seconds after the pointer leaves the display', () => {
    const nearSide = renderHook(() => useIsPointerNearSideChrome());
    const tab = render(
      <button type="button" className="side-bar-toggle">
        Sound
      </button>,
    );
    const middleY = Math.round(window.innerHeight / 2);
    const middleX = Math.round(window.innerWidth / 2);

    act(() => watchChromeIdle(true));
    act(() => advanceIdleTime(CHROME_IDLE_MS));

    // An open drawer carries its tab inward, well clear of the band that
    // revealed it, so the tab itself has to count as the edge.
    movePointerAt(tab.getByRole('button'), middleX, middleY);
    expect(nearSide.result.current).toBe(true);

    act(() => advanceIdleTime(CHROME_IDLE_MS * 3));
    expect(nearSide.result.current).toBe(true);

    // Off the tab and away from the edge: gone at once, because the answer to
    // "there is a panel this way" was no.
    movePointerAt(window, middleX, middleY);
    expect(nearSide.result.current).toBe(false);

    // And the case with no further moves to read: a pointer that reached the
    // edge and then left for another display. The still seconds take the
    // handle away, exactly as they take the bars.
    movePointerAt(window, 4, middleY);
    expect(nearSide.result.current).toBe(true);
    act(() => advanceIdleTime(CHROME_IDLE_MS - 1));
    expect(nearSide.result.current).toBe(true);
    act(() => advanceIdleTime(1));
    expect(nearSide.result.current).toBe(false);
  });

  const stripAt = (fullScreen: boolean) => {
    const strip = render(
      fullScreen ? (
        <FullScreen>
          <div className="view-bar">
            <div className="view-bar__group">controls</div>
          </div>
        </FullScreen>
      ) : (
        <div className="view-bar">
          <div className="view-bar__group">controls</div>
        </div>
      ),
    );
    const cluster = strip.container.querySelector('.view-bar__group');
    if (!(cluster instanceof HTMLElement)) {
      throw new Error('the strip has no controls');
    }
    jest.spyOn(cluster, 'getBoundingClientRect').mockReturnValue({
      left: 300,
      right: 800,
      top: 300,
      bottom: 350,
      width: 500,
      height: 50,
      x: 300,
      y: 300,
      toJSON: () => ({}),
    });
  };

  it('brings a page’s options row back for a pointer over its place, wherever the row is', () => {
    const idle = renderHook(() => useIsChromeIdle());
    // The row in a pane, halfway down the window: nowhere near either band.
    stripAt(false);
    act(() => watchChromeIdle(true));
    act(() => advanceIdleTime(CHROME_IDLE_MS));
    expect(idle.result.current).toBe(true);

    // The control: the plot below the row is somebody watching.
    movePointerAt(window, 500, 500);
    expect(idle.result.current).toBe(true);

    // Just short of the row, within reach of its controls.
    movePointerAt(window, 500, 290);
    expect(idle.result.current).toBe(false);
  });

  it('does not bring the whole frame back in full screen for a pointer over the faded row', () => {
    const idle = renderHook(() => useIsChromeIdle());
    stripAt(true);
    act(() => watchChromeIdle(true));
    act(() => advanceIdleTime(CHROME_IDLE_MS));
    expect(idle.result.current).toBe(true);

    movePointerAt(window, 500, 290);
    expect(idle.result.current).toBe(true);
  });
});
