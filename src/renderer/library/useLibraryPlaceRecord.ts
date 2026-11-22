/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo } from 'react';
import { UNKNOWN_GENRE_ID } from '../../common/library/genres';
import {
  FAVORITES_PLAYLIST_ID,
  findPlaylist,
} from '../../common/library/playlists';
import type { ILibraryListQuery } from '../../common/library/query';
import { useTranslation } from '../utils/I18nContext';
import type { ILibraryPlaceRecord } from './LibraryPlaceBar';
import { usePlaylists } from './PlaylistContext';
import { useLibraryAnswer } from './useLibraryAnswer';
import { useLibraryList } from './useLibraryList';

/**
 * The record open beneath the folder, named the way its own panel titles it
 * (`LibraryDetail`), for the last step of the place bar's trail.
 *
 * Asked of the store for that one record — the album or genre shelf narrowed
 * to it, the artist's own page head — rather than found by walking the
 * library. A playlist is the listener's own and is named from
 * `usePlaylists`.
 *
 * `genreId` and `playlistId` only while their own shelf is up, the way the
 * panel is handed them — a remembered genre means nothing over Albums.
 */
const useLibraryPlaceRecord = ({
  albumId,
  artistId,
  genreId,
  playlistId,
}: {
  albumId: string | undefined;
  artistId: string | undefined;
  genreId: string | undefined;
  playlistId: string | undefined;
}): ILibraryPlaceRecord | undefined => {
  const { t } = useTranslation();
  const { playlists } = usePlaylists();
  const query = useMemo((): ILibraryListQuery | undefined => {
    if (albumId !== undefined) {
      return { shelf: 'albums', scope: { album: albumId }, direction: 'asc' };
    }
    if (genreId !== undefined && genreId !== UNKNOWN_GENRE_ID) {
      return { shelf: 'genres', scope: { genre: genreId }, direction: 'asc' };
    }
    return undefined;
  }, [albumId, genreId]);
  const record = useLibraryList(query).at(0);
  // As the artist's page names them: somebody only ever a guest on other
  // people's songs has no row on the Artists shelf, and is named as credited.
  const artist = useLibraryAnswer(
    artistId === undefined ? undefined : { type: 'artist', id: artistId },
  );
  if (albumId !== undefined) {
    return {
      kind: 'album',
      name:
        (record?.kind === 'album' ? record.title : '') ||
        t('library.unknownAlbum'),
    };
  }
  if (artistId !== undefined) {
    // Nothing until the answer is here: "Unknown artist" for the moment a
    // page takes to name itself read as the name being lost.
    let name = '';
    if (artist !== undefined) {
      name = artist?.name || t('library.unknownArtist');
    }
    return { kind: 'artist', name };
  }
  if (genreId === UNKNOWN_GENRE_ID) {
    return { kind: 'genre', name: t('library.genre.unknown') };
  }
  if (genreId !== undefined) {
    return { kind: 'genre', name: record?.kind === 'genre' ? record.name : '' };
  }
  if (playlistId !== undefined) {
    return {
      kind: 'playlist',
      name:
        playlistId === FAVORITES_PLAYLIST_ID
          ? t('library.playlist.favorites')
          : (findPlaylist(playlists, playlistId)?.name ?? ''),
    };
  }
  return undefined;
};

export default useLibraryPlaceRecord;
