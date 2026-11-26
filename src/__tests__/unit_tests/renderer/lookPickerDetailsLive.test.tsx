/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The look picker's Details list does what the grid does: every row shows
 * its picture, and only the one row the pointer or the keyboard is on plays
 * (Ivan, 2026-11-26: "only play the one hovering"; `onePlaying.ts`) - a
 * standard look drawn live on the tiles' one loop, a scene its published
 * clip. Each "nothing" case stands beside its control.
 */

interface IDriverProps {
  picture: unknown;
  onDriver?: (
    driver: { draw: (ms: number) => void; canvas: () => unknown } | undefined,
  ) => void;
}
const drawnFrames: unknown[] = [];
jest.mock('../../../renderer/graph/LiveTraceCanvas', () => {
  // eslint-disable-next-line global-require -- jest.mock factories cannot close over imports
  const { useEffect } = require('react');
  // A drawing that hands its frames over and counts each one drawn.
  const LiveDrawing = ({ picture, onDriver }: IDriverProps) => {
    useEffect(() => {
      onDriver?.({
        draw: () => drawnFrames.push(picture),
        canvas: () => null,
      });
      return () => onDriver?.(undefined);
    }, [picture, onDriver]);
    return <span data-testid="live-drawing" />;
  };
  return { __esModule: true, default: LiveDrawing };
});
jest.mock('../../../renderer/graph/LookStillPainter', () => () => null);
jest.mock('../../../renderer/graph/lookStillStore', () => ({
  useLookStill: () => ({ url: 'blob:still', width: 72 }),
  useLookStillsUnavailable: () => false,
  useStillTurn: () => ({ mine: false, done: () => undefined }),
  keepLookStill: () => undefined,
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
jest.mock('../../../renderer/graph/lookTileSound', () => ({
  useTileSound: () => ({ frames: {}, readFrame: () => undefined }),
  LookTileSoundScope: ({ children }: { children: unknown }) => children,
}));
let reduced = false;
jest.mock('../../../renderer/utils/bandReveal', () => ({
  prefersReducedMotion: () => reduced,
}));
const asked: boolean[] = [];
jest.mock('../../../renderer/plus/cardClip', () => ({
  useSceneClip: (_scene: unknown, _me: unknown, active: boolean) => {
    asked.push(active);
    return active ? 'blob:clip' : undefined;
  },
  useKnownWithoutClip: () => false,
}));
jest.mock('../../../renderer/plus/SceneClip', () => () => (
  <span data-testid="clip" />
));
jest.mock('../../../renderer/graph/lookPickerParts', () => ({
  SceneThumbnail: () => <span data-testid="picture" />,
  LockBadge: () => null,
}));
jest.mock('../../../renderer/graph/GraphSceneReport', () => () => null);
jest.mock('../../../renderer/graph/GraphSceneRemove', () => () => null);
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

/* eslint-disable import/first -- the mocks must be installed first */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import LookPickerDetails from '../../../renderer/graph/LookPickerDetails';
import type {
  IPlusRow,
  IStyleRow,
} from '../../../renderer/graph/lookPickerRows';
/* eslint-enable import/first */

const SizedObserver = jest.fn((report: ResizeObserverCallback) => ({
  observe: () =>
    report(
      [{ contentRect: { width: 72, height: 40 } } as ResizeObserverEntry],
      {} as ResizeObserver,
    ),
  disconnect: () => undefined,
}));

// The picker's scroller: every row in it unless a test scrolls one out.
const observed = new Map<Element, IntersectionObserverCallback>();
const ScrollerObserver = jest.fn((report: IntersectionObserverCallback) => ({
  observe: (element: Element) => {
    observed.set(element, report);
    report(
      [
        {
          target: element,
          isIntersecting: true,
          intersectionRatio: 1,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    );
  },
  unobserve: (element: Element) => observed.delete(element),
  disconnect: () => observed.clear(),
}));

/** Tells the scroller's observer `element` left its view. */
const scrollOut = (element: Element) => {
  const report = observed.get(element);
  if (!report) {
    throw new Error('the element is watched');
  }
  act(() =>
    report(
      [
        {
          target: element,
          isIntersecting: false,
          intersectionRatio: 0,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    ),
  );
};

let frames: FrameRequestCallback[] = [];
// In act: a tile's first drawing tells the tile it has a picture on show.
const runFrame = (at: number) => {
  const due = frames;
  frames = [];
  act(() => due.forEach((callback) => callback(at)));
};

const style = (id: string): IStyleRow =>
  ({
    id,
    name: id,
    family: 'analysis',
    yours: false,
    search: id,
    look: { id, style: 'analyzer', palette: 'signal', label: id },
  }) as unknown as IStyleRow;

const STYLES = [style('analyzer'), style('spectrogram')];
const SCENE = {
  id: 'member:koi-pond',
  name: 'Koi Pond',
  swatch: ['#000000'],
  maker: 'fluideq',
  categories: ['nature'],
  locked: false,
  search: 'koi pond',
  thumbnail: {
    published: {
      authorId: 'prime',
      sceneId: 'koi-pond',
      version: 4,
      revision: '2026-11-20T00:00:00Z',
    },
  },
} as unknown as IPlusRow;

const list = () =>
  render(
    <LookPickerDetails
      value="analyzer"
      styles={STYLES}
      scenes={[SCENE]}
      freshness={new Map()}
      stop="analyzer"
      onChoose={jest.fn()}
    />,
  );

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
  observed.clear();
  frames = [];
  asked.length = 0;
  reduced = false;
});

/** The row of the look or scene called `name`. */
const rowOf = (name: string) => {
  const row = screen.getByTitle(name).closest('.look-picker__item');
  if (!row) {
    throw new Error(`${name} has a row`);
  }
  return row;
};

it('draws no standard look at rest, and the hovered row alone, on every frame', () => {
  list();
  expect(screen.queryByTestId('live-drawing')).not.toBeInTheDocument();
  expect(frames).toHaveLength(0);
  fireEvent.pointerEnter(rowOf('spectrogram'));
  expect(screen.getAllByTestId('live-drawing')).toHaveLength(1);
  runFrame(1000);
  runFrame(1007);
  expect(drawnFrames).toEqual([STYLES[1].look, STYLES[1].look]);
  fireEvent.pointerLeave(rowOf('spectrogram'));
  expect(screen.queryByTestId('live-drawing')).not.toBeInTheDocument();
  expect(frames).toHaveLength(0);
});

it('stops drawing a hovered row scrolled out of the list', () => {
  list();
  fireEvent.pointerEnter(rowOf('analyzer'));
  const [plate] = document.querySelectorAll('.look-tile-art');
  scrollOut(plate);
  expect(screen.queryByTestId('live-drawing')).not.toBeInTheDocument();
});

it('keeps the stills under reduced motion, the hovered row too', () => {
  reduced = true;
  list();
  fireEvent.pointerEnter(rowOf('analyzer'));
  expect(screen.queryByTestId('live-drawing')).not.toBeInTheDocument();
  expect(document.querySelectorAll('.look-tile-art__still')).toHaveLength(2);
  expect(frames).toHaveLength(0);
});

it("plays a scene row's clip only under the pointer or with the keyboard", () => {
  list();
  expect(screen.getByTestId('picture')).toBeInTheDocument();
  expect(screen.queryByTestId('clip')).not.toBeInTheDocument();
  expect(asked.some(Boolean)).toBe(false);
  const item = rowOf('Koi Pond');
  fireEvent.pointerEnter(item);
  expect(screen.getByTestId('clip')).toBeInTheDocument();
  fireEvent.pointerLeave(item);
  expect(screen.queryByTestId('clip')).not.toBeInTheDocument();
  const row = screen.getByTitle('Koi Pond');
  act(() => row.focus());
  expect(screen.getByTestId('clip')).toBeInTheDocument();
  act(() => row.blur());
  expect(screen.queryByTestId('clip')).not.toBeInTheDocument();
  // Its picture stays throughout.
  expect(screen.getByTestId('picture')).toBeInTheDocument();
});

it('plays one row at a time: the scene stops when a standard look is hovered', () => {
  list();
  act(() => screen.getByTitle('Koi Pond').focus());
  expect(screen.getByTestId('clip')).toBeInTheDocument();
  fireEvent.pointerEnter(rowOf('analyzer'));
  expect(screen.queryByTestId('clip')).not.toBeInTheDocument();
  expect(screen.getAllByTestId('live-drawing')).toHaveLength(1);
});
