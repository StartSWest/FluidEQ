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

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  artistKey,
  folderDisplayName,
  groupIntoAlbums,
  groupIntoArtists,
  sortTracks,
  trackFolderPath,
} from '../../common/library/grouping';
import {
  ILibraryTrack,
  TLibrarySort,
  TLibrarySortDirection,
  TLibraryViewMode,
} from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import LibraryCoverArt from './LibraryCoverArt';
import LibraryGridView from './LibraryGridView';
import LibraryListView from './LibraryListView';

interface ILibraryDetailProps {
  tracks: readonly ILibraryTrack[];
  albumId?: string;
  artistId?: string;
  /** A physical directory, opened from the folder browse mode. Mutually
   * exclusive with the other two the same way they are with each other. */
  folderPath?: string;
  onBack: () => void;
  onPlayTrack: (trackId: string) => void;
  /** Forwarded straight to the `LibraryListView` this renders — see that
   * component's own doc comment for why it stays optional. */
  offlineRootIds?: ReadonlySet<string>;
  /** Which of the toolbar's three views the reader chose. Honoured here as
   * well as outside, because switching to Grid and then opening an album used
   * to drop them back into a table — the toggle appeared to stop working the
   * moment it had something to show. Cover Flow falls back to the list: a
   * carousel of the twelve tracks on one album is a worse table, not a
   * better one. */
  viewMode?: TLibraryViewMode;
}

/**
 * The drill-in behind a grid tile or a list row: a header for the one album
 * or artist, then its songs — `LibraryListView` in `browseMode="song"`
 * rather than a second table, so playability badges, the metadata-error
 * badge, keyboard rows and the reveal menu all still work here.
 *
 * `albumId` and `artistId` are mutually exclusive in practice — the
 * workspace that owns the drill-in state only ever sets one — but both are
 * optional here rather than a discriminated union, matching the interface
 * Task 15's brief specifies.
 */
/** The directory a file sits in. Splits on both separators for the same
 * reason `videoFolderGroups` does: a path arrives as Windows text but nothing
 * guarantees every one of them was written with a backslash. */
const trackFolder = (filePath: string): string => {
  const normalised = filePath.replace(/\\/g, '/');
  const cut = normalised.lastIndexOf('/');
  return cut > 0 ? normalised.slice(0, cut) : normalised;
};

const LibraryDetail = ({
  tracks,
  albumId,
  artistId,
  folderPath,
  onBack,
  onPlayTrack,
  offlineRootIds,
  viewMode = 'list',
}: ILibraryDetailProps) => {
  const { t } = useTranslation();

  /**
   * The column this table is ordered by, or nothing at all.
   *
   * Its own state rather than the toolbar's, because an album's default order
   * is not a column: it is disc-then-track, the order the record was pressed
   * in, and inheriting "Title" from outside would silently alphabetise every
   * album the reader opened. `undefined` means that natural order, and only a
   * header click leaves it.
   */
  const [sort, setSort] = useState<TLibrarySort | undefined>(undefined);
  const [sortDirection, setSortDirection] =
    useState<TLibrarySortDirection>('asc');

  /** Same rule as the workspace's own: the current column reverses, a
   * different one starts ascending rather than inheriting a direction nobody
   * asked it for. */
  const handleSort = useCallback((key: TLibrarySort) => {
    setSort((current) => {
      setSortDirection((direction) =>
        current === key && direction === 'asc' ? 'desc' : 'asc',
      );
      return key;
    });
  }, []);

  // `groupIntoAlbums`/`groupIntoArtists` walk every track in the library.
  // Memoised on the track list and the id actually being opened, so a
  // re-render this drill-in did not ask for does not redo it — see
  // `LibraryGridView`'s identical reasoning.
  const album = useMemo(
    () =>
      albumId
        ? groupIntoAlbums(tracks).find((entry) => entry.id === albumId)
        : undefined,
    [tracks, albumId],
  );
  const artist = useMemo(
    () =>
      artistId
        ? groupIntoArtists(tracks).find((entry) => entry.id === artistId)
        : undefined,
    [tracks, artistId],
  );

  // An id whose album or artist no longer exists — a rescan dropped the
  // folder, or the root itself was removed while this was open. Left alone,
  // the screen below would settle on "Unknown album", a generated tile, a
  // Play button that does nothing, and no way back other than knowing the
  // Back button is there: the blank-screen-with-no-explanation shape this
  // project's rules are written against. Closing automatically, rather than
  // showing that and waiting for the user to notice, is the only answer
  // that does not require them to.
  /** The tracks in one physical directory, in filename order — the order the
   * folder itself is in, which is the whole point of looking at one. */
  const folderTracks = useMemo(() => {
    if (!folderPath) {
      return [];
    }
    return tracks
      .filter((entry) => trackFolderPath(entry.path) === folderPath)
      .sort((left, right) => left.path.localeCompare(right.path));
  }, [tracks, folderPath]);

  const isOrphaned =
    (Boolean(albumId) && !album) ||
    (Boolean(artistId) && !artist) ||
    (Boolean(folderPath) && folderTracks.length === 0);

  useEffect(() => {
    if (isOrphaned) {
      onBack();
    }
  }, [isOrphaned, onBack]);

  // The album's own `trackIds` are already in disc/track/title order; an
  // artist has no such order of its own, so its tracks are grouped by album
  // the same way `LibraryToolbar`'s "Album" sort does.
  const detailTracks = useMemo(() => {
    if (albumId) {
      const byId = new Map(tracks.map((track) => [track.id, track]));
      return (album?.trackIds ?? [])
        .map((id) => byId.get(id))
        .filter((track): track is ILibraryTrack => track !== undefined);
    }
    if (artistId) {
      return sortTracks(
        tracks.filter((track) => artistKey(track) === artistId),
        'album',
      );
    }
    return folderTracks;
  }, [tracks, album, albumId, artistId, folderTracks]);

  /**
   * Files sitting in the same folders as this album, that the album does not
   * account for.
   *
   * A folder is very often not one clean album: a bonus disc, a couple of
   * loose singles, a live take tagged differently. Showing only the tagged
   * album hides them — the user opened a folder's worth of music and got
   * fewer songs than they know are there, with nothing saying why. Showing
   * them merged into the album would be the opposite lie.
   *
   * So they sit at the end of the same list, each row tagged as belonging to
   * the folder rather than to the album. A second table under its own heading
   * was tried first and read as two unrelated screens stacked up; one list
   * with a mark on the rows that are not part of the album says the same
   * thing without splitting the page in half.
   *
   * Only for an album drill-in: an artist is not a folder, and the same
   * question does not arise.
   */
  const strayTracks = useMemo(() => {
    if (!albumId || detailTracks.length === 0) {
      return [];
    }
    const included = new Set(detailTracks.map((track) => track.id));
    const folders = new Set(
      detailTracks.map((track) => trackFolder(track.path)),
    );
    return sortTracks(
      tracks.filter(
        (track) =>
          !included.has(track.id) && folders.has(trackFolder(track.path)),
      ),
      'title',
    );
  }, [tracks, detailTracks, albumId]);

  // One list: the album's own tracks, then its folder-mates behind them.
  const listTracks = useMemo(() => {
    const combined = [...detailTracks, ...strayTracks];
    // Untouched until a header is pressed — see `sort`'s own comment on why
    // an album's default order is not a column.
    return sort ? sortTracks(combined, sort, sortDirection) : combined;
  }, [detailTracks, strayTracks, sort, sortDirection]);
  const folderOnlyIds = useMemo(
    () => new Set(strayTracks.map((track) => track.id)),
    [strayTracks],
  );

  // Nothing to draw once the effect above has asked to leave — one render
  // of "Unknown album" and a dead Play button is exactly the flash this
  // guard exists to skip.
  if (isOrphaned) {
    return null;
  }

  const isAlbum = Boolean(albumId);
  const isFolder = Boolean(folderPath);
  const folderName = folderPath ? folderDisplayName(folderPath) : '';
  let title = artist?.name || t('library.unknownArtist');
  if (isAlbum) {
    title = album?.title || t('library.unknownAlbum');
  } else if (isFolder) {
    title = folderName;
  }
  // The full path under a folder's name: its last segment is what the reader
  // recognises, but "CD1" on its own says nothing about which CD1.
  let subtitle = '';
  if (isAlbum) {
    subtitle = album?.artist || t('library.unknownArtist');
  } else if (isFolder) {
    subtitle = folderPath ?? '';
  }
  let counts = `${t('library.albumCount', { count: artist?.albumCount ?? 0 })} · ${t(
    'library.trackCount',
    { count: artist?.trackCount ?? detailTracks.length },
  )}`;
  if (isAlbum || isFolder) {
    counts = t('library.trackCount', { count: detailTracks.length });
  }

  const handlePlay = () => {
    const first = detailTracks[0];
    if (first) {
      onPlayTrack(first.id);
    }
  };

  return (
    <div className="library-detail">
      <button
        type="button"
        className="library-toolbar__chip library-detail__back"
        onClick={onBack}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M10 3L5 8l5 5" />
        </svg>
        <span>{t('library.back')}</span>
      </button>
      <div className="library-detail__header">
        <LibraryCoverArt
          artId={
            (isAlbum || isFolder ? album?.artId : artist?.artId) ??
            detailTracks.find((entry) => entry.artId !== undefined)?.artId
          }
          label={title}
          size="cover"
        />
        <div className="library-detail__info">
          <h2 className="library-detail__title">{title}</h2>
          {subtitle && <p className="library-detail__subtitle">{subtitle}</p>}
          <p className="library-detail__counts">{counts}</p>
          {/* Emphasis follows recommendation: this is the one filled button
              on the screen, Back above is the quiet one. */}
          <button
            type="button"
            className="button small library-detail__play"
            onClick={handlePlay}
          >
            <MenuIcon name="play" className="library-detail__play-icon" />
            <span>{t('library.play')}</span>
          </button>
        </div>
      </div>
      {viewMode === 'grid' ? (
        <LibraryGridView
          tracks={listTracks}
          browseMode="song"
          onOpenAlbum={() => undefined}
          onOpenArtist={() => undefined}
          onPlayTrack={onPlayTrack}
          offlineRootIds={offlineRootIds}
          resetKey={`detail|${albumId ?? artistId ?? ''}`}
        />
      ) : (
        <LibraryListView
          tracks={listTracks}
          browseMode="song"
          onOpenAlbum={() => undefined}
          onOpenArtist={() => undefined}
          onPlayTrack={onPlayTrack}
          offlineRootIds={offlineRootIds}
          folderOnlyIds={folderOnlyIds}
          sort={sort}
          sortDirection={sortDirection}
          onSort={handleSort}
          resetKey={`detail|${albumId ?? artistId ?? ''}|${sort ?? ''}|${sortDirection}`}
        />
      )}
    </div>
  );
};

export default LibraryDetail;
