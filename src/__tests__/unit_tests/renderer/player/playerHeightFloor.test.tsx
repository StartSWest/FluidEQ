/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The least tall the amp may be dragged, measured with the sound open
 * (Ivan, 2026-10-25: "we need a way to avoid scroll on the full amp ui"),
 * and never on a resize of the window: folding to one line is a resize, a
 * floor measured then stood the window straight back up, and the fold
 * bounced ("the fold to 1 line sucks and restore from it also sucks").
 */

import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import type { TPlayerSoundFace } from 'renderer/player/playerLayout';
import usePlayerHeightFloor from 'renderer/player/usePlayerHeightFloor';

const holdPlayerHeight = jest.fn();

jest.mock('renderer/player/windowModeStore', () => ({
  holdPlayerHeight: (height: number | null, floor: number | null) =>
    holdPlayerHeight(height, floor),
}));

/** What the observer on the transport was told to call, and on what. */
let observed: { callback: () => void; target?: Element } | undefined;

const realObserver = globalThis.ResizeObserver;

beforeEach(() => {
  holdPlayerHeight.mockClear();
  observed = undefined;
  // Called with `new`, a mock that returns an object constructs that object.
  globalThis.ResizeObserver = jest.fn((callback: () => void) => {
    observed = { callback };
    return {
      observe: (target: Element) => {
        if (observed) {
          observed.target = target;
        }
      },
      unobserve: () => undefined,
      disconnect: () => {
        observed = undefined;
      },
    };
  }) as unknown as typeof ResizeObserver;
});

afterEach(() => {
  globalThis.ResizeObserver = realObserver;
});

/**
 * jsdom lays nothing out, so the amp's height is said by hand: 765 laid out
 * for the measurement (the sound open), 600 as it stands.
 */
const heightOf = (root: HTMLElement) =>
  root.classList.contains('is-measuring') ? 765.2 : 600;

const Amp = ({
  isFolded,
  face,
}: {
  isFolded: boolean;
  face: TPlayerSoundFace;
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  usePlayerHeightFloor(rootRef, isFolded, face);
  return (
    <div
      ref={(node) => {
        rootRef.current = node;
        if (node) {
          node.getBoundingClientRect = () =>
            ({ height: heightOf(node) }) as DOMRect;
        }
      }}
      className="mini-player"
      data-testid="amp"
    >
      <div className="player-dock" />
    </div>
  );
};

describe('the amp’s least height', () => {
  it('is the amp laid out with its sound open, in whole pixels, and leaves it as it was', () => {
    const { getByTestId } = render(<Amp isFolded={false} face="tone" />);
    expect(holdPlayerHeight).toHaveBeenLastCalledWith(null, 766);
    const root = getByTestId('amp');
    expect(root).not.toHaveClass('is-measuring');
    expect(root).not.toHaveClass('is-quiet');
  });

  it('is never measured again on a resize of the window', () => {
    render(<Amp isFolded={false} face="tone" />);
    holdPlayerHeight.mockClear();
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(holdPlayerHeight).not.toHaveBeenCalled();
    // The control: the transport changing height is what measures it again.
    expect(observed?.target).toHaveClass('player-dock');
    act(() => observed?.callback());
    expect(holdPlayerHeight).toHaveBeenCalledWith(null, 766);
  });

  it('is measured again when the sound changes face', () => {
    const { rerender } = render(<Amp isFolded={false} face="tone" />);
    holdPlayerHeight.mockClear();
    rerender(<Amp isFolded={false} face="bands" />);
    expect(holdPlayerHeight).toHaveBeenCalledWith(null, 766);
  });

  it('lets the window go folded to one line, and stops watching the transport', () => {
    const { rerender } = render(<Amp isFolded={false} face="tone" />);
    rerender(<Amp isFolded face="tone" />);
    expect(holdPlayerHeight).toHaveBeenLastCalledWith(null, null);
    expect(observed).toBeUndefined();
  });
});
