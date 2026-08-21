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

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  FAVORITES_PLAYLIST_ID,
  ILibraryPlaylist,
  ILibraryPlaylists,
  emptyLibraryPlaylists,
  findPlaylist,
  isTrackInPlaylist,
  sortPlaylists,
} from '../../common/library/playlists';

interface IPlaylistContextValue {
  /** Favorites first, then by name — the order every surface shows. */
  playlists: readonly ILibraryPlaylist[];
  favorites: ILibraryPlaylist | undefined;
  /** The first read has come back. The difference between "no playlists" and
   * "not asked yet", exactly as `isIndexLoaded` is next door. */
  isLoaded: boolean;
  /** The stored file could not be read and was replaced. Surfaced once. */
  wasReset: boolean;
  isFavorite: (trackId: string) => boolean;
  toggleFavorite: (trackId: string) => void;
  createPlaylist: (name: string, trackIds?: readonly string[]) => void;
  renamePlaylist: (playlistId: string, name: string) => void;
  deletePlaylist: (playlistId: string) => void;
  addTracks: (playlistId: string, trackIds: readonly string[]) => void;
  removeTracks: (playlistId: string, trackIds: readonly string[]) => void;
}

const PlaylistContext = createContext<IPlaylistContextValue | undefined>(
  undefined,
);

/**
 * The playlists, one copy, beside the index rather than inside it.
 *
 * A second provider instead of more fields on `LibraryContext` because the
 * two change at wildly different rates and for unrelated reasons: that one
 * re-renders the whole tree several times a second for the length of a scan,
 * and this one changes when somebody presses a menu item. Folding them
 * together would put every row's favourite star behind a scan's render
 * storm — the same reasoning `LiveAudioContext` was split on, applied before
 * it costs anything rather than after.
 *
 * Every mutator is fire-and-forget: main replies with the whole new set and
 * broadcasts it as well, and the broadcast is what this state is written
 * from. One path in, so a reply and a broadcast can never disagree about
 * what happened.
 */
export const PlaylistProvider = ({ children }: { children: ReactNode }) => {
  const [playlists, setPlaylists] = useState<ILibraryPlaylists>(
    emptyLibraryPlaylists,
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const [wasReset, setWasReset] = useState(false);

  useEffect(() => {
    let mounted = true;
    // Optional-chained for the reason `LibraryPlayerContext` chains its own
    // reach for `libraryTrackBytes`: a test mounts this with a partial
    // `window.electron`, and a provider that throws on a missing channel
    // takes the whole tab down rather than showing an empty playlist list.
    const read = window.electron?.ipcRenderer?.getLibraryPlaylists;
    if (!read) {
      setIsLoaded(true);
      return undefined;
    }
    read()
      .then((result) => {
        if (mounted) {
          setPlaylists(result.playlists);
          setWasReset(result.wasReset);
          setIsLoaded(true);
        }
        return undefined;
      })
      // Loaded on a failure too, for the reason `LibraryContext` is: a
      // rejection that left this false would leave every menu waiting on a
      // list that is never coming.
      .catch(() => {
        if (mounted) {
          setIsLoaded(true);
        }
      });
    const unsubscribe =
      window.electron?.ipcRenderer?.onLibraryPlaylistsChanged?.((next) =>
        setPlaylists(next),
      );
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const sorted = useMemo(() => sortPlaylists(playlists.playlists), [playlists]);

  const favorites = useMemo(
    () => findPlaylist(sorted, FAVORITES_PLAYLIST_ID),
    [sorted],
  );

  const isFavorite = useCallback(
    (trackId: string) => isTrackInPlaylist(favorites, trackId),
    [favorites],
  );

  /**
   * Fire and forget, and never await the reply.
   *
   * The state below is written from the broadcast alone, so awaiting the
   * reply here would only give a second path to the same value — and two
   * paths that can disagree is how a list ends up briefly showing what it
   * held a moment ago. The rejection is swallowed because main already logged
   * whatever failed, and there is nothing this side can usefully do with it.
   */
  const send = useCallback((result: Promise<unknown> | undefined) => {
    result?.catch(() => undefined);
  }, []);

  const toggleFavorite = useCallback(
    (trackId: string) => {
      const ipc = window.electron?.ipcRenderer;
      send(
        isTrackInPlaylist(favorites, trackId)
          ? ipc?.removeTracksFromLibraryPlaylist(FAVORITES_PLAYLIST_ID, [
              trackId,
            ])
          : ipc?.addTracksToLibraryPlaylist(FAVORITES_PLAYLIST_ID, [trackId]),
      );
    },
    [favorites, send],
  );

  const createPlaylist = useCallback(
    (name: string, trackIds: readonly string[] = []) => {
      send(window.electron?.ipcRenderer?.createLibraryPlaylist(name, trackIds));
    },
    [send],
  );

  const renamePlaylist = useCallback(
    (playlistId: string, name: string) => {
      send(
        window.electron?.ipcRenderer?.renameLibraryPlaylist(playlistId, name),
      );
    },
    [send],
  );

  const deletePlaylist = useCallback(
    (playlistId: string) => {
      send(window.electron?.ipcRenderer?.deleteLibraryPlaylist(playlistId));
    },
    [send],
  );

  const addTracks = useCallback(
    (playlistId: string, trackIds: readonly string[]) => {
      send(
        window.electron?.ipcRenderer?.addTracksToLibraryPlaylist(
          playlistId,
          trackIds,
        ),
      );
    },
    [send],
  );

  const removeTracks = useCallback(
    (playlistId: string, trackIds: readonly string[]) => {
      send(
        window.electron?.ipcRenderer?.removeTracksFromLibraryPlaylist(
          playlistId,
          trackIds,
        ),
      );
    },
    [send],
  );

  const value = useMemo<IPlaylistContextValue>(
    () => ({
      playlists: sorted,
      favorites,
      isLoaded,
      wasReset,
      isFavorite,
      toggleFavorite,
      createPlaylist,
      renamePlaylist,
      deletePlaylist,
      addTracks,
      removeTracks,
    }),
    [
      sorted,
      favorites,
      isLoaded,
      wasReset,
      isFavorite,
      toggleFavorite,
      createPlaylist,
      renamePlaylist,
      deletePlaylist,
      addTracks,
      removeTracks,
    ],
  );

  return (
    <PlaylistContext.Provider value={value}>
      {children}
    </PlaylistContext.Provider>
  );
};

/**
 * An empty, inert set for a tree with no provider above it.
 *
 * `useTranslation` makes the same choice next door and for the same reason: a
 * view rendered on its own — in a test, or inside a panel that has not been
 * wrapped yet — should draw, not throw. It is safe here because the absence
 * is visible rather than silent: with no provider there is no Favourites
 * entry and no playlists to add to, which is obvious the moment the menu is
 * opened rather than a press that quietly changes nothing.
 */
const NO_PLAYLISTS: IPlaylistContextValue = {
  playlists: [],
  favorites: undefined,
  isLoaded: false,
  wasReset: false,
  isFavorite: () => false,
  toggleFavorite: () => undefined,
  createPlaylist: () => undefined,
  renamePlaylist: () => undefined,
  deletePlaylist: () => undefined,
  addTracks: () => undefined,
  removeTracks: () => undefined,
};

export const usePlaylists = (): IPlaylistContextValue =>
  useContext(PlaylistContext) ?? NO_PLAYLISTS;
