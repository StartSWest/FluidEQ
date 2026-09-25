/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Up Next panel's width, dragged from its edge, is remembered once the
 * drag ends — not on every pointer move of it, each of which wrote
 * localStorage, synchronously, on the thread drawing the drag.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ILibraryIndex } from 'common/library/types';
import LibraryWorkspace from 'renderer/library/LibraryWorkspace';
import { LibraryProvider } from 'renderer/library/LibraryContext';
import { LibraryPlayerProvider } from 'renderer/library/player/LibraryPlayerContext';
import { I18nProvider } from 'renderer/utils/I18nContext';

const WIDTH_KEY = 'fluideq.library.upNextWidth';

const INDEX: ILibraryIndex = {
  version: 1,
  roots: [
    {
      id: 'r1',
      path: 'C:\\Music',
      addedAt: 1,
      trackCount: 1,
      karaokeSkipped: 0,
    },
  ],
  tracks: [
    {
      id: 'blue',
      rootId: 'r1',
      path: 'C:\\Music\\blue.mp3',
      kind: 'audio',
      isPlayable: true,
      title: 'Blue',
      album: 'Kind',
      artist: 'Miles',
      sizeBytes: 1,
      mtimeMs: 1,
      addedAt: 1,
    },
  ],
};

/** jsdom 20 has no PointerEvent, and the splitter reads `clientX` from one. */
class TestPointerEvent extends MouseEvent {
  pointerId: number;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}

beforeAll(() => {
  if (!('PointerEvent' in window)) {
    Object.assign(window, { PointerEvent: TestPointerEvent });
  }
  // jsdom implements neither, and the player's teardown pauses its decks —
  // stubbed as `LibraryWorkspace.test.tsx` does.
  Object.defineProperties(HTMLMediaElement.prototype, {
    play: { configurable: true, value: () => Promise.resolve() },
    pause: { configurable: true, value: () => undefined },
  });
});

beforeEach(() => {
  window.localStorage.clear();
  window.electron = {
    ipcRenderer: {
      getLibraryIndex: () => Promise.resolve({ index: INDEX, wasReset: false }),
      onLibraryScanProgress: () => () => undefined,
      onLibraryTracksAdded: () => () => undefined,
      onLibraryIndexChanged: () => () => undefined,
      on: () => () => undefined,
    },
  } as unknown as typeof window.electron;
});

afterEach(() => {
  jest.restoreAllMocks();
});

const openQueueEdge = async () => {
  render(
    <I18nProvider>
      <LibraryProvider>
        <LibraryPlayerProvider>
          <LibraryWorkspace
            isHidden={false}
            isFullScreen={false}
            onToggleFullScreen={() => undefined}
          />
        </LibraryPlayerProvider>
      </LibraryProvider>
    </I18nProvider>,
  );
  const chip = await waitFor(() => {
    const reachable = screen
      .getAllByRole('button', { name: /Up next/ })
      .filter((button) => !button.closest('[inert]'));
    expect(reachable).toHaveLength(1);
    return reachable[0];
  });
  fireEvent.click(chip);
  return screen.getByRole('separator', { name: 'Up next' });
};

const widthWrites = (setItem: jest.SpyInstance) =>
  setItem.mock.calls
    .filter(([key]) => key === WIDTH_KEY)
    .map(([, value]) => value);

it('remembers a dragged width when the drag ends, not on every move', async () => {
  const edge = await openQueueEdge();
  const setItem = jest.spyOn(Storage.prototype, 'setItem');
  fireEvent.pointerDown(edge, { clientX: 500 });
  [480, 460, 440].forEach((clientX) =>
    fireEvent.pointerMove(edge, { clientX }),
  );
  expect(widthWrites(setItem)).toEqual([]);
  fireEvent.pointerUp(edge, { clientX: 440 });
  // Dragged 60px towards the shelf from the 260 it opens at.
  expect(widthWrites(setItem)).toEqual(['320']);
});

it('remembers the width a key step reached, not the one before it', async () => {
  const edge = await openQueueEdge();
  const setItem = jest.spyOn(Storage.prototype, 'setItem');
  fireEvent.keyDown(edge, { key: 'ArrowLeft' });
  expect(widthWrites(setItem)).toEqual(['284']);
});

// The stylesheet reads the drag from the card (`is-resizing-up-next`) rather
// than asking the card's subtree for the handle's `is-dragging` with `:has()`.
it('marks the card for exactly as long as the handle is dragged', async () => {
  const edge = await openQueueEdge();
  const card = edge.closest('.library-workspace');
  expect(card).not.toHaveClass('is-resizing-up-next');

  // A key step is no drag: the handle never wore `is-dragging` for one.
  fireEvent.keyDown(edge, { key: 'ArrowLeft' });
  expect(edge).not.toHaveClass('is-dragging');
  expect(card).not.toHaveClass('is-resizing-up-next');

  fireEvent.pointerDown(edge, { clientX: 500 });
  expect(edge).toHaveClass('is-dragging');
  expect(card).toHaveClass('is-resizing-up-next');
  fireEvent.pointerMove(edge, { clientX: 480 });
  expect(card).toHaveClass('is-resizing-up-next');

  fireEvent.pointerUp(edge, { clientX: 480 });
  expect(edge).not.toHaveClass('is-dragging');
  expect(card).not.toHaveClass('is-resizing-up-next');
});
