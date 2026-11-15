/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Up Next pane as a drawer, on a card too narrow to keep it beside the
 * shelf (Ivan, 2026-11-15: "I don't like the style of the floating pane Up
 * Next when narrow, the dropdown, and it does not start more top"). It runs
 * from the card's top over the bar, so it draws the bar's Up next button
 * again in its own first row; that button, Escape and a press outside put it
 * away, and a press inside it or an Escape something else already answered
 * do not. On a wide card none of that applies: the pane stands beside the
 * shelf and a key or a press elsewhere leaves it.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import LibraryWorkspace from 'renderer/library/LibraryWorkspace';
import { LibraryProvider } from 'renderer/library/LibraryContext';
import { LibraryPlayerProvider } from 'renderer/library/player/LibraryPlayerContext';
import { I18nProvider } from 'renderer/utils/I18nContext';
import {
  installIpcRenderer,
  libraryRoot,
  libraryTrack,
  openLibraryStoreBridge,
  type ILibraryStoreBridge,
} from '../../utils/libraryStoreBridge';
import { createSourceAnalysisBridge } from '../../utils/sourceAnalysisBridge';

let bridge: ILibraryStoreBridge | undefined;

/** The card's width every observer is told, as Electron's would report it. */
let cardWidth = 900;
const originalObserver = globalThis.ResizeObserver;

/**
 * An observer that answers once, as a real one does when it starts
 * watching: the card reports `cardWidth`, everything else a pane's size.
 */
class SizedObserver {
  private readonly callback: ResizeObserverCallback;

  /** What is still watched: an answer for an element let go is dropped. */
  private readonly watched = new Set<Element>();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element): void {
    this.watched.add(target);
    const width = target.classList.contains('library-workspace')
      ? cardWidth
      : 600;
    const entry = {
      target,
      contentRect: { width, height: 600 } as DOMRectReadOnly,
      borderBoxSize: [{ inlineSize: width, blockSize: 60 }],
      contentBoxSize: [{ inlineSize: width, blockSize: 600 }],
      devicePixelContentBoxSize: [],
    } as unknown as ResizeObserverEntry;
    queueMicrotask(() => {
      if (this.watched.has(target)) {
        this.callback([entry], this as unknown as ResizeObserver);
      }
    });
  }

  unobserve(target: Element): void {
    this.watched.delete(target);
  }

  disconnect(): void {
    this.watched.clear();
  }
}

beforeAll(() => {
  Object.defineProperties(HTMLMediaElement.prototype, {
    play: { configurable: true, value: () => Promise.resolve() },
    pause: { configurable: true, value: () => undefined },
  });
});

beforeEach(() => {
  window.localStorage.clear();
  cardWidth = 900;
  globalThis.ResizeObserver = SizedObserver as unknown as typeof ResizeObserver;
  bridge = openLibraryStoreBridge({
    roots: [libraryRoot('r1', 'C:\\Music')],
    tracks: [
      libraryTrack({
        id: 'blue',
        title: 'Blue',
        album: 'Kind',
        artist: 'Miles',
        path: 'C:\\Music\\blue.mp3',
      }),
    ],
  });
  installIpcRenderer({ ...bridge.channels, ...createSourceAnalysisBridge() });
});

afterEach(() => {
  globalThis.ResizeObserver = originalObserver;
  jest.restoreAllMocks();
  bridge?.close();
  bridge = undefined;
});

const card = () => {
  const found = document.querySelector('.library-workspace');
  if (!found) {
    throw new Error('no Library card');
  }
  return found;
};

const isOpen = () => card().classList.contains('has-up-next');

/** The Library, with the pane opened from the bar's Up next button. */
const openPane = async () => {
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
  const barButton = await waitFor(() => {
    const found = document.querySelector<HTMLButtonElement>(
      '.library-top .library-up-next__chip',
    );
    expect(found).not.toBeNull();
    return found as HTMLButtonElement;
  });
  fireEvent.click(barButton);
  await waitFor(() => expect(isOpen()).toBe(true));
  return barButton;
};

const drawerButton = () =>
  document.querySelector<HTMLButtonElement>(
    '.library-pane__drawer-head .library-up-next__chip',
  );

describe('on a narrow card', () => {
  it('is a drawer that draws the Up next button in its own first row', async () => {
    await openPane();
    await waitFor(() => expect(card()).toHaveClass('has-up-next-floating'));
    expect(drawerButton()).toHaveAttribute('aria-expanded', 'true');
  });

  it('goes away from its own Up next button', async () => {
    await openPane();
    await waitFor(() => expect(drawerButton()).not.toBeNull());
    const button = drawerButton() as HTMLButtonElement;
    fireEvent.mouseDown(button);
    fireEvent.click(button);
    expect(isOpen()).toBe(false);
  });

  it('goes away on Escape, unless something already answered it', async () => {
    await openPane();
    await waitFor(() => expect(drawerButton()).not.toBeNull());
    const handled = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    handled.preventDefault();
    act(() => {
      window.dispatchEvent(handled);
    });
    expect(isOpen()).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(isOpen()).toBe(false);
  });

  it('goes away on a press outside it, never on one inside it', async () => {
    await openPane();
    await waitFor(() => expect(drawerButton()).not.toBeNull());
    const inside = document.querySelector('.library-now');
    expect(inside).not.toBeNull();
    fireEvent.mouseDown(inside as Element);
    expect(isOpen()).toBe(true);
    const shelf = document.querySelector('.library-main');
    expect(shelf).not.toBeNull();
    fireEvent.mouseDown(shelf as Element);
    expect(isOpen()).toBe(false);
  });
});

describe('on a wide card', () => {
  it('stands beside the shelf, drawing no second button and ignoring Escape', async () => {
    cardWidth = 1600;
    await openPane();
    await waitFor(() => expect(card()).not.toHaveClass('has-up-next-floating'));
    expect(drawerButton()).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(isOpen()).toBe(true);
  });
});
