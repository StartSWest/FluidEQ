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

/**
 * The playlist channels, kept out of `ipc/library.ts`.
 *
 * That file is the scanner's: an in-memory index, a walk that must not run
 * twice at once, and the progress those two send. None of that is involved in
 * naming a list of songs, and the file was already at the size where the next
 * thing added to it is the thing that makes it unreadable.
 *
 * Every handler answers with the whole set rather than a delta, the way
 * `library-root-add` answers with the whole index. The set is a few hundred
 * ids at the very most, the renderer would have to rebuild its copy either
 * way, and a reply that is the new truth cannot drift from it.
 */

import { BrowserWindow, ipcMain } from 'electron';
import {
  FAVORITES_PLAYLIST_ID,
  ILibraryPlaylist,
  ILibraryPlaylists,
  addTracksToPlaylist,
  emptyLibraryPlaylists,
  findPlaylist,
  normalizePlaylistName,
  removeTracksFromPlaylist,
} from '../../common/library/playlists';
import {
  loadLibraryPlaylists,
  saveLibraryPlaylists,
} from '../library/libraryPlaylists';

export interface ILibraryPlaylistsIpcDeps {
  userDataDir: string;
  /** A function for the reason `ILibraryIpcDeps.getMainWindow` is one: the
   * window outlives no part of this module, and registration runs before any
   * window exists. */
  getMainWindow: () => BrowserWindow | null;
}

let current: ILibraryPlaylists = emptyLibraryPlaylists();
let wasReset = false;
let isLoaded = false;

/**
 * Read on the first request rather than at registration.
 *
 * Registration happens at module scope in `main.ts`, before `whenReady`, and
 * the userData directory is not guaranteed to exist that early. The first
 * thing the renderer asks for is the set itself, so a lazy read costs nothing
 * and removes the ordering question entirely.
 */
const ensureLoaded = (userDataDir: string): void => {
  if (isLoaded) {
    return;
  }
  const result = loadLibraryPlaylists(userDataDir);
  current = result.playlists;
  wasReset = result.wasReset;
  isLoaded = true;
};

const commit = (
  deps: ILibraryPlaylistsIpcDeps,
  playlists: ILibraryPlaylist[],
): ILibraryPlaylists => {
  current = { version: 1, playlists };
  try {
    saveLibraryPlaylists(deps.userDataDir, current);
  } catch (error) {
    // The change stands in memory and is reported as done, because it is:
    // refusing it would lose an action the user already took, and the next
    // successful write carries it. What must not happen is the failure
    // vanishing — a playlist that quietly stops surviving restarts is
    // otherwise indistinguishable from one nobody saved.
    // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
    console.error('Could not save the library playlists', error);
  }
  // Every window, not the caller alone. Only one shows the library today, but
  // the reply and the broadcast disagreeing is the class of bug that is only
  // ever found late.
  deps.getMainWindow()?.webContents.send('library-playlists-changed', current);
  return current;
};

/** Both string arguments and both arrays arrive from a renderer, so neither
 * is trusted: an id is compared against what is actually stored, and a list
 * of track ids is filtered to strings before anything is done with it. */
const asTrackIds = (raw: unknown): string[] =>
  Array.isArray(raw)
    ? raw.filter((entry): entry is string => typeof entry === 'string')
    : [];

export const registerLibraryPlaylistsIpc = (
  deps: ILibraryPlaylistsIpcDeps,
): void => {
  ipcMain.handle('library-playlists-get', () => {
    ensureLoaded(deps.userDataDir);
    return { playlists: current, wasReset };
  });

  ipcMain.handle(
    'library-playlist-create',
    (_event, rawName: unknown, rawTrackIds: unknown) => {
      ensureLoaded(deps.userDataDir);
      const name = normalizePlaylistName(rawName);
      if (name === undefined) {
        return current;
      }
      const now = Date.now();
      // Not `crypto.randomUUID()`: an id ends up in a `localStorage` key and
      // in the drill-in the workspace restores on launch, and a shorter one
      // is easier to read in a bug report. Collision across a set this small
      // is not a real risk, and it is checked anyway.
      let id = `pl-${now.toString(36)}`;
      let suffix = 0;
      while (findPlaylist(current.playlists, id)) {
        suffix += 1;
        id = `pl-${now.toString(36)}-${suffix}`;
      }
      const playlist: ILibraryPlaylist = {
        id,
        name,
        trackIds: [],
        createdAt: now,
        updatedAt: now,
      };
      return commit(
        deps,
        addTracksToPlaylist(
          [...current.playlists, playlist],
          id,
          asTrackIds(rawTrackIds),
        ),
      );
    },
  );

  ipcMain.handle(
    'library-playlist-rename',
    (_event, rawId: unknown, rawName: unknown) => {
      ensureLoaded(deps.userDataDir);
      const name = normalizePlaylistName(rawName);
      if (typeof rawId !== 'string' || name === undefined) {
        return current;
      }
      const playlist = findPlaylist(current.playlists, rawId);
      // Favorites is refused here and not only hidden in the interface. The
      // interface is not the place a rule like this can be enforced.
      if (!playlist || playlist.isBuiltIn) {
        return current;
      }
      return commit(
        deps,
        current.playlists.map((entry) =>
          entry.id === rawId
            ? { ...entry, name, updatedAt: Date.now() }
            : entry,
        ),
      );
    },
  );

  ipcMain.handle('library-playlist-delete', (_event, rawId: unknown) => {
    ensureLoaded(deps.userDataDir);
    if (typeof rawId !== 'string' || rawId === FAVORITES_PLAYLIST_ID) {
      return current;
    }
    const playlist = findPlaylist(current.playlists, rawId);
    if (!playlist || playlist.isBuiltIn) {
      return current;
    }
    return commit(
      deps,
      current.playlists.filter((entry) => entry.id !== rawId),
    );
  });

  ipcMain.handle(
    'library-playlist-tracks-add',
    (_event, rawId: unknown, rawTrackIds: unknown) => {
      ensureLoaded(deps.userDataDir);
      if (
        typeof rawId !== 'string' ||
        !findPlaylist(current.playlists, rawId)
      ) {
        return current;
      }
      return commit(
        deps,
        addTracksToPlaylist(current.playlists, rawId, asTrackIds(rawTrackIds)),
      );
    },
  );

  ipcMain.handle(
    'library-playlist-tracks-remove',
    (_event, rawId: unknown, rawTrackIds: unknown) => {
      ensureLoaded(deps.userDataDir);
      if (
        typeof rawId !== 'string' ||
        !findPlaylist(current.playlists, rawId)
      ) {
        return current;
      }
      return commit(
        deps,
        removeTracksFromPlaylist(
          current.playlists,
          rawId,
          asTrackIds(rawTrackIds),
        ),
      );
    },
  );
};
