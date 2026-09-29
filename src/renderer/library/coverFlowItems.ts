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

import type { Translate } from '../../common/i18n';
import { UNKNOWN_GENRE_ID } from '../../common/library/genres';
import {
  FAVORITES_PLAYLIST_ID,
  type ILibraryPlaylist,
} from '../../common/library/playlists';
import type { TLibraryListItem } from '../../common/library/query';

/** One cover's worth of what this view draws, words resolved. */
export interface ICoverFlowItem {
  id: string;
  artId?: string;
  title: string;
  /** The title as the store has it, before an empty one is named "Unknown
   * album": what the rail files the cover under, as the store does. */
  railTitle: string;
  subtitle: string;
  /** Every song grouped here is still unread — see `groupIntoAlbums`. */
  isPending: boolean;
}

export const clampIndex = (index: number, length: number): number => {
  if (length <= 0) {
    return 0;
  }
  return Math.min(Math.max(index, 0), length - 1);
};

/** A cover, words resolved, from what the store sent. */
export const coverFlowItemOf = (
  item: TLibraryListItem,
  t: Translate,
): ICoverFlowItem | undefined => {
  switch (item.kind) {
    case 'album':
      return {
        id: item.id,
        artId: item.artId,
        title: item.title || t('library.unknownAlbum'),
        railTitle: item.title,
        subtitle: item.artist || t('library.unknownArtist'),
        isPending: item.isPending,
      };
    case 'artist':
      return {
        id: item.id,
        artId: item.artId,
        title: item.name || t('library.unknownArtist'),
        railTitle: item.name,
        subtitle: t('library.albumCount', { count: item.albumCount }),
        isPending: item.isPending,
      };
    case 'genre':
      return {
        id: item.id,
        artId: item.artId,
        title:
          item.id === UNKNOWN_GENRE_ID ? t('library.genre.unknown') : item.name,
        railTitle: item.name,
        subtitle: t('library.artistCount', { count: item.artistCount }),
        isPending: item.isPending,
      };
    case 'folder':
      // The path under the name: two folders called "CD1" are the normal
      // case, and the name alone cannot tell them apart.
      return {
        id: item.id,
        artId: item.artId,
        title: item.name,
        railTitle: item.name,
        subtitle: item.id,
        isPending: item.isPending,
      };
    case 'track':
      return {
        id: item.track.id,
        artId: item.track.artId,
        title: item.track.title,
        railTitle: item.track.title,
        subtitle: item.track.artist ?? '',
        isPending: item.track.isPending === true,
      };
    default:
      return undefined;
  }
};

/** A playlist's cover: the listener's own name, and how many songs. */
export const playlistCoverFlowItem = (
  playlist: ILibraryPlaylist,
  artId: string | undefined,
  t: Translate,
): ICoverFlowItem => ({
  id: playlist.id,
  artId,
  title:
    playlist.id === FAVORITES_PLAYLIST_ID
      ? t('library.playlist.favorites')
      : playlist.name,
  railTitle: playlist.name,
  subtitle: t(
    playlist.trackIds.length === 1
      ? 'library.playlist.songCountOne'
      : 'library.playlist.songCount',
    { count: playlist.trackIds.length },
  ),
  isPending: false,
});
