/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ILibraryScanProgress } from 'common/library/types';
import { LibraryProvider, useLibrary } from 'renderer/library/LibraryContext';
import LibraryScanProgress from 'renderer/library/LibraryScanProgress';
import {
  useLibraryDeck,
  usePublishedLibraryDeck,
} from 'renderer/player/libraryDeck';
import { I18nProvider } from 'renderer/utils/I18nContext';
import {
  type ILibraryStoreBridge,
  installIpcRenderer,
  openLibraryStoreBridge,
} from '../../utils/libraryStoreBridge';

/**
 * The Library scan's notice, with its two ways out (Ivan, 2026-10-26: "needs
 * to have a x to close it also in case it take time but they want to
 * continue scanning"): the corner's × puts it away and the scan goes on;
 * Stop ends the scan, and is the quiet key, never the filled one.
 */

const scan = (over: Partial<ILibraryScanProgress> = {}) => ({
  rootId: 'r1',
  seen: 3,
  parsed: 1,
  karaokeSkipped: 0,
  current: 'a.mp3',
  isDone: false,
  ...over,
});

let bridge: ILibraryStoreBridge | undefined;

afterEach(() => {
  // Unmounted before the store closes, so nothing asks a closed store.
  cleanup();
  bridge?.close();
  bridge = undefined;
});

describe('the scan notice', () => {
  const show = () => {
    const onCancel = jest.fn();
    const onHide = jest.fn();
    render(
      <I18nProvider>
        <LibraryScanProgress
          progress={scan()}
          onCancel={onCancel}
          onHide={onHide}
        />
      </I18nProvider>,
    );
    return { onCancel, onHide };
  };

  it('puts itself away on the corner ×, and leaves the scan running', async () => {
    const { onCancel, onHide } = show();
    await userEvent.click(
      screen.getByRole('button', { name: 'Hide this notice' }),
    );
    expect(onHide).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('stops the scan on Stop, the quiet key', async () => {
    const { onCancel, onHide } = show();
    const stop = screen.getByRole('button', { name: 'Stop' });
    expect(stop).toHaveClass('button', 'small', 'subtle');
    await userEvent.click(stop);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onHide).not.toHaveBeenCalled();
  });
});

/** The notice where the Library page and the player put it. */
const ScanNotice = () => {
  const {
    isScanning,
    progress,
    isScanNoticeHidden,
    hideScanNotice,
    cancelScan,
  } = useLibrary();
  return isScanning && progress && !isScanNoticeHidden ? (
    <LibraryScanProgress
      progress={progress}
      onCancel={cancelScan}
      onHide={hideScanNotice}
    />
  ) : null;
};

/** The Compact player's deck, published as the Library player does it. */
const PublishedDeck = () => {
  usePublishedLibraryDeck({
    queue: undefined,
    track: undefined,
    trackById: new Map(),
    isShuffled: false,
    repeat: 'off',
    stop: () => undefined,
    setShuffle: () => undefined,
    cycleRepeat: () => undefined,
    jumpToQueuePosition: () => undefined,
    addFiles: () => Promise.resolve('empty'),
    moveUpNext: () => undefined,
    removeUpNextAt: () => undefined,
    isGuess: () => false,
  });
  return null;
};

/** What the player's queue is told about the scan. */
const DeckScan = () => {
  const deck = useLibraryDeck();
  return <span>{deck?.scanProgress ? 'scan shown' : 'no scan'}</span>;
};

describe('a notice put away', () => {
  const mount = () => {
    const opened = openLibraryStoreBridge();
    bridge = opened;
    installIpcRenderer({ ...opened.channels, cancelLibraryScan: jest.fn() });
    render(
      <I18nProvider>
        <LibraryProvider>
          <ScanNotice />
          <PublishedDeck />
          <DeckScan />
        </LibraryProvider>
      </I18nProvider>,
    );
    return opened;
  };
  const notice = () => screen.queryByRole('status');

  it('stays away for the rest of its scan, and the next scan shows its own', async () => {
    const opened = mount();
    act(() => opened.sendProgress(scan()));
    expect(notice()).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Hide this notice' }),
    );
    expect(notice()).not.toBeInTheDocument();
    // The scan goes on, and its news does not bring the notice back.
    act(() => opened.sendProgress(scan({ parsed: 2 })));
    expect(notice()).not.toBeInTheDocument();

    act(() => opened.sendProgress(scan({ parsed: 3, isDone: true })));
    act(() => opened.sendProgress(scan({ parsed: 0 })));
    expect(notice()).toBeInTheDocument();
  });

  // One answer for both places: put away on the Library page, it is put
  // away in the Compact player's queue too.
  it('is put away in the Compact player too', async () => {
    const opened = mount();
    act(() => opened.sendProgress(scan()));
    expect(screen.getByText('scan shown')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Hide this notice' }),
    );
    expect(screen.getByText('no scan')).toBeInTheDocument();
  });
});
