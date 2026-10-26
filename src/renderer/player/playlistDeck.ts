/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { usePlaylists } from '../library/PlaylistContext';
import { useLibraryTracks } from '../library/useLibraryTracks';

/** One playlist as the amp lists it. */
export interface IPlaylistDeckItem {
  id: string;
  name: string;
  count: number;
  /** Favourites, whose name the amp says in its own language. */
  isFavorites: boolean;
  /** Its first song's cover, which stands for the playlist on the page. */
  artId?: string;
}

/**
 * The Library's playlists and Favourites, for the amp (Ivan, 2026-10-25: the
 * one amp's Playlists page and the heart beside the song).
 *
 * The playlists live in a provider inside the full shell, which the amp is
 * not inside (`App.tsx` mounts it beside the shell), so the Library publishes
 * them from there, as it publishes its queue (`libraryDeck.ts`), and the amp
 * reads them from anywhere. Nothing is published until the Library's
 * providers are up.
 */
export interface IPlaylistDeck {
  playlists: IPlaylistDeckItem[];
  /** Plays a playlist from its first song, as its own Play does. */
  play: (playlistId: string) => void;
  isFavorite: (trackId: string) => boolean;
  toggleFavorite: (trackId: string) => void;
  /** A new playlist of these songs, as the Library's own picker makes one. */
  create: (name: string, trackIds: readonly string[]) => void;
}

let deck: IPlaylistDeck | undefined;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const setDeck = (next: IPlaylistDeck | undefined) => {
  deck = next;
  listeners.forEach((listener) => listener());
};

/** The Library's playlists, or nothing before its providers are up. */
export const usePlaylistDeck = (): IPlaylistDeck | undefined =>
  useSyncExternalStore(subscribe, () => deck);

/**
 * Publishes the playlists from inside the Library's players, where both the
 * playlists and the player that plays them are, and takes them back when
 * those providers go.
 */
export const usePublishedPlaylistDeck = (
  playTracks: (trackIds: readonly string[], startTrackId: string) => void,
) => {
  const { playlists, isFavorite, toggleFavorite, createPlaylist } =
    usePlaylists();
  // Each playlist's first song, asked for by id and nothing else: the
  // playlists hold ids, and a cover is all the page needs of a song.
  const firstIds = useMemo(
    () =>
      playlists
        .map((playlist) => playlist.trackIds[0])
        .filter((id): id is string => id !== undefined),
    [playlists],
  );
  const firsts = useLibraryTracks(firstIds);
  useEffect(() => {
    setDeck({
      playlists: playlists.map((playlist) => {
        const [first] = playlist.trackIds;
        return {
          id: playlist.id,
          name: playlist.name,
          count: playlist.trackIds.length,
          isFavorites: playlist.isBuiltIn === true,
          artId: first === undefined ? undefined : firsts.get(first)?.artId,
        };
      }),
      play: (playlistId) => {
        const trackIds =
          playlists.find((playlist) => playlist.id === playlistId)?.trackIds ??
          [];
        const [first] = trackIds;
        if (first !== undefined) {
          playTracks(trackIds, first);
        }
      },
      isFavorite,
      toggleFavorite,
      create: createPlaylist,
    });
  }, [
    createPlaylist,
    firsts,
    isFavorite,
    playTracks,
    playlists,
    toggleFavorite,
  ]);
  useEffect(() => () => setDeck(undefined), []);
};
