/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The look picker's standard looks show their stills, and only the one tile
 * the pointer or the keyboard is on is drawn live, on every frame the
 * display gives (Ivan, 2026-11-26: "only play the one hovering, and play it
 * full, no fps drop"). Each "nothing drawn" case stands beside its control -
 * the same tile drawing once the condition lifts - so it cannot pass by a
 * tile that never draws at all.
 */

interface IDriverProps {
  picture: unknown;
  onDriver?: (
    driver: { draw: (ms: number) => void; canvas: () => unknown } | undefined,
  ) => void;
}
const drawnFrames: unknown[] = [];
const mounted = new Set<unknown>();
// The canvas each drawing paints on: what a settled tile leaves as its still.
const encoded: string[] = [];
const fakeCanvas = {
  toBlob: (done: (blob: Blob | null) => void) => {
    encoded.push('png');
    done(new Blob(['png']));
  },
};
jest.mock('../../../renderer/graph/LiveTraceCanvas', () => {
  // eslint-disable-next-line global-require -- jest.mock factories cannot close over imports
  const { useEffect } = require('react');
  // A drawing that hands its frames over and counts each one drawn.
  const LiveDrawing = ({ picture, onDriver }: IDriverProps) => {
    useEffect(() => {
      mounted.add(picture);
      onDriver?.({
        draw: () => drawnFrames.push(picture),
        canvas: () => fakeCanvas,
      });
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
// Whether each tile asked, at its last render, for a turn to paint a still,
// by the order the tiles mounted in.
const turnsWanted = new Map<number, boolean>();
const tilesMounted = { count: 0 };
const kept: string[] = [];
jest.mock('../../../renderer/graph/lookStillStore', () => {
  // eslint-disable-next-line global-require -- jest.mock factories cannot close over imports
  const { useState } = require('react');
  return {
    useLookStill: () =>
      stills ? { url: 'blob:still', width: 160 } : undefined,
    useLookStillsUnavailable: () => false,
    useStillTurn: (wanted: boolean) => {
      const [tile] = useState(() => {
        tilesMounted.count += 1;
        return tilesMounted.count - 1;
      });
      turnsWanted.set(tile, wanted);
      return { mine: false, done: () => undefined };
    },
    keepLookStill: (key: string) => kept.push(key),
  };
});
jest.mock('../../../renderer/graph/lookStillSong', () => ({
  stillSecondsOf: () => 3,
}));
jest.mock('../../../renderer/player/playerTrace', () => () => ({
  curves: [],
  xScale: () => 0,
  yScale: () => 0,
}));
jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  LiveAudioStandIn: ({ children }: { children: unknown }) => children,
}));
// The sound the grid holds: there, or not yet (the demo still decoding);
// and whether the grid asked for it, at each render of its scope.
let sound: object | undefined = { frames: {}, readFrame: () => undefined };
const listening: boolean[] = [];
jest.mock('../../../renderer/graph/lookTileSound', () => ({
  useTileSound: () => sound,
  LookTileSoundScope: ({
    listening: open,
    children,
  }: {
    listening: boolean;
    children: unknown;
  }) => {
    listening.push(open);
    return children;
  },
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
import { applyMotionPreference } from '../../../renderer/utils/motionPreference';
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
// In act: a tile's first drawing tells the tile it has a picture on show.
const runFrame = (at: number) => {
  const due = frames;
  frames = [];
  act(() => due.forEach((callback) => callback(at)));
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

const tileAt = (index: number) => screen.getByTitle(ROWS[index].name);
const point = (index: number) => fireEvent.pointerEnter(tileAt(index));
const leave = (index: number) => fireEvent.pointerLeave(tileAt(index));

/** The stills on screen: there, and not hidden for a live drawing. */
const shownStills = () =>
  [...document.querySelectorAll<HTMLElement>('.look-tile-art__still')].filter(
    (still) => still.style.visibility !== 'hidden',
  ).length;

beforeAll(() => {
  // jsdom has no object URLs; a settled tile asks for one for its still.
  URL.createObjectURL = () => 'blob:settled';
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
  listening.length = 0;
  reduced = false;
  stills = true;
  turnsWanted.clear();
  tilesMounted.count = 0;
  kept.length = 0;
  encoded.length = 0;
});

/** Whether the tile at `index`, at its latest render, wants a still painted. */
const wantsStill = (index: number) => turnsWanted.get(index) === true;

it('draws nothing at rest, and only the tile under the pointer', () => {
  grid();
  expect(screen.queryByTestId('live-drawing')).not.toBeInTheDocument();
  expect(frames).toHaveLength(0);
  expect(shownStills()).toBe(3);
  point(1);
  expect(screen.getAllByTestId('live-drawing')).toHaveLength(1);
  expect(mounted.has(ROWS[1].look)).toBe(true);
  runFrame(1000);
  runFrame(1007);
  expect(new Set(drawnFrames)).toEqual(new Set([ROWS[1].look]));
});

// The pace was twelve drawings a second for every tile; the one tile now
// draws on every frame the display gives, here a 144 Hz one.
it('draws the hovered tile on every frame of the display, never at a slower pace', () => {
  grid();
  point(0);
  const step = 1000 / 144;
  for (let at = 0; at < 20; at += 1) {
    runFrame(1000 + at * step);
  }
  expect(drawnFrames).toHaveLength(20);
});

it('moves with the pointer: the tile left shows its still again, the next one draws', () => {
  grid();
  point(0);
  runFrame(1000);
  // The drawing's first frame hides the still under it.
  expect(shownStills()).toBe(2);
  leave(0);
  point(2);
  // The still left behind is shown before the drawing's going is painted.
  expect(mounted.has(ROWS[0].look)).toBe(false);
  expect(mounted.has(ROWS[2].look)).toBe(true);
  expect(shownStills()).toBe(3);
  drawnFrames.length = 0;
  runFrame(1016);
  runFrame(1032);
  expect(drawnFrames).toEqual([ROWS[2].look, ROWS[2].look]);
});

it('stops drawing and asks for no frame once the pointer leaves the grid', () => {
  grid();
  point(1);
  runFrame(1000);
  leave(1);
  expect(screen.queryByTestId('live-drawing')).not.toBeInTheDocument();
  expect(shownStills()).toBe(3);
  expect(frames).toHaveLength(0);
});

it('draws the tile the keyboard is on, and stops when it leaves', () => {
  grid();
  act(() => tileAt(2).focus());
  expect(mounted.has(ROWS[2].look)).toBe(true);
  expect(screen.getAllByTestId('live-drawing')).toHaveLength(1);
  act(() => tileAt(2).blur());
  expect(screen.queryByTestId('live-drawing')).not.toBeInTheDocument();
});

it('draws the tile reached last when the pointer and the keyboard are on two', () => {
  grid();
  act(() => tileAt(0).focus());
  point(2);
  expect([...mounted]).toEqual([ROWS[2].look]);
  // Let go by the pointer, the keyboard's tile draws again.
  leave(2);
  expect([...mounted]).toEqual([ROWS[0].look]);
});

it('opens the sound only once a tile plays, and keeps it open across tiles', () => {
  grid();
  expect(listening.every((open) => !open)).toBe(true);
  point(0);
  expect(listening[listening.length - 1]).toBe(true);
  leave(0);
  point(1);
  leave(1);
  expect(listening[listening.length - 1]).toBe(true);
});

it('keeps its picture until there is a sound to draw', () => {
  sound = undefined;
  const { rerender } = grid();
  point(0);
  expect(screen.queryByTestId('live-drawing')).not.toBeInTheDocument();
  expect(frames).toHaveLength(0);
  expect(shownStills()).toBe(3);
  sound = { frames: {}, readFrame: () => undefined };
  rerender(tiles());
  expect(screen.getAllByTestId('live-drawing')).toHaveLength(1);
});

it('stops drawing a hovered tile scrolled out of the picker', () => {
  grid();
  point(1);
  scrollOut(1);
  expect(screen.queryByTestId('live-drawing')).not.toBeInTheDocument();
  expect(frames).toHaveLength(0);
});

it('paints stills for the tiles at rest, and none for the one drawing', () => {
  stills = false;
  grid();
  expect([0, 1, 2].map(wantsStill)).toEqual([true, true, true]);
  point(1);
  expect([0, 1, 2].map(wantsStill)).toEqual([true, false, true]);
  expect(screen.queryByTestId('icon')).not.toBeInTheDocument();
});

it('keeps a tile’s last picture as its still once it has drawn a still’s worth', () => {
  stills = false;
  grid();
  point(1);
  runFrame(1000);
  for (let at = 1; at <= 40; at += 1) {
    runFrame(1000 + at * 80);
  }
  leave(1);
  expect(encoded).toHaveLength(1);
  expect(kept).toHaveLength(1);
});

it('keeps nothing from a tile that went before it had drawn enough', () => {
  stills = false;
  grid();
  point(1);
  runFrame(1000);
  runFrame(1100);
  leave(1);
  expect(encoded).toHaveLength(0);
  expect(kept).toHaveLength(0);
});

it('keeps no picture over a still that already serves', () => {
  grid();
  point(1);
  for (let at = 0; at <= 40; at += 1) {
    runFrame(1000 + at * 80);
  }
  leave(1);
  expect(encoded).toHaveLength(0);
});

it('holds the drawing where it stands when the pointer leaves before its still is in', () => {
  stills = false;
  grid();
  point(1);
  runFrame(1000);
  drawnFrames.length = 0;
  leave(1);
  // Its last picture stays on the plate rather than an empty one, and
  // nothing is drawn or asked for any more; a still is painted meanwhile.
  expect(screen.getAllByTestId('live-drawing')).toHaveLength(1);
  expect(frames).toHaveLength(0);
  expect(drawnFrames).toHaveLength(0);
  expect(wantsStill(1)).toBe(true);
});

it('keeps no drawing on a plate whose look was never drawn', () => {
  // The control for the hold above: left before any frame, nothing held.
  stills = false;
  grid();
  point(1);
  leave(1);
  expect(screen.queryByTestId('live-drawing')).not.toBeInTheDocument();
});

it('moves nothing under reduced motion, not even the hovered tile', () => {
  reduced = true;
  grid();
  point(0);
  expect(screen.queryByTestId('live-drawing')).not.toBeInTheDocument();
  expect(shownStills()).toBe(3);
  expect(frames).toHaveLength(0);
});

/** The app's Animations switch pressed while the picker is open. */
const switchAnimations = (on: boolean) => {
  reduced = !on;
  act(() => applyMotionPreference(on ? 'full' : 'reduced'));
};

it('stills the hovered tile the moment Animations go off, and draws it again when on', () => {
  grid();
  point(0);
  runFrame(1000);
  expect(shownStills()).toBe(2);
  switchAnimations(false);
  expect(screen.queryByTestId('live-drawing')).not.toBeInTheDocument();
  expect(shownStills()).toBe(3);
  expect(frames).toHaveLength(0);
  switchAnimations(true);
  expect(screen.getAllByTestId('live-drawing')).toHaveLength(1);
  expect(frames).toHaveLength(1);
});

it('stops the loop when the picker closes', () => {
  const { unmount } = grid();
  point(0);
  expect(frames).toHaveLength(1);
  unmount();
  expect(frames).toHaveLength(0);
});
