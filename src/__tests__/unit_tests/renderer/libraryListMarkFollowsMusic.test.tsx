/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The marked row moves on with the music when it was on the song that ended
 * (Ivan, 2026-11-15: the marked row stood one above the playing one after
 * the queue moved on), and stays where the reader put it otherwise.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LibraryProvider } from '../../../renderer/library/LibraryContext';
import LibraryListView from '../../../renderer/library/LibraryListView';
import { shelfQueryFor } from '../../../renderer/library/libraryShelfQuery';
import { I18nProvider } from '../../../renderer/utils/I18nContext';
import LibraryListOf from '../../utils/LibraryListOf';
import {
  type ILibraryStoreBridge,
  installIpcRenderer,
  libraryTrack as track,
  openLibraryStoreBridge,
} from '../../utils/libraryStoreBridge';

let bridge: ILibraryStoreBridge | undefined;

afterEach(() => {
  cleanup();
  bridge?.close();
  bridge = undefined;
});

const query = shelfQueryFor({
  browseMode: 'song',
  viewMode: 'list',
  folderPath: undefined,
  search: '',
  sort: 'title',
  direction: 'asc',
  hasRoots: true,
  folderLevel: undefined,
});

const table = (
  playingTrackId: string | undefined,
  revealTrack: { trackId: string; nonce: number } | undefined,
) => (
  <I18nProvider>
    <LibraryProvider>
      <LibraryListOf query={query}>
        {(list) => (
          <LibraryListView
            list={list}
            browseMode="song"
            onOpenAlbum={jest.fn()}
            onOpenArtist={jest.fn()}
            onPlayTrack={jest.fn()}
            playingTrackId={playingTrackId}
            revealTrack={revealTrack}
          />
        )}
      </LibraryListOf>
    </LibraryProvider>
  </I18nProvider>
);

const open = () => {
  const opened = openLibraryStoreBridge({
    tracks: [
      track({ title: 'Alpha' }),
      track({ title: 'Bravo' }),
      track({ title: 'Charlie' }),
    ],
  });
  bridge = opened;
  installIpcRenderer({
    ...opened.channels,
    revealLibraryTrack: () => Promise.resolve(),
  });
};

const isMarked = async (title: string): Promise<boolean> => {
  const row = (await screen.findByText(title)).closest('[role="row"]');
  return row?.getAttribute('aria-selected') === 'true';
};

describe('the marked row and the music', () => {
  it('moves on to the next song when it was on the song that ended', async () => {
    open();
    const reveal = { trackId: 'Alpha', nonce: 1 };
    const { rerender } = render(table('Alpha', reveal));
    await waitFor(async () => expect(await isMarked('Alpha')).toBe(true));

    rerender(table('Bravo', reveal));

    await waitFor(async () => expect(await isMarked('Bravo')).toBe(true));
    expect(await isMarked('Alpha')).toBe(false);
  });

  it('stays on a row the reader marked while another song played', async () => {
    open();
    const reveal = { trackId: 'Charlie', nonce: 1 };
    const { rerender } = render(table('Alpha', reveal));
    await waitFor(async () => expect(await isMarked('Charlie')).toBe(true));

    rerender(table('Bravo', reveal));

    // The positive control above proves the mark is drawn; here it holds.
    await waitFor(async () => expect(await isMarked('Charlie')).toBe(true));
    expect(await isMarked('Bravo')).toBe(false);
  });

  it('does not move for a pause', async () => {
    open();
    const reveal = { trackId: 'Alpha', nonce: 1 };
    const { rerender } = render(table('Alpha', reveal));
    await waitFor(async () => expect(await isMarked('Alpha')).toBe(true));

    // Paused (nothing marked as playing), then the same song again.
    rerender(table(undefined, reveal));
    rerender(table('Alpha', reveal));

    expect(await isMarked('Alpha')).toBe(true);
  });
});
