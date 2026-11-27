/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A standard look's still in the look picker is shipped with the app and on
 * its plate from the first frame, in the window's colours (Ivan, 2026-11-26:
 * "just the single frame we load, and then on hover we load and play the
 * full thing"); only a look the member made paints one. Each case stands
 * beside its control.
 */

interface IDriverProps {
  picture: unknown;
  onDriver?: (
    driver: { draw: (ms: number) => void; canvas: () => unknown } | undefined,
  ) => void;
}
const mounted = new Set<unknown>();
jest.mock('../../../renderer/graph/LiveTraceCanvas', () => {
  // eslint-disable-next-line global-require -- jest.mock factories cannot close over imports
  const { useEffect } = require('react');
  const LiveDrawing = ({ picture, onDriver }: IDriverProps) => {
    useEffect(() => {
      mounted.add(picture);
      onDriver?.({ draw: () => undefined, canvas: () => null });
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
// No look has a painted still yet: whatever shows is shipped.
const turnsWanted = new Map<string, boolean>();
jest.mock('../../../renderer/graph/lookStillStore', () => ({
  useLookStill: () => undefined,
  useLookStillsUnavailable: () => false,
  useStillTurn: (wanted: boolean) => {
    turnsWanted.set(String(turnsWanted.size), wanted);
    return { mine: false, done: () => undefined };
  },
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
jest.mock('../../../renderer/icons/LookIcon', () => () => (
  <span data-testid="icon" />
));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));
// The stills' pictures, in memory already as the shut picker leaves them -
// or, for one case, not yet.
let pictureIn = true;
jest.mock('../../../renderer/graph/lookStills/stillFetch', () => ({
  fetchShippedStills: () => undefined,
  useShippedStillReady: () => pictureIn,
}));
// The shipped stills: the Analyzer's, painted in one stop and the ink.
jest.mock('../../../renderer/graph/lookStills/shippedStillFiles', () => ({
  __esModule: true,
  default: {
    'analyzer auto dark one': { url: 'dark-one.png', roles: ['stop', 'ink'] },
    'analyzer auto dark many': {
      url: 'dark-many.png',
      roles: ['stop-0', 'stop-6'],
    },
    'analyzer auto light one': { url: 'light-one.png', roles: ['stop'] },
  },
}));

/* eslint-disable import/first -- the mocks must be installed first */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import LookStyleGrid from '../../../renderer/graph/LookStyleGrid';
import { LookPickerStyleTile } from '../../../renderer/graph/LookPickerTiles';
import type { IStyleRow } from '../../../renderer/graph/lookPickerRows';
import { setRainbowStops } from '../../../renderer/utils/rainbowPalette';
import { setLightWindow } from '../../../renderer/utils/windowSide';
import { setWindowTintSecondary } from '../../../renderer/utils/windowTint';
/* eslint-enable import/first */

const SizedObserver = jest.fn((report: ResizeObserverCallback) => ({
  observe: () =>
    report(
      [{ contentRect: { width: 160, height: 90 } } as ResizeObserverEntry],
      {} as ResizeObserver,
    ),
  disconnect: () => undefined,
}));
const ScrollerObserver = jest.fn((report: IntersectionObserverCallback) => ({
  observe: (element: Element) =>
    report(
      [{ target: element, isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  unobserve: () => undefined,
  disconnect: () => undefined,
}));

let frames: FrameRequestCallback[] = [];
const runFrame = (at: number) => {
  const due = frames;
  frames = [];
  act(() => due.forEach((callback) => callback(at)));
};

const row = (id: string, isCustom: boolean): IStyleRow =>
  ({
    id,
    name: id,
    family: 'analysis',
    yours: isCustom,
    search: id,
    look: {
      id,
      style: 'analyzer',
      palette: 'auto',
      label: id,
      isCustom,
      colours: [],
    },
  }) as unknown as IStyleRow;

const STANDARD = row('analyzer', false);
const MINE = row('my-analyzer', true);

const grid = (rows: IStyleRow[]) =>
  render(
    <LookStyleGrid>
      {rows.map((each) => (
        <LookPickerStyleTile
          key={each.id}
          row={each}
          selected={false}
          tabbable={false}
          onChoose={jest.fn()}
        />
      ))}
    </LookStyleGrid>,
  );

const shipped = () =>
  document.querySelector<HTMLElement>('.look-still') ?? undefined;
const colourLayers = () => [
  ...document.querySelectorAll<HTMLElement>('.look-still__layer--colour'),
];

const ONE = Array.from({ length: 7 }, () => '#ff7a2f');
const MANY = [
  '#00dbe6',
  '#00cdf0',
  '#00bffc',
  '#3fadff',
  '#5d9bff',
  '#7486ff',
  '#8b6cff',
];

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
  pictureIn = true;
  mounted.clear();
  frames = [];
  turnsWanted.clear();
  act(() => {
    setLightWindow(false);
    setWindowTintSecondary(undefined);
    setRainbowStops(ONE);
  });
});

it('shows a standard look’s shipped still on its first frame, asking nothing to be painted', () => {
  grid([STANDARD]);
  const still = shipped();
  expect(still).toBeDefined();
  expect(
    still?.querySelector<HTMLElement>('.look-still__layer')?.style
      .backgroundImage,
  ).toContain('dark-one.png');
  expect(colourLayers()).toHaveLength(2);
  expect([...turnsWanted.values()].some(Boolean)).toBe(false);
});

it('paints a still for a look the member made, which nobody ships', () => {
  // The control: the same look, the member's own, has no still to ship.
  grid([MINE]);
  expect(shipped()).toBeUndefined();
  expect([...turnsWanted.values()].some(Boolean)).toBe(true);
});

it('lays the window’s own colour into each layer, and follows it when it changes', async () => {
  grid([STANDARD]);
  const [stop] = colourLayers();
  expect(stop).toHaveStyle({ backgroundColor: '#ff7a2f' });
  // The Tint's colour changes: the stops on the root change, the still with
  // them, without being drawn again.
  await act(async () => {
    setRainbowStops(Array.from({ length: 7 }, () => '#54ff8a'));
  });
  expect(colourLayers()[0]).toHaveStyle({ backgroundColor: '#54ff8a' });
});

it('shows the many-colour still once the Tint has a second colour', async () => {
  grid([STANDARD]);
  await act(async () => {
    setWindowTintSecondary('#8b6cff');
    setRainbowStops(MANY);
  });
  expect(
    shipped()?.querySelector<HTMLElement>('.look-still__layer')?.style
      .backgroundImage,
  ).toContain('dark-many.png');
  const layers = colourLayers();
  expect(layers[0]).toHaveStyle({ backgroundColor: MANY[0] });
  expect(layers[1]).toHaveStyle({ backgroundColor: MANY[6] });
});

it('shows the white window’s still on the white window', async () => {
  grid([STANDARD]);
  await act(async () => {
    setLightWindow(true);
  });
  expect(
    shipped()?.querySelector<HTMLElement>('.look-still__layer')?.style
      .backgroundImage,
  ).toContain('light-one.png');
});

it('gives way to the live look on its first frame, and is back the moment the pointer leaves', () => {
  grid([STANDARD]);
  fireEvent.pointerEnter(screen.getByTitle('analyzer'));
  expect(mounted.size).toBe(1);
  // Until the drawing's first frame, the still holds the plate.
  expect(shipped()?.style.visibility).toBe('');
  runFrame(1000);
  expect(shipped()?.style.visibility).toBe('hidden');
  fireEvent.pointerLeave(screen.getByTitle('analyzer'));
  expect(mounted.size).toBe(0);
  expect(shipped()?.style.visibility).toBe('');
});

it('lays no colour on the plate until its picture is in, then the whole still', () => {
  pictureIn = false;
  const { rerender } = grid([STANDARD]);
  // A colour layer without its mask would be a plate of solid colour.
  expect(shipped()).toBeDefined();
  expect(colourLayers()).toHaveLength(0);
  // The control: the same still, its picture in.
  pictureIn = true;
  rerender(
    <LookStyleGrid>
      <LookPickerStyleTile
        row={STANDARD}
        selected={false}
        tabbable={false}
        onChoose={jest.fn()}
      />
    </LookStyleGrid>,
  );
  expect(colourLayers()).toHaveLength(2);
});
