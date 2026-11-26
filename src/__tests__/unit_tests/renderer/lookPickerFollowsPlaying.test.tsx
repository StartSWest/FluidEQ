/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { IGalleryScene } from 'common/plusGallery';
import type { TGalleryListOutcome } from 'main/ipc/plusGallery';
import LookPicker from 'renderer/graph/LookPicker';
import type { IPlusRow } from 'renderer/graph/lookPickerRows';
import { resetGalleryStore } from 'renderer/plus/galleryStore';

/**
 * Ivan, 2026-11-26: "when I open this window it needs to always open on the
 * current analyzer or viz that is playing on the graph; sometimes it jumps
 * to another place". The playing tile was scrolled to once, as the window
 * arrived; the gallery's answer to the window's own opening then rebuilt the
 * rows with new scenes above it (Everything puts every scene above the
 * styles), and the tile was pushed down out of view.
 */

const KOI = 'member:maker:koi';

const scene = (id: string): IPlusRow => ({
  id,
  name: id,
  swatch: ['#000000'],
  maker: 'members',
  author: 'Maker',
  categories: ['water'],
  locked: false,
  search: id,
});

// One scene until the gallery has answered, then five more: what a newest
// page landing while the window is open does to Everything.
jest.mock('renderer/graph/lookPickerRows', () => ({
  ...jest.requireActual<object>('renderer/graph/lookPickerRows'),
  buildPlusRows: ({
    findInGallery,
  }: {
    findInGallery: (lookId: string) => IGalleryScene | undefined;
  }): IPlusRow[] =>
    findInGallery(KOI)
      ? [KOI, 'a', 'b', 'c', 'd', 'e'].map(scene)
      : [scene(KOI)],
}));

const PICKER = 'Styles and scenes';
const VIEW = 400;
const ROW = 100;
const TILE = 80;

const listed = (): IGalleryScene =>
  ({
    lookId: KOI,
    authorId: 'maker',
    sceneId: 'koi',
    authorName: 'Maker',
    authorHandle: null,
    version: 1,
    category: 'water',
    names: { en: 'Koi Pond' },
    swatch: ['#000000'],
    hasPhoto: false,
    likes: 0,
    likesWeek: 0,
    adds: 0,
    updatedAt: '2026-11-26T09:00:00Z',
    liked: false,
    added: true,
  }) as IGalleryScene;

let answer: (outcome: TGalleryListOutcome) => void = () => undefined;

// jsdom lays nothing out. Every tile stands one row under the one before
// it, in the order the list draws them, and the list is a 400px view.
const scrolled = new WeakMap<Element, number>();
const box = (top: number, height: number) =>
  ({
    top,
    height,
    bottom: top + height,
    left: 0,
    right: 100,
    width: 100,
    x: 0,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;
const scrollerOf = (element: Element) =>
  element.closest<HTMLElement>('[data-look-picker-scroll]');
const picksIn = (scroller: Element) =>
  Array.from(scroller.querySelectorAll('.look-picker__pick'));
/** Where a tile would stand with the list scrolled to its top. */
const naturalTop = (tile: Element) => {
  const scroller = scrollerOf(tile);
  return scroller ? picksIn(scroller).indexOf(tile) * ROW : 0;
};

beforeEach(() => {
  resetGalleryStore();
  window.electron = {
    ipcRenderer: {
      listGallery: () =>
        new Promise<TGalleryListOutcome>((resolve) => {
          answer = resolve;
        }),
    },
  } as unknown as typeof window.electron;
  jest
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockImplementation(function measure(this: Element) {
      if (this.hasAttribute('data-look-picker-scroll')) {
        return box(0, VIEW);
      }
      const scroller = scrollerOf(this);
      if (scroller && this.classList.contains('look-picker__pick')) {
        return box(naturalTop(this) - scroller.scrollTop, TILE);
      }
      return box(0, 0);
    });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute('data-look-picker-scroll') ? VIEW : 0;
    },
  });
  Object.defineProperty(Element.prototype, 'scrollTop', {
    configurable: true,
    get(this: Element) {
      return scrolled.get(this) ?? 0;
    },
    set(this: Element, value: number) {
      scrolled.set(this, value);
    },
  });
});

afterEach(() => {
  resetGalleryStore();
  jest.restoreAllMocks();
  // Back to jsdom's own, which live on the prototypes further up.
  delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
  delete (Element.prototype as { scrollTop?: number }).scrollTop;
});

const open = () => {
  render(
    <LookPicker
      value="spectrogram-auto"
      disabled={false}
      onChoose={jest.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: PICKER }));
};

const playing = () => {
  const tile = document.querySelector<HTMLElement>(
    '[data-look-picker-scroll] .look-picker__pick[aria-pressed="true"]',
  );
  if (!tile) {
    throw new Error('no playing tile in the list');
  }
  return tile;
};

const scroller = () => {
  const list = scrollerOf(playing());
  if (!list) {
    throw new Error('no list');
  }
  return list;
};

/** The middle of the playing tile, against the middle of the view. */
const offCentre = () => {
  const at = playing().getBoundingClientRect();
  return at.top + at.height / 2 - VIEW / 2;
};

const galleryAnswers = async () => {
  await act(async () => {
    answer({ ok: true, scenes: [listed()], more: false });
  });
};

it('opens with the playing tile in the middle of the list and the keyboard on it', () => {
  open();

  // The control: with the list left at its top, the tile is off the middle.
  expect(naturalTop(playing()) + TILE / 2 - VIEW / 2).not.toBe(0);

  expect(offCentre()).toBe(0);
  expect(playing()).toHaveFocus();
});

it('keeps the playing tile in the middle when the gallery adds scenes above it', async () => {
  open();
  const before = naturalTop(playing());

  await galleryAnswers();

  // The control: the answer did push the tile down the list, five rows.
  expect(naturalTop(playing()) - before).toBe(5 * ROW);
  // Still open, and still in the middle.
  expect(screen.getByRole('dialog', { name: PICKER })).toBeInTheDocument();
  expect(offCentre()).toBe(0);
});

it('leaves the list where the reader scrolled it when the gallery answers', async () => {
  open();
  const list = scroller();
  fireEvent.wheel(list);
  list.scrollTop = 123;

  await galleryAnswers();

  expect(list.scrollTop).toBe(123);
});

it('sends a letter typed on the playing tile to the search', () => {
  open();
  const search = screen.getByRole('textbox', {
    name: 'Search styles and scenes',
  });

  // The control: a walking key stays in the tiles.
  fireEvent.keyDown(playing(), { key: 'ArrowRight' });
  expect(search).not.toHaveFocus();

  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'k' });
  expect(search).toHaveFocus();
});
