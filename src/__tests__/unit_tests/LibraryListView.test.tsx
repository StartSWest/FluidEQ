/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import type { ComponentProps } from 'react';
import type {
  ILibraryTrack,
  TLibraryBrowseMode,
} from '../../common/library/types';
import { LibraryProvider } from '../../renderer/library/LibraryContext';
import LibraryListView from '../../renderer/library/LibraryListView';
import { shelfQueryFor } from '../../renderer/library/libraryShelfQuery';
import { I18nProvider } from '../../renderer/utils/I18nContext';
import LibraryListOf from '../utils/LibraryListOf';
import {
  type ILibraryStoreBridge,
  installIpcRenderer,
  libraryTrack as track,
  openLibraryStoreBridge,
} from '../utils/libraryStoreBridge';

let bridge: ILibraryStoreBridge | undefined;

afterEach(() => {
  // Unmounted before the store closes, so nothing asks a closed store.
  cleanup();
  bridge?.close();
  bridge = undefined;
});

/**
 * The table for one shelf of a library holding `tracks`, handed the list the
 * workspace would hand it for that shelf in the list view.
 */
const showShelf = (
  tracks: ILibraryTrack[],
  browseMode: TLibraryBrowseMode,
  {
    onPlayTrack = jest.fn(),
    offlineRootIds,
  }: Pick<ComponentProps<typeof LibraryListView>, 'offlineRootIds'> & {
    onPlayTrack?: (trackId: string) => void;
  } = {},
) => {
  const opened = openLibraryStoreBridge({ tracks });
  bridge = opened;
  installIpcRenderer({
    ...opened.channels,
    revealLibraryTrack: () => Promise.resolve(),
  });
  const query = shelfQueryFor({
    browseMode,
    viewMode: 'list',
    folderPath: undefined,
    search: '',
    sort: 'title',
    direction: 'asc',
    isTree: false,
    hasRoots: true,
    folderLevel: undefined,
  });
  return render(
    <I18nProvider>
      <LibraryProvider>
        <LibraryListOf query={query}>
          {(list) => (
            <LibraryListView
              list={list}
              browseMode={browseMode}
              onOpenAlbum={jest.fn()}
              onOpenArtist={jest.fn()}
              onPlayTrack={onPlayTrack}
              offlineRootIds={offlineRootIds}
            />
          )}
        </LibraryListOf>
      </LibraryProvider>
    </I18nProvider>,
  );
};

/** The row a title is drawn in, once its page has come back. */
const rowOf = async (title: string): Promise<Element> => {
  const row = (await screen.findByText(title)).closest('[role="row"]');
  expect(row).not.toBeNull();
  return row as Element;
};

describe('the library as a list', () => {
  it('shows a row per song with what the row is for', async () => {
    showShelf(
      [
        track({
          title: 'Blue',
          artist: 'Miles',
          album: 'Kind',
          durationMs: 92000,
        }),
      ],
      'song',
    );
    expect(await screen.findByText('Blue')).toBeInTheDocument();
    expect(screen.getByText('Miles')).toBeInTheDocument();
    expect(screen.getByText('1:32')).toBeInTheDocument();
  });

  it('starts the song on a double click', async () => {
    const onPlayTrack = jest.fn();
    showShelf([track({ title: 'Blue' })], 'song', { onPlayTrack });
    await userEvent.dblClick(await screen.findByText('Blue'));
    expect(onPlayTrack).toHaveBeenCalledWith('Blue');
  });

  it('marks a format it cannot play instead of pretending it can', async () => {
    showShelf([track({ title: 'Old', isPlayable: false })], 'song');
    expect(
      await screen.findByTitle('FluidEQ cannot play this format'),
    ).toBeInTheDocument();
  });

  it('marks a file whose tags could not be read, with its own key', async () => {
    // Guards against reaching for the nearest existing string instead of a
    // real one — this exact borrowed-string mistake shipped once already.
    showShelf([track({ title: 'Untagged', hasMetadataError: true })], 'song');
    expect(
      await screen.findByTitle("FluidEQ could not read this file's tags."),
    ).toBeInTheDocument();
  });

  it('dims a track whose root is offline instead of leaving it looking identical (blocker 4)', async () => {
    // Spec §10 promises an offline root's tracks are "kept and dimmed" — a
    // comment in `LibraryFolderActions.tsx` asserted this already happened
    // "elsewhere in the library" with nothing anywhere actually reading
    // `isOffline` outside that menu. A row-count or text assertion would
    // pass whether or not this dimming exists at all; only the class itself
    // proves it.
    showShelf([track({ title: 'Ghost', rootId: 'offline-root' })], 'song', {
      offlineRootIds: new Set(['offline-root']),
    });
    expect(await rowOf('Ghost')).toHaveClass('library-list__row--offline');
  });

  it('leaves a track on a root that is not offline undimmed, right beside it', async () => {
    // The positive control the test above needs: proof the class is really
    // conditional on `offlineRootIds`, not applied to every row regardless.
    showShelf([track({ title: 'Live', rootId: 'online-root' })], 'song', {
      offlineRootIds: new Set(['offline-root']),
    });
    expect(await rowOf('Live')).not.toHaveClass('library-list__row--offline');
  });

  it('opens the reveal menu from the keyboard, not just a right click', async () => {
    showShelf([track({ title: 'Blue' })], 'song');
    // The dedicated Context Menu key — Shift+F10 reaches the same handler.
    fireEvent.keyDown(await rowOf('Blue'), { key: 'ContextMenu' });
    expect(screen.getByText('Show in Explorer')).toBeInTheDocument();
  });

  it('lists albums when that is what is being browsed', async () => {
    showShelf(
      [
        track({ title: 'A', album: 'Kind', artist: 'Miles' }),
        track({ title: 'B', album: 'Kind', artist: 'Miles' }),
      ],
      'album',
    );
    expect(await screen.findByText('Kind')).toBeInTheDocument();
    expect(screen.getByText('2 songs')).toBeInTheDocument();
    // One row for the record, not one per song on it.
    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });
});
