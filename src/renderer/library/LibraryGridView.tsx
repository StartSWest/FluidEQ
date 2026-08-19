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

/**
 * One tile's worth of what `LibraryGridView` draws — deliberately the raw
 * tag values, not yet translated and not yet re-derived. Both the
 * "Unknown album" fallback and an artist's album count reach the screen as
 * plain data here (an empty string, a number already computed by
 * `groupIntoArtists`) and are only turned into words at render time, so
 * this shape — and the memo that produces it — never needs `t` as a
 * dependency, and never needs to re-walk `tracks` to answer "how many
 * albums does this artist have".
 */
interface IGridItem {
  id: string;
  artId?: string;
  title: string;
  artistName: string;
  albumCount?: number;
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
  // re-render this view did not ask for — the scan strip ticking, most of
  // all, since that fires once per file and re-renders `LibraryWorkspace`
  // (and everything under it) on every tick — does not redo it.
  // `onOpenAlbum`/`onOpenArtist`/`onPlayTrack` and `t` are deliberately NOT
  // dependencies: `LibraryWorkspace` hands down fresh closures every
  // render, so listing them here would defeat this memo exactly as often
  // as leaving it out entirely. Both are resolved in the render body below
  // instead — the same split `LibraryDetail` already makes between its
  // memoised lookups and its render-time `t(...)` calls.
  const items: IGridItem[] = useMemo(() => {
    if (browseMode === 'album') {
      return groupIntoAlbums(tracks).map((album) => ({
        id: album.id,
        artId: album.artId,
        title: album.title,
        artistName: album.artist,
      }));
    }
    if (browseMode === 'artist') {
      return groupIntoArtists(tracks).map((artist) => ({
        id: artist.id,
        artId: artist.artId,
        title: artist.name,
        artistName: '',
        albumCount: artist.albumCount,
      }));
    }
    // 'song', and any browse mode this view does not know about yet — the
    // same fallback `LibraryListView` makes: anything that is not 'album'
    // or 'artist' is treated as 'song'.
    return tracks.map((track) => ({
      id: track.id,
      artId: track.artId,
      title: track.title,
      artistName: track.artist ?? '',
    }));
  }, [tracks, browseMode]);

  /** The row's primary action, resolved from the always-current callback
   * props rather than baked into the memoised `items` above. */
  const openItem = (id: string) => {
    if (browseMode === 'album') {
      onOpenAlbum(id);
      return;
    }
    if (browseMode === 'artist') {
      onOpenArtist(id);
      return;
    }
    onPlayTrack(id);
  };

  /** The label under a tile's title — an artist's album count for an
   * artist tile, the album artist (or the fallback) for an album tile, the
   * track's own artist for a song tile. Kept out of `items` itself since it
   * is a translated string, not raw data — see the interface's doc
   * comment. */
  const tileSubtitle = (item: IGridItem): string => {
    if (browseMode === 'artist') {
      return t('library.albumCount', { count: item.albumCount ?? 0 });
    }
    if (browseMode === 'album') {
      return item.artistName || t('library.unknownArtist');
    }
    return item.artistName;
  };

  const tileTitle = (item: IGridItem): string => {
    if (browseMode === 'album') {
      return item.title || t('library.unknownAlbum');
    }
    if (browseMode === 'artist') {
      return item.title || t('library.unknownArtist');
    }
    return item.title;
  };

  return (
    <div className="library-grid" aria-label={t('tabs.library')}>
      {items.map((item) => {
        const title = tileTitle(item);
        const subtitle = tileSubtitle(item);
        return (
          <button
            key={item.id}
            type="button"
            className="library-grid__tile"
            onClick={() => openItem(item.id)}
          >
            <LibraryCoverArt artId={item.artId} label={title} size="tile" />
            <span className="library-grid__title">{title}</span>
            <small className="library-grid__subtitle">{subtitle}</small>
          </button>
        );
      })}
    </div>
  );
};

export default LibraryGridView;
