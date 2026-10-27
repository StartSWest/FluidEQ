/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The folded line draws a standard look behind it, as a Plus scene already
 * moves behind it (Ivan, 2026-10-26: "lets fisplay the standa viz also in
 * the one line in the bg very suttle"), and stays one drawing for the whole
 * amp: only folded, only with no scene drawn or on its way, and as the top
 * panel draws a look — live, over the box it has, naming nothing.
 */

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import FoldTrace from 'renderer/player/FoldTrace';
import PlayerAmp from 'renderer/player/PlayerAmp';
import type { TGraphScene } from 'renderer/player/useGraphScenePack';

let mockFolded = true;
let mockScene: TGraphScene = { state: 'none' };
const mockCapture = jest.fn();
const mockTrace = jest.fn();

jest.mock('renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('renderer/player/playerLayout', () => ({
  usePlayerFold: () => ({
    isFolded: mockFolded,
    fold: () => undefined,
    unfold: () => undefined,
  }),
  usePlayerShelfOpen: () => ({ isShelfOpen: true }),
  usePlayerSound: () => ({ sound: { face: 'eq', isOpen: true } }),
  usePlayerVisFull: () => false,
}));
jest.mock('renderer/player/useGraphScenePack', () => ({
  __esModule: true,
  default: () => mockScene,
}));
jest.mock('renderer/player/usePlayerHeightFloor', () => ({
  __esModule: true,
  default: () => undefined,
}));
jest.mock('renderer/utils/useIsBackdrop', () => ({
  __esModule: true,
  default: () => false,
}));
jest.mock('renderer/player/useMusicDrop', () => ({
  __esModule: true,
  default: () => ({ isOver: false, dropAt: undefined }),
}));
jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: (...args: unknown[]) => mockCapture(...args),
}));
jest.mock('renderer/graph/LiveTraceCanvas', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockTrace(props);
    return <canvas data-testid="look" />;
  },
}));
jest.mock('renderer/player/playerTrace', () => ({
  __esModule: true,
  default: () => ({ curves: [], xScale: 'x', yScale: 'y' }),
}));
// A declaration, not a const: the factories below run when the amp is
// imported, before any const in this file has its value.
function mockStub(testId: string) {
  return {
    __esModule: true,
    default: ({ scene }: { scene?: unknown }) => (
      <div data-testid={testId} data-scene={scene ? 'yes' : 'no'} />
    ),
  };
}
jest.mock('renderer/player/PlayerStage', () => mockStub('stage'));
jest.mock('renderer/player/FoldStrip', () => mockStub('strip'));
jest.mock('renderer/player/PlayerTitleStrip', () => mockStub('title'));
jest.mock('renderer/player/PlayerHero', () => mockStub('hero'));
jest.mock('renderer/player/PlayerDock', () => mockStub('dock'));
jest.mock('renderer/player/PlayerSound', () => mockStub('sound'));
jest.mock('renderer/player/PlayerQueue', () => mockStub('queue'));
jest.mock('renderer/player/PlayerFoot', () => mockStub('foot'));
jest.mock('renderer/player/PlayerHeightGrip', () => mockStub('grip'));
jest.mock('renderer/player/PlayerIcon', () => mockStub('icon'));

const READY: TGraphScene = {
  state: 'ready',
  identity: 'aurora@1',
} as TGraphScene;

const traceIn = (container: HTMLElement) =>
  container.querySelector('.player-fold-trace');

beforeEach(() => {
  mockFolded = true;
  mockScene = { state: 'none' };
  mockCapture.mockClear();
  mockTrace.mockClear();
});

describe('the folded line and a standard look', () => {
  it('draws the look behind the line, before the line in the page', () => {
    const { container } = render(<PlayerAmp onOpenPage={() => undefined} />);
    const trace = traceIn(container);
    expect(trace).not.toBeNull();
    // Between the amp's floor and the line, so the line's floor lies over it.
    expect(trace?.previousElementSibling).toBe(screen.getByTestId('stage'));
    expect(trace?.nextElementSibling).toBe(screen.getByTestId('strip'));
  });

  it('leaves a Plus scene alone behind the line', () => {
    mockScene = READY;
    const { container } = render(<PlayerAmp onOpenPage={() => undefined} />);
    expect(screen.getByTestId('stage')).toHaveAttribute('data-scene', 'yes');
    expect(traceIn(container)).toBeNull();
  });

  it('draws nothing while a scene is on its way', () => {
    mockScene = { state: 'loading' };
    const { container } = render(<PlayerAmp onOpenPage={() => undefined} />);
    expect(traceIn(container)).toBeNull();
  });

  it('leaves the look to the top panel while the player is unfolded', () => {
    mockFolded = false;
    const { container } = render(<PlayerAmp onOpenPage={() => undefined} />);
    expect(screen.getByTestId('hero')).toBeInTheDocument();
    expect(traceIn(container)).toBeNull();
  });
});

describe('the look behind the line', () => {
  const RealObserver = globalThis.ResizeObserver;
  let deliver: ((width: number, height: number) => void) | undefined;

  beforeEach(() => {
    // An observer that reports a box when the test says so.
    const FakeObserver = jest.fn((callback: ResizeObserverCallback) => {
      const observer = {
        observe: () => undefined,
        unobserve: () => undefined,
        disconnect: () => undefined,
      };
      deliver = (width, height) =>
        callback(
          [{ contentRect: { width, height } } as ResizeObserverEntry],
          observer,
        );
      return observer;
    });
    Object.assign(globalThis, { ResizeObserver: FakeObserver });
  });

  afterEach(() => {
    Object.assign(globalThis, { ResizeObserver: RealObserver });
    deliver = undefined;
  });

  it('listens to the music and draws over the box it is given, naming nothing', () => {
    render(<FoldTrace />);
    expect(mockCapture).toHaveBeenCalledWith(true);
    // Nothing is drawn before the box is known.
    expect(screen.queryByTestId('look')).toBeNull();
    act(() => deliver?.(480, 64));
    expect(screen.getByTestId('look')).toBeInTheDocument();
    expect(mockTrace).toHaveBeenLastCalledWith(
      expect.objectContaining({ width: 480, height: 64, hasKey: false }),
    );
  });
});
