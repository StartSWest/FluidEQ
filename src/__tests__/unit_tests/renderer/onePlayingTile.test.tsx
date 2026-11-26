/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One tile plays at a time, in the whole window (Ivan, 2026-11-26:
 * "FluidEQ is consuming too much due to all the videos and analyser
 * thumbnails playing. Let's only play the one hovering"): the look picker's
 * scene tile under the pointer, or the one the keyboard is on, plays its
 * clip; every other shows its picture, and nothing plays at rest, in a
 * hidden window or once the picker closes. It replaced every clip in view
 * playing. Each "nothing" case stands beside its control, the same tile
 * playing once the condition lifts.
 */

// Whether each scene's clip is wanted, at the tile's latest render.
const active = new Map<string, boolean>();
const withoutClip = new Set<string>();
jest.mock('../../../renderer/plus/cardClip', () => ({
  useSceneClip: (
    scene: { sceneId: string } | undefined,
    _me: unknown,
    wanted: boolean,
  ) => {
    if (scene) {
      active.set(scene.sceneId, wanted);
    }
    return wanted ? `blob:${scene?.sceneId}` : undefined;
  },
  useKnownWithoutClip: (scene: { sceneId: string } | undefined) =>
    scene !== undefined && withoutClip.has(scene.sceneId),
}));
jest.mock(
  '../../../renderer/plus/SceneClip',
  () =>
    ({ url }: { url: string }) => <span data-testid="clip" data-url={url} />,
);
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
import { LookPickerSceneTile } from '../../../renderer/graph/LookPickerTiles';
import type { IPlusRow } from '../../../renderer/graph/lookPickerRows';
/* eslint-enable import/first */

const scene = (index: number) =>
  ({
    id: `member:scene-${index}`,
    name: `Scene ${index}`,
    swatch: ['#000000', '#ffffff'],
    maker: 'fluideq',
    categories: ['nature'],
    locked: false,
    thumbnail: {
      lookId: `member:scene-${index}`,
      version: '1',
      published: { authorId: 'prime', sceneId: `s${index}`, version: 1 },
    },
  }) as unknown as IPlusRow;

const tilesOf = (from: number, count: number) =>
  Array.from({ length: count }, (_, offset) => (
    <LookPickerSceneTile
      key={from + offset}
      row={scene(from + offset)}
      fresh={undefined}
      selected={false}
      tabbable={offset === 0}
      onChoose={jest.fn()}
    />
  ));

/** The picker, or two lists of tiles in one window (`lists` 2). */
const picker = (count: number, lists = 1) =>
  render(
    <div data-look-picker-scroll>
      {Array.from({ length: lists }, (_, list) => (
        <div key={list} className="look-picker__grid">
          {tilesOf(list * count, count)}
        </div>
      ))}
    </div>,
  );

const itemAt = (index: number) =>
  document.querySelectorAll<HTMLElement>('.look-picker__item')[index];
const pickAt = (index: number) =>
  itemAt(index).querySelector<HTMLElement>('.look-picker__pick') as HTMLElement;
const point = (index: number) => fireEvent.pointerEnter(itemAt(index));
const leave = (index: number) => fireEvent.pointerLeave(itemAt(index));

/** The scenes whose clip is on screen, by their scene id. */
const playing = () =>
  screen
    .queryAllByTestId('clip')
    .map((clip) => clip.getAttribute('data-url')?.replace('blob:', ''));

/** The scenes whose clip is asked for at all. */
const asked = () =>
  [...active.entries()].filter(([, wanted]) => wanted).map(([id]) => id);

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hidden,
  });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

beforeEach(() => {
  active.clear();
  withoutClip.clear();
  setHidden(false);
});

afterEach(() => jest.restoreAllMocks());

it('plays nothing at rest, and the tile under the pointer alone', () => {
  picker(12);
  expect(playing()).toEqual([]);
  expect(asked()).toEqual([]);
  point(4);
  expect(playing()).toEqual(['s4']);
  expect(asked()).toEqual(['s4']);
  // Every picture stays on its plate, the playing one's under its clip.
  expect(screen.getAllByTestId('picture')).toHaveLength(12);
});

it('moves with the pointer, and stops every clip when it leaves the grid', () => {
  picker(12);
  point(1);
  leave(1);
  point(2);
  expect(playing()).toEqual(['s2']);
  expect(asked()).toEqual(['s2']);
  leave(2);
  expect(playing()).toEqual([]);
  expect(asked()).toEqual([]);
});

it('plays the tile the keyboard is on, and stops when the focus leaves', () => {
  picker(6);
  act(() => pickAt(3).focus());
  expect(playing()).toEqual(['s3']);
  act(() => pickAt(3).blur());
  expect(playing()).toEqual([]);
});

it('plays nothing for a focus the keyboard did not put there', () => {
  // A click focuses the tile too; the browser does not show that focus.
  const { matches } = Element.prototype;
  jest.spyOn(Element.prototype, 'matches').mockImplementation(function notShown(
    this: Element,
    selector: string,
  ) {
    return selector === ':focus-visible' ? false : matches.call(this, selector);
  });
  picker(6);
  act(() => pickAt(3).focus());
  expect(playing()).toEqual([]);
  // The control: the pointer on the same tile plays it.
  point(3);
  expect(playing()).toEqual(['s3']);
});

it('plays the tile reached last when the pointer and the keyboard are on two', () => {
  picker(6);
  act(() => pickAt(0).focus());
  point(5);
  expect(playing()).toEqual(['s5']);
  leave(5);
  expect(playing()).toEqual(['s0']);
});

it('keeps the keyboard’s tile playing under a pointer on a scene with no clip', () => {
  withoutClip.add('s2');
  picker(6);
  act(() => pickAt(0).focus());
  point(2);
  expect(playing()).toEqual(['s0']);
  // The control: a scene with a clip takes the turn.
  leave(2);
  point(3);
  expect(playing()).toEqual(['s3']);
});

it('plays one tile across two lists in one window', () => {
  picker(4, 2);
  act(() => pickAt(1).focus());
  point(6);
  expect(playing()).toEqual(['s6']);
  expect(asked()).toEqual(['s6']);
});

it('lets the clip go while the window is hidden, and plays it again when shown', () => {
  picker(6);
  point(2);
  setHidden(true);
  expect(playing()).toEqual([]);
  setHidden(false);
  expect(playing()).toEqual(['s2']);
});

it('plays nothing once the picker closes', () => {
  const { unmount } = picker(6);
  point(2);
  unmount();
  expect(playing()).toEqual([]);
  // A new picker starts at rest: nothing of the old one is still wanted.
  picker(6);
  expect(playing()).toEqual([]);
});
