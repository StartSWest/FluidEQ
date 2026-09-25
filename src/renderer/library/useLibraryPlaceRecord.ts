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
import { useLibraryList } from './useLibraryList';

/**
 * The record open beneath the folder, named the way its own panel titles it
 * (`LibraryDetail`), for the last step of the place bar's trail.
 *
 * Asked of the store for that one record — the album, artist or genre shelf
 * narrowed to it — rather than found by walking the library. A playlist is
 * the listener's own and is named from `usePlaylists`.
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
    if (artistId !== undefined) {
      return {
        shelf: 'artists',
        scope: { artist: artistId },
        direction: 'asc',
      };
    }
    if (genreId !== undefined && genreId !== UNKNOWN_GENRE_ID) {
      return { shelf: 'genres', scope: { genre: genreId }, direction: 'asc' };
    }
    return undefined;
  }, [albumId, artistId, genreId]);
  const record = useLibraryList(query).at(0);
  if (albumId !== undefined) {
    return {
      kind: 'album',
      name:
        (record?.kind === 'album' ? record.title : '') ||
        t('library.unknownAlbum'),
    };
  }
  if (artistId !== undefined) {
    return {
      kind: 'artist',
      name:
        (record?.kind === 'artist' ? record.name : '') ||
        t('library.unknownArtist'),
    };
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
