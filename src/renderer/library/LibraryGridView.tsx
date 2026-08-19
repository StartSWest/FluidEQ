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

import { useMemo } from 'react';
import {
  groupIntoAlbums,
  groupIntoArtists,
} from '../../common/library/grouping';
import { ILibraryTrack, TLibraryBrowseMode } from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import LibraryCoverArt from './LibraryCoverArt';

interface ILibraryGridViewProps {
  tracks: readonly ILibraryTrack[];
  browseMode: TLibraryBrowseMode;
  onOpenAlbum: (albumId: string) => void;
  onOpenArtist: (artistId: string) => void;
  onPlayTrack: (trackId: string) => void;
}

/** One tile's worth of what `LibraryGridView` draws — a cover, a title and
 * a secondary line — whatever `browseMode` it was built from. */
interface IGridTile {
  key: string;
  artId?: string;
  title: string;
  subtitle: string;
  onOpen: () => void;
}

/**
 * The grid: one tile per album, artist or song, `LibraryCoverArt
 * size="tile"` over a title and a secondary line — the same three fields
 * `LibraryListView` puts in a row, laid out as a card instead.
 *
 * `grid-template-columns: repeat(auto-fill, minmax(150px, 1fr))` in
 * `Library.scss` picks the column count from the window's width, never a
 * fixed number — a library this is meant to hold thousands of albums in has
 * no one right column count to hardcode.
 */
const LibraryGridView = ({
  tracks,
  browseMode,
  onOpenAlbum,
  onOpenArtist,
  onPlayTrack,
}: ILibraryGridViewProps) => {
  const { t } = useTranslation();

  // `groupIntoAlbums`/`groupIntoArtists` walk every track in the library.
  // Memoised on the track list and the mode actually being shown, so a
  // re-render this view did not ask for — the scan strip ticking, the view-
  // mode toggle switching back to List and forth again — does not redo it,
  // and only the grouping the current mode needs is ever computed.
  const tiles: IGridTile[] = useMemo(() => {
    if (browseMode === 'artist') {
      return groupIntoArtists(tracks).map((artist) => {
        const name = artist.name || t('library.unknownArtist');
        return {
          key: artist.id,
          artId: artist.artId,
          title: name,
          subtitle: t('library.albumCount', { count: artist.albumCount }),
          onOpen: () => onOpenArtist(artist.id),
        };
      });
    }
    if (browseMode === 'song') {
      return tracks.map((track) => ({
        key: track.id,
        artId: track.artId,
        title: track.title,
        subtitle: track.artist ?? '',
        onOpen: () => onPlayTrack(track.id),
      }));
    }
    // 'album', and any browse mode this view does not know about yet — the
    // same fallback `LibraryListView` makes.
    return groupIntoAlbums(tracks).map((album) => {
      const title = album.title || t('library.unknownAlbum');
      return {
        key: album.id,
        artId: album.artId,
        title,
        subtitle: album.artist || t('library.unknownArtist'),
        onOpen: () => onOpenAlbum(album.id),
      };
    });
  }, [tracks, browseMode, onOpenAlbum, onOpenArtist, onPlayTrack, t]);

  return (
    <div className="library-grid" aria-label={t('tabs.library')}>
      {tiles.map((tile) => (
        <button
          key={tile.key}
          type="button"
          className="library-grid__tile"
          onClick={tile.onOpen}
        >
          <LibraryCoverArt artId={tile.artId} label={tile.title} size="tile" />
          <span className="library-grid__title">{tile.title}</span>
          <small className="library-grid__subtitle">{tile.subtitle}</small>
        </button>
      ))}
    </div>
  );
};

export default LibraryGridView;
