/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The look picker's standard looks are drawn live, every tile in the
 * picker's scroller at once, on one shared loop (Ivan, 2026-11-23: "since
 * they are small, I want all of them to animate in this view"), from the
 * moment there is sound. A tile out of the scroller, a picker with no sound
 * yet and reduced motion show the still instead. Each "nothing drawn" case stands beside its control - the
 * same tile drawing once the condition lifts - so it cannot pass by a tile
 * that never draws at all.
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
// Whether each tile asked, at its last render, for a turn to paint a still.
const turnsWanted: boolean[] = [];
const kept: string[] = [];
jest.mock('../../../renderer/graph/lookStillStore', () => ({
  useLookStill: () => (stills ? { url: 'blob:still', width: 160 } : undefined),
  useLookStillsUnavailable: () => false,
  useStillTurn: (wanted: boolean) => {
    turnsWanted.push(wanted);
    return { mine: false, done: () => undefined };
  },
  keepLookStill: (key: string) => kept.push(key),
}));
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
import { act, render, screen } from '@testing-library/react';
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
  reduced = false;
  stills = true;
  turnsWanted.length = 0;
  kept.length = 0;
  encoded.length = 0;
});

/** Whether any tile, at its latest render, wants a turn to paint a still. */
const wantsStills = () => turnsWanted.slice(-ROWS.length).some(Boolean);

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

// Ivan, 2026-11-24: "the standard viz needs to load faster, instant if
// possible". A tile waited for its still - the demo played offline, ninety
// drawings and a PNG, one tile at a time - before it moved, and then showed
// that still for one frame.
it('goes live at once with no still, and paints none while it is live', () => {
  stills = false;
  grid();
  expect(screen.getAllByTestId('live-drawing')).toHaveLength(3);
  expect(screen.queryByTestId('icon')).not.toBeInTheDocument();
  expect(frames).toHaveLength(1);
  expect(wantsStills()).toBe(false);
});

it('paints stills for tiles that cannot be drawn live', () => {
  // The control for the case above: the same tiles, no sound yet.
  stills = false;
  sound = undefined;
  grid();
  expect(screen.queryByTestId('live-drawing')).not.toBeInTheDocument();
  expect(wantsStills()).toBe(true);
});

it('keeps a tile’s last picture as its still once it has drawn a still’s worth', () => {
  stills = false;
  grid();
  runFrame(1000);
  runFrame(4100);
  scrollOut(1);
  expect(encoded).toHaveLength(1);
  expect(kept).toHaveLength(1);
});

it('keeps nothing from a tile that went before it had drawn enough', () => {
  stills = false;
  grid();
  runFrame(1000);
  runFrame(1100);
  scrollOut(1);
  expect(encoded).toHaveLength(0);
  expect(kept).toHaveLength(0);
});

it('keeps no picture over a still that already serves', () => {
  grid();
  runFrame(1000);
  runFrame(4100);
  scrollOut(1);
  expect(encoded).toHaveLength(0);
});

it('moves nothing under reduced motion', () => {
  reduced = true;
  grid();
  expect(screen.queryByTestId('live-drawing')).not.toBeInTheDocument();
  expect(shownStills()).toBe(3);
  expect(frames).toHaveLength(0);
});

/** The app's Animations switch pressed while the picker is open. */
const switchAnimations = (on: boolean) => {
  reduced = !on;
  act(() => applyMotionPreference(on ? 'full' : 'reduced'));
};

// Ivan, 2026-11-24: "if user selects animation off in the app we don't show
// the videos or the standard viz animated either". Felt at once, not at the
// tiles' next render.
it('stills every tile the moment Animations go off, and draws them again when on', () => {
  grid();
  runFrame(1000);
  expect(shownStills()).toBe(0);
  switchAnimations(false);
  expect(screen.queryByTestId('live-drawing')).not.toBeInTheDocument();
  expect(shownStills()).toBe(3);
  expect(frames).toHaveLength(0);
  switchAnimations(true);
  expect(screen.getAllByTestId('live-drawing')).toHaveLength(3);
  expect(frames).toHaveLength(1);
});

it('holds a drawing where it stands when Animations go off before its still is in', () => {
  stills = false;
  grid();
  runFrame(1000);
  drawnFrames.length = 0;
  switchAnimations(false);
  // Its last picture stays on the plate rather than an empty one, and
  // nothing is drawn or asked for any more.
  expect(screen.getAllByTestId('live-drawing')).toHaveLength(3);
  expect(frames).toHaveLength(0);
  expect(drawnFrames).toHaveLength(0);
  // A still is painted for it meanwhile.
  expect(wantsStills()).toBe(true);
  switchAnimations(true);
  expect(frames).toHaveLength(1);
  runFrame(1100);
  expect(drawnFrames).toHaveLength(3);
});

it('keeps no drawing on a plate whose look was never drawn', () => {
  // The control for the hold above: off before any frame, nothing held.
  stills = false;
  grid();
  switchAnimations(false);
  expect(screen.queryByTestId('live-drawing')).not.toBeInTheDocument();
});

it('stops the loop when the picker closes', () => {
  const { unmount } = grid();
  expect(frames).toHaveLength(1);
  unmount();
  expect(frames).toHaveLength(0);
});
