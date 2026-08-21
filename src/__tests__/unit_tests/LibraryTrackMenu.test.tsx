/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ILibraryTrack } from '../../common/library/types';
import {
  FAVORITES_PLAYLIST_ID,
  ILibraryPlaylists,
  emptyLibraryPlaylists,
  favoritesPlaylist,
} from '../../common/library/playlists';
import LibraryListView from '../../renderer/library/LibraryListView';
import { PlaylistProvider } from '../../renderer/library/PlaylistContext';
import { I18nProvider } from '../../renderer/utils/I18nContext';
import { pendingKaraokeFiles } from '../../renderer/library/karaokeHandoff';

const track = (over: Partial<ILibraryTrack>): ILibraryTrack => ({
  id: over.title ?? 'id',
  rootId: 'r',
  path: 'C:\\Music\\a.mp3',
  kind: 'audio',
  isPlayable: true,
  title: 'Untitled',
  sizeBytes: 1,
  mtimeMs: 1,
  addedAt: 1,
  ...over,
});

const addTracksToLibraryPlaylist = jest.fn();
const removeTracksFromLibraryPlaylist = jest.fn();
const createLibraryPlaylist = jest.fn();
const libraryTrackBytes = jest.fn();
let stored: ILibraryPlaylists = emptyLibraryPlaylists();

beforeEach(() => {
  addTracksToLibraryPlaylist.mockReset().mockResolvedValue(stored);
  removeTracksFromLibraryPlaylist.mockReset().mockResolvedValue(stored);
  createLibraryPlaylist.mockReset().mockResolvedValue(stored);
  libraryTrackBytes.mockReset().mockResolvedValue(undefined);
  stored = emptyLibraryPlaylists();
  window.electron = {
    ipcRenderer: {
      getLibraryPlaylists: () =>
        Promise.resolve({ playlists: stored, wasReset: false }),
      onLibraryPlaylistsChanged: () => () => {},
      addTracksToLibraryPlaylist,
      removeTracksFromLibraryPlaylist,
      createLibraryPlaylist,
      libraryTrackBytes,
      revealLibraryTrack: () => Promise.resolve(),
    },
  } as unknown as typeof window.electron;
});

const renderRows = (tracks: ILibraryTrack[], openPlaylistId?: string) =>
  render(
    <I18nProvider>
      <PlaylistProvider>
        <LibraryListView
          tracks={tracks}
          browseMode="song"
          openPlaylistId={openPlaylistId}
          onOpenAlbum={jest.fn()}
          onOpenArtist={jest.fn()}
          onPlayTrack={jest.fn()}
        />
      </PlaylistProvider>
    </I18nProvider>,
  );

/** Right-click the row, the way a reader reaches this menu. */
const openMenuOn = async (title: string) => {
  const row = screen.getByText(title).closest('[role="row"]');
  fireEvent.contextMenu(row as Element);
  await screen.findByRole('menu');
};

describe('what a song row offers', () => {
  it('offers all five actions, not just Show in Explorer', async () => {
    renderRows([track({ title: 'Blue' })]);
    await openMenuOn('Blue');
    expect(screen.getByText('Add to Favourites')).toBeInTheDocument();
    expect(screen.getByText('Add to playlist')).toBeInTheDocument();
    expect(screen.getByText('Send to Karaoke')).toBeInTheDocument();
    expect(screen.getByText('Show in Explorer')).toBeInTheDocument();
  });

  it('adds the song to Favourites', async () => {
    renderRows([track({ title: 'Blue' })]);
    await openMenuOn('Blue');
    await userEvent.click(screen.getByText('Add to Favourites'));
    expect(addTracksToLibraryPlaylist).toHaveBeenCalledWith(
      FAVORITES_PLAYLIST_ID,
      ['Blue'],
    );
  });

  // The label is the state. A menu that always read "Add to Favourites"
  // would leave the reader guessing whether the last press had landed.
  it('offers to take it out again once it is in', async () => {
    stored = {
      version: 1,
      playlists: [{ ...favoritesPlaylist(), trackIds: ['Blue'] }],
    };
    renderRows([track({ title: 'Blue' })]);
    await openMenuOn('Blue');
    await screen.findByText('Remove from Favourites');
    await userEvent.click(screen.getByText('Remove from Favourites'));
    expect(removeTracksFromLibraryPlaylist).toHaveBeenCalledWith(
      FAVORITES_PLAYLIST_ID,
      ['Blue'],
    );
  });

  it('marks a favourited row so it can be seen without opening a menu', async () => {
    stored = {
      version: 1,
      playlists: [{ ...favoritesPlaylist(), trackIds: ['Blue'] }],
    };
    renderRows([track({ title: 'Blue' }), track({ title: 'Red' })]);
    await waitFor(() =>
      expect(screen.getByTitle('In your Favourites')).toBeInTheDocument(),
    );
    // A POSITIVE CONTROL for the mark: exactly one row carries it, so a
    // badge rendered on every row would fail here rather than pass.
    expect(screen.getAllByTitle('In your Favourites')).toHaveLength(1);
  });

  // Only inside a playlist. Anywhere else there is no "this playlist" for
  // the item to mean.
  it('offers to remove from the open playlist, and only there', async () => {
    renderRows([track({ title: 'Blue' })]);
    await openMenuOn('Blue');
    expect(screen.queryByText('Remove from this playlist')).toBeNull();
  });

  it('removes from the open playlist when one is open', async () => {
    renderRows([track({ title: 'Blue' })], 'pl-a');
    await openMenuOn('Blue');
    await userEvent.click(screen.getByText('Remove from this playlist'));
    expect(removeTracksFromLibraryPlaylist).toHaveBeenCalledWith('pl-a', [
      'Blue',
    ]);
  });
});

describe('choosing a playlist', () => {
  it('shows the playlists behind the second page and adds to one', async () => {
    stored = {
      version: 1,
      playlists: [
        favoritesPlaylist(),
        {
          id: 'pl-a',
          name: 'Drive',
          trackIds: [],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    };
    renderRows([track({ title: 'Blue' })]);
    await openMenuOn('Blue');
    await userEvent.click(screen.getByText('Add to playlist'));
    await userEvent.click(await screen.findByText('Drive'));
    expect(addTracksToLibraryPlaylist).toHaveBeenCalledWith('pl-a', ['Blue']);
  });

  // Listed and disabled rather than hidden: a list that quietly omits the
  // playlist you were looking for reads as the playlist having been lost.
  it('shows a playlist the song is already in, unpressable', async () => {
    stored = {
      version: 1,
      playlists: [
        favoritesPlaylist(),
        {
          id: 'pl-a',
          name: 'Drive',
          trackIds: ['Blue'],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    };
    renderRows([track({ title: 'Blue' })]);
    await openMenuOn('Blue');
    await userEvent.click(screen.getByText('Add to playlist'));
    const entry = (await screen.findByText('Drive')).closest('button');
    expect(entry).toBeDisabled();
  });

  it('makes a new playlist with the song already in it', async () => {
    renderRows([track({ title: 'Blue' })]);
    await openMenuOn('Blue');
    await userEvent.click(screen.getByText('Add to playlist'));
    await userEvent.click(await screen.findByText('New playlist'));
    await userEvent.type(
      await screen.findByLabelText('Playlist name'),
      'Drive',
    );
    await userEvent.click(screen.getByText('Create'));
    expect(createLibraryPlaylist).toHaveBeenCalledWith('Drive', ['Blue']);
  });
});

describe('sending a song to Karaoke', () => {
  // Not "disabled", absent: a film is not a karaoke song this build declined,
  // it is one it was never going to be offered.
  it('is not offered for a video', async () => {
    renderRows([
      track({ title: 'Clip', kind: 'video', path: 'C:\\Music\\a.mp4' }),
    ]);
    await openMenuOn('Clip');
    expect(screen.queryByText('Send to Karaoke')).toBeNull();
  });

  it('is not offered for a container Karaoke cannot open', async () => {
    renderRows([track({ title: 'Odd', path: 'C:\\Music\\a.wma' })]);
    await openMenuOn('Odd');
    expect(screen.queryByText('Send to Karaoke')).toBeNull();
  });

  // A press that closes the menu and changes nothing is the failure this
  // covers: main declines anything past its size cap, and the menu has to
  // say so rather than swallow it.
  it('says why when main will not hand the bytes over', async () => {
    renderRows([track({ title: 'Blue' })]);
    await openMenuOn('Blue');
    await userEvent.click(screen.getByText('Send to Karaoke'));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(pendingKaraokeFiles()).toHaveLength(0);
  });

  it('queues the file for the Karaoke tab when the bytes arrive', async () => {
    libraryTrackBytes.mockResolvedValue(new ArrayBuffer(8));
    renderRows([track({ title: 'Blue' })]);
    await openMenuOn('Blue');
    await userEvent.click(screen.getByText('Send to Karaoke'));
    await waitFor(() => expect(pendingKaraokeFiles()).toHaveLength(1));
    expect(pendingKaraokeFiles()[0].name).toBe('a.mp3');
  });
});
