/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The look picker's standard looks are drawn live, every tile in the
 * picker's scroller at once, on one shared loop (Ivan, 2026-11-23: "since
 * they are small, I want all of them to animate in this view"). A tile out
 * of the scroller, a picker with no sound yet and reduced motion show the
 * still instead. Each "nothing drawn" case stands beside its control - the
 * same tile drawing once the condition lifts - so it cannot pass by a tile
 * that never draws at all.
 */

interface IDriverProps {
  picture: unknown;
  onDriver?: (driver: { draw: (ms: number) => void } | undefined) => void;
}
const drawnFrames: unknown[] = [];
const mounted = new Set<unknown>();
jest.mock('../../../renderer/graph/LiveTraceCanvas', () => {
  // eslint-disable-next-line global-require -- jest.mock factories cannot close over imports
  const { useEffect } = require('react');
  // A drawing that hands its frames over and counts each one drawn.
  const LiveDrawing = ({ picture, onDriver }: IDriverProps) => {
    useEffect(() => {
      mounted.add(picture);
      onDriver?.({ draw: () => drawnFrames.push(picture) });
      return () => {
        mounted.delete(picture);
        onDriver?.(undefined);
      };
    }, [picture, onDriver]);
    return <span data-testid="live-drawing" />;
  };
  return { __esModule: true, default: LiveDrawing };
});
jest.mock('../../../renderer/graph/LookStillPainter', () => () => null);
// Each look's still, kept already - or not yet painted.
let stills = true;
jest.mock('../../../renderer/graph/lookStillStore', () => ({
  useLookStill: () => (stills ? { url: 'blob:still', width: 160 } : undefined),
  useLookStillsUnavailable: () => false,
  useStillTurn: () => ({ mine: false, done: () => undefined }),
}));
jest.mock('../../../renderer/player/playerTrace', () => () => ({
  curves: [],
  xScale: () => 0,
  yScale: () => 0,
}));
jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  LiveAudioStandIn: ({ children }: { children: unknown }) => children,
}));
// The sound the grid holds: there, or not yet (the demo still decoding).
let sound: object | undefined = { frames: {}, readFrame: () => undefined };
jest.mock('../../../renderer/graph/lookTileSound', () => ({
  useTileSound: () => sound,
  LookTileSoundScope: ({ children }: { children: unknown }) => children,
}));
let reduced = false;
jest.mock('../../../renderer/utils/bandReveal', () => ({
  prefersReducedMotion: () => reduced,
}));
jest.mock('../../../renderer/icons/LookIcon', () => () => (
  <span data-testid="icon" />
));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

/* eslint-disable import/first -- the mocks must be installed first */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import LookStyleGrid from '../../../renderer/graph/LookStyleGrid';
import { LookPickerStyleTile } from '../../../renderer/graph/LookPickerTiles';
import type { IStyleRow } from '../../../renderer/graph/lookPickerRows';
/* eslint-enable import/first */

// The plate has a size, as it does in the window: no size, no drawing.
const SizedObserver = jest.fn((report: ResizeObserverCallback) => ({
  observe: () =>
    report(
      [{ contentRect: { width: 160, height: 90 } } as ResizeObserverEntry],
      {} as ResizeObserver,
    ),
  disconnect: () => undefined,
}));

// The picker's scroller: every tile in it unless a test scrolls one out.
const observed = new Map<Element, IntersectionObserverCallback>();
const ScrollerObserver = jest.fn((report: IntersectionObserverCallback) => ({
  observe: (element: Element) => {
    observed.set(element, report);
    report(
      [{ target: element, isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
  },
  unobserve: (element: Element) => observed.delete(element),
  disconnect: () => observed.clear(),
}));

const scrollOut = (index: number) => {
  const [element, report] = [...observed.entries()][index];
  act(() =>
    report(
      [{ target: element, isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  );
};

// The loop's animation frames, run by hand.
let frames: FrameRequestCallback[] = [];
const runFrame = (at: number) => {
  const due = frames;
  frames = [];
  due.forEach((callback) => callback(at));
};

const row = (id: string): IStyleRow =>
  ({
    id,
    name: id,
    family: 'scenes',
    yours: false,
    search: id,
    look: {
      id,
      style: 'truss',
      palette: 'signal',
      label: id,
      isCustom: false,
    },
  }) as unknown as IStyleRow;

const ROWS = [row('truss'), row('skyline'), row('bonfire')];

const tiles = () => (
  <LookStyleGrid>
    {ROWS.map((each) => (
      <LookPickerStyleTile
        key={each.id}
        row={each}
        selected={false}
        tabbable={each.id === 'truss'}
        onChoose={jest.fn()}
      />
    ))}
  </LookStyleGrid>
);

const grid = () => render(tiles());

/** The stills on screen: there, and not hidden for a live drawing. */
const shownStills = () =>
  [...document.querySelectorAll<HTMLElement>('.look-tile-art__still')].filter(
    (still) => still.style.visibility !== 'hidden',
  ).length;

beforeAll(() => {
  window.ResizeObserver = SizedObserver as unknown as typeof ResizeObserver;
  window.IntersectionObserver =
    ScrollerObserver as unknown as typeof IntersectionObserver;
  window.requestAnimationFrame = (callback) => {
    frames.push(callback);
    return frames.length;
  };
  window.cancelAnimationFrame = () => {
    frames = [];
  };
});

beforeEach(() => {
  drawnFrames.length = 0;
  mounted.clear();
  observed.clear();
  frames = [];
  sound = { frames: {}, readFrame: () => undefined };
  reduced = false;
  stills = true;
});

it('draws every tile in view at once, on one loop', () => {
  grid();
  expect(screen.getAllByTestId('live-drawing')).toHaveLength(3);
  // One animation frame asked for, however many tiles draw.
  expect(frames).toHaveLength(1);
  runFrame(1000);
  runFrame(1100);
  expect(frames).toHaveLength(1);
  // Each tile drawn once a frame - two frames, three tiles - by one loop.
  expect(drawnFrames).toHaveLength(6);
  expect(new Set(drawnFrames)).toEqual(new Set(ROWS.map((each) => each.look)));
});

it('stops drawing a tile scrolled out of the picker, and keeps the rest', () => {
  grid();
  scrollOut(1);
  expect(screen.getAllByTestId('live-drawing')).toHaveLength(2);
  expect(mounted.has(ROWS[1].look)).toBe(false);
  runFrame(1000);
  runFrame(1100);
  expect(drawnFrames).toHaveLength(4);
  expect(drawnFrames).not.toContain(ROWS[1].look);
});

it('asks for no frames once nothing is in view', () => {
  grid();
  [0, 1, 2].forEach(scrollOut);
  expect(screen.queryByTestId('live-drawing')).not.toBeInTheDocument();
  expect(shownStills()).toBe(3);
  runFrame(1000);
  expect(frames).toHaveLength(0);
  expect(drawnFrames).toHaveLength(0);
});

it('keeps its picture until there is a sound to draw', () => {
  sound = undefined;
  const { rerender } = grid();
  expect(screen.queryByTestId('live-drawing')).not.toBeInTheDocument();
  expect(frames).toHaveLength(0);
  expect(shownStills()).toBe(3);
  sound = { frames: {}, readFrame: () => undefined };
  rerender(tiles());
  expect(screen.getAllByTestId('live-drawing')).toHaveLength(3);
});

it('shows the still until the frame that draws the look, and hides it then', () => {
  grid();
  // Mounted, but nothing drawn yet: the still stays.
  expect(screen.getAllByTestId('live-drawing')).toHaveLength(3);
  expect(shownStills()).toBe(3);
  runFrame(1000);
  expect(shownStills()).toBe(0);
  // Scrolled out, its still is back before the drawing's going is painted.
  scrollOut(1);
  expect(shownStills()).toBe(1);
});

it('never goes live from an empty plate', () => {
  stills = false;
  const { rerender } = grid();
  expect(screen.queryByTestId('live-drawing')).not.toBeInTheDocument();
  expect(screen.queryByTestId('icon')).not.toBeInTheDocument();
  expect(frames).toHaveLength(0);
  // The still arrives and fades in; the look goes live once it is in.
  stills = true;
  rerender(tiles());
  expect(screen.queryByTestId('live-drawing')).not.toBeInTheDocument();
  document
    .querySelectorAll('.look-tile-art__still')
    .forEach((still) => fireEvent.animationEnd(still));
  expect(screen.getAllByTestId('live-drawing')).toHaveLength(3);
});

it('moves nothing under reduced motion', () => {
  reduced = true;
  grid();
  expect(screen.queryByTestId('live-drawing')).not.toBeInTheDocument();
  expect(shownStills()).toBe(3);
  expect(frames).toHaveLength(0);
});

it('stops the loop when the picker closes', () => {
  const { unmount } = grid();
  expect(frames).toHaveLength(1);
  unmount();
  expect(frames).toHaveLength(0);
});
