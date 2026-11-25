/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A scene tile in the look picker plays its clip while it is in the
 * picker's scroller (Ivan, 2026-11-24: "about the plus viz showing the
 * videos on elements that are in the view I want that too"): every one in
 * view where the graphics chip decodes them (2026-11-25: "all in view needs
 * to animate"), four at most where the clips decode in software ("make sure
 * they are very light"), and never while the window is hidden. The tile under the pointer or the
 * keyboard plays whatever the bound. Each "nothing" case stands beside its
 * control, the same tile playing once the condition lifts.
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
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { LookPickerSceneTile } from '../../../renderer/graph/LookPickerTiles';
import { SceneClipScope } from '../../../renderer/graph/lookTileClips';
import { forgetClipDecoder } from '../../../renderer/plus/clipSlots';
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

// The picker's scroller: every tile in it unless a test scrolls one out.
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

const itemAt = (index: number) =>
  document.querySelectorAll('.look-picker__item')[index];

/** Scrolls tile `index` so that `shown` of it is in the scroller. */
const scrollTo = (index: number, shown: number) => {
  const element = itemAt(index);
  const report = element && observed.get(element);
  if (!element || !report) {
    throw new Error(`tile ${index} is watched`);
  }
  act(() =>
    report(
      [
        {
          target: element,
          isIntersecting: shown > 0,
          intersectionRatio: shown,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    ),
  );
};

const scroll = (index: number, inView: boolean) =>
  scrollTo(index, inView ? 1 : 0);

const picker = (count: number) =>
  render(
    <div data-look-picker-scroll>
      <SceneClipScope>
        {Array.from({ length: count }, (_, index) => (
          <LookPickerSceneTile
            key={index}
            row={scene(index)}
            fresh={undefined}
            selected={false}
            tabbable={index === 0}
            onChoose={jest.fn()}
          />
        ))}
      </SceneClipScope>
    </div>,
  );

/** The scenes whose clip is on screen, by their scene id. */
const playing = () =>
  screen
    .queryAllByTestId('clip')
    .map((clip) => clip.getAttribute('data-url')?.replace('blob:', ''));

/** The decoder's answer, landed. */
const decoderAnswers = () => act(async () => undefined);

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hidden,
  });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

beforeAll(() => {
  window.IntersectionObserver =
    ScrollerObserver as unknown as typeof IntersectionObserver;
});

beforeEach(() => {
  active.clear();
  withoutClip.clear();
  observed.clear();
  forgetClipDecoder();
  Object.defineProperty(navigator, 'mediaCapabilities', {
    configurable: true,
    value: undefined,
  });
  setHidden(false);
});

it('plays the clip of every scene in view, and stops one scrolled out', async () => {
  picker(3);
  await decoderAnswers();
  expect(playing()).toEqual(['s0', 's1', 's2']);
  scroll(1, false);
  expect(playing()).toEqual(['s0', 's2']);
  expect(active.get('s1')).toBe(false);
  // Its picture stays under it all along.
  expect(screen.getAllByTestId('picture')).toHaveLength(3);
  scroll(1, true);
  expect(playing()).toEqual(['s0', 's1', 's2']);
});

it('gives no slot to a tile less than half shown, and one to a tile more than half', async () => {
  picker(3);
  await decoderAnswers();
  // Scrolled so that its caption alone is left: its picture is gone.
  scrollTo(0, 0.3);
  expect(playing()).toEqual(['s1', 's2']);
  scrollTo(0, 0.6);
  expect(playing()).toEqual(['s0', 's1', 's2']);
});

it('plays at most four where the clips decode in software, the first in reading order', async () => {
  picker(6);
  await decoderAnswers();
  expect(playing()).toEqual(['s0', 's1', 's2', 's3']);
  // A tile leaving hands its slot to the next one in view.
  scroll(0, false);
  expect(playing()).toEqual(['s1', 's2', 's3', 's4']);
});

it('plays every tile in view where the graphics chip decodes them', async () => {
  // The control for the bound above: the same picker, another decoder.
  // Thirty, past the twelve that stood here first: none is left still.
  Object.defineProperty(navigator, 'mediaCapabilities', {
    configurable: true,
    value: {
      decodingInfo: () =>
        Promise.resolve({
          supported: true,
          smooth: true,
          powerEfficient: true,
        }),
    },
  });
  picker(30);
  await decoderAnswers();
  expect(playing()).toHaveLength(30);
  // Still only those in view: one scrolled out lets its clip go.
  scroll(29, false);
  expect(playing()).toHaveLength(29);
  expect(playing()).not.toContain('s29');
});

it('gives no slot to a scene that has no clip', async () => {
  withoutClip.add('s1');
  picker(6);
  await decoderAnswers();
  expect(playing()).toEqual(['s0', 's2', 's3', 's4']);
  expect(active.get('s1')).toBe(false);
});

it('plays a tile past the bound under the pointer and with the keyboard', async () => {
  const { container } = picker(6);
  await decoderAnswers();
  expect(playing()).not.toContain('s5');
  const item = container.querySelectorAll('.look-picker__item')[5];
  fireEvent.pointerEnter(item);
  expect(playing()).toContain('s5');
  // The four in view keep theirs.
  expect(playing()).toHaveLength(5);
  fireEvent.pointerLeave(item);
  expect(playing()).not.toContain('s5');
  const pick = within(item as HTMLElement).getByRole('button');
  fireEvent.focus(pick);
  expect(playing()).toContain('s5');
  fireEvent.blur(pick);
  expect(playing()).not.toContain('s5');
});

it('plays a scrolled-out tile only while it is pointed at', async () => {
  const { container } = picker(2);
  await decoderAnswers();
  scroll(1, false);
  expect(playing()).toEqual(['s0']);
  fireEvent.pointerEnter(container.querySelectorAll('.look-picker__item')[1]);
  expect(playing()).toEqual(['s0', 's1']);
});

it('lets every clip go while the window is hidden, and plays them again when shown', async () => {
  picker(3);
  await decoderAnswers();
  setHidden(true);
  expect(playing()).toEqual([]);
  expect([...active.values()].some(Boolean)).toBe(false);
  setHidden(false);
  expect(playing()).toEqual(['s0', 's1', 's2']);
});

it('plays nothing and watches nothing once the picker closes', async () => {
  const { unmount } = picker(3);
  await decoderAnswers();
  expect(observed.size).toBe(3);
  unmount();
  expect(observed.size).toBe(0);
});
