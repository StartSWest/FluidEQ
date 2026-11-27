/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The gallery's pictures along the graph's foot - the look before, the one
 * on show, the look after - are each look's real still, the one the look
 * picker shows, never its drawn icon (Ivan, 2026-11-27: "let's use the real
 * capture here too for the standard viz, not the icons"). Each case stands
 * beside its control.
 */

// Every standard look ships its still in this world, named for its look and
// the window it is drawn for - unless a case says none does.
let shipping = true;
jest.mock('../../../../renderer/graph/lookStills/shippedStillFiles', () => ({
  __esModule: true,
  default: new Proxy(
    {},
    {
      get: (_files, key) => {
        if (!shipping || typeof key !== 'string') {
          return undefined;
        }
        const [style, palette, side, colours] = key.split(' ');
        // Painted in the window's one stop, or its first of many.
        return palette === 'auto'
          ? {
              url: `${style}-${side}-${colours}.png`,
              roles: [colours === 'one' ? 'stop' : 'stop-0'],
            }
          : undefined;
      },
    },
  ),
}));
// The pictures in memory already, as the shut picker leaves them; which
// ones were asked for is kept.
const fetchedUrls = new Set<string>();
jest.mock('../../../../renderer/graph/lookStills/stillFetch', () => ({
  fetchShippedStills: (files: readonly { url: string }[]) =>
    files.forEach(({ url }) => fetchedUrls.add(url)),
  useShippedStillReady: () => true,
}));
// Whether a still can be painted at all this session (the demo song, offline
// audio); the rest of the store is the real one.
let unavailable = false;
jest.mock('../../../../renderer/graph/lookStillStore', () => ({
  ...jest.requireActual('../../../../renderer/graph/lookStillStore'),
  useLookStillsUnavailable: () => unavailable,
}));
// Painting a still plays the demo song offline; here it is kept at once,
// under the name it was asked to paint.
const painted: string[] = [];
jest.mock('../../../../renderer/graph/LookStillPainter', () => {
  /* eslint-disable global-require -- jest.mock factories cannot close over imports */
  const { useEffect, useRef } = require('react');
  const store = require('../../../../renderer/graph/lookStillStore');
  /* eslint-enable global-require */
  const Painter = ({
    stillKey,
    onDone,
  }: {
    stillKey: string;
    onDone: () => void;
  }) => {
    // The turn's `done` is a new function every render; the paint is once.
    const doneRef = useRef(onDone);
    doneRef.current = onDone;
    useEffect(() => {
      painted.push(stillKey);
      store.keepLookStill(stillKey, { url: 'blob:painted', width: 160 });
      doneRef.current();
    }, [stillKey]);
    return null;
  };
  return { __esModule: true, default: Painter };
});
jest.mock('../../../../renderer/icons/LookIcon', () => () => (
  <span data-testid="look-icon" />
));

/* eslint-disable import/first -- the mocks must be installed first */
import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import {
  createCustomLookId,
  getDefaultTuning,
  type ICustomLook,
} from 'common/customLooks';
import { DEFAULT_GRAPH_LOOK_ID } from 'common/graphStyles';
import GraphGallery from 'renderer/graph/GraphGallery';
import { deleteCustomLook, saveCustomLook } from 'renderer/utils/customLooks';
import { setGraphLook } from 'renderer/utils/graphStyle';
import { I18nProvider } from 'renderer/utils/I18nContext';
import { setRainbowStops } from 'renderer/utils/rainbowPalette';
import { setLightWindow } from 'renderer/utils/windowSide';
import { setWindowTintSecondary } from 'renderer/utils/windowTint';
/* eslint-enable import/first */

const show = (lookId: string, isIdle = false) =>
  render(
    <I18nProvider>
      <GraphGallery
        selectedLookId={lookId}
        isDisabled={false}
        isIdle={isIdle}
        onStep={jest.fn()}
        onChoose={jest.fn()}
        tools={null}
      />
    </I18nProvider>,
  );

/** The three pictures: the look before, the credit's, the look after. */
const pictures = () => [
  ...document.querySelectorAll<HTMLElement>('.graph-gallery-picture'),
];

/** The shipped still's picture on a plate, or undefined for none. */
const stillOn = (picture: HTMLElement) =>
  picture.querySelector<HTMLElement>('.look-still .look-still__layer')?.style
    .backgroundImage;

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

/** A look made in the look editor, kept until the case is over. */
const made: string[] = [];
const makeLook = (name: string): ICustomLook => {
  const look: ICustomLook = {
    id: createCustomLookId(),
    name,
    style: 'analyzer',
    palette: 'auto',
    tuning: getDefaultTuning('analyzer'),
    colours: [],
  };
  made.push(look.id);
  act(() => {
    saveCustomLook(look);
    setGraphLook(look.id);
  });
  return look;
};

beforeEach(() => {
  window.localStorage.clear();
  shipping = true;
  unavailable = false;
  fetchedUrls.clear();
  painted.length = 0;
  // The dark window in one colour, as the picker's own case has it.
  act(() => {
    setLightWindow(false);
    setWindowTintSecondary(undefined);
    setRainbowStops(ONE);
    setGraphLook(DEFAULT_GRAPH_LOOK_ID);
  });
});

afterEach(() => {
  act(() => made.splice(0).forEach((id) => deleteCustomLook(id)));
});

it('pictures a standard look and the looks either side of it by their shipped stills, not their icons', () => {
  show(DEFAULT_GRAPH_LOOK_ID);
  const shown = pictures();
  expect(shown).toHaveLength(3);
  shown.forEach((picture) => {
    expect(stillOn(picture)).toMatch(/[a-z0-9]+-dark-one\.png/);
  });
  // The credit's is the look on show.
  expect(stillOn(shown[1])).toContain('analyzer-dark-one.png');
  expect(screen.queryByTestId('look-icon')).toBeNull();
  // Nothing painted: every one of them ships.
  expect(painted).toHaveLength(0);
});

it('shows a look’s icon only where no still can be had at all', () => {
  // The control for the case above: the same bar where nothing ships and
  // nothing can be painted carries the icons, so the case above is not
  // passing on a bar that never draws them.
  shipping = false;
  unavailable = true;
  show(DEFAULT_GRAPH_LOOK_ID);
  expect(screen.getAllByTestId('look-icon')).toHaveLength(3);
  expect(document.querySelector('.look-still')).toBeNull();
});

it('lays the window’s own colour into each still, and follows the Tint’s second colour', async () => {
  show(DEFAULT_GRAPH_LOOK_ID);
  const credit = () => pictures()[1];
  expect(credit().querySelector('.look-still__layer--colour')).toHaveStyle({
    backgroundColor: '#ff7a2f',
  });
  // The stops are written on the window's root, which the stills hear of
  // once the change is observed.
  await act(async () => {
    setWindowTintSecondary('#8b6cff');
    setRainbowStops(MANY);
  });
  expect(stillOn(credit())).toContain('analyzer-dark-many.png');
  expect(credit().querySelector('.look-still__layer--colour')).toHaveStyle({
    backgroundColor: MANY[0],
  });
});

it('shows the white window’s stills on the white window', () => {
  act(() => setLightWindow(true));
  show(DEFAULT_GRAPH_LOOK_ID);
  pictures().forEach((picture) => {
    expect(stillOn(picture)).toMatch(/-light-one\.png/);
  });
});

it('has every kind of each pictured look’s still in memory before the window asks for it', () => {
  show(DEFAULT_GRAPH_LOOK_ID);
  ['dark-one', 'dark-many', 'light-one', 'light-many'].forEach((kind) => {
    expect(fetchedUrls).toContain(`analyzer-${kind}.png`);
  });
});

it('paints a still for a look the member made, under the picker’s name for it, and shows it', () => {
  const mine = makeLook('Mine');
  show(mine.id);
  const credit = pictures()[1];
  // Nobody ships a look the member made: its still is painted, and the
  // credit shows it once kept.
  expect(stillOn(credit)).toBeUndefined();
  expect(painted).toHaveLength(1);
  expect(painted[0]).toContain(mine.id);
  expect(credit.querySelector('img')).toHaveAttribute('src', 'blob:painted');
  // The control: the standard looks beside it ship theirs and paint none.
  expect(stillOn(pictures()[0])).toContain('-dark-one.png');
  expect(stillOn(pictures()[2])).toContain('-dark-one.png');
});

it('paints nothing while the bar is away, and paints once it has been shown', () => {
  const mine = makeLook('Mine too');
  const { rerender } = show(mine.id, true);
  expect(painted).toHaveLength(0);
  rerender(
    <I18nProvider>
      <GraphGallery
        selectedLookId={mine.id}
        isDisabled={false}
        isIdle={false}
        onStep={jest.fn()}
        onChoose={jest.fn()}
        tools={null}
      />
    </I18nProvider>,
  );
  expect(painted).toHaveLength(1);
});
