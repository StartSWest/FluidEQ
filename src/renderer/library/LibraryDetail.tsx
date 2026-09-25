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
  folderDisplayName,
  normalizeForGrouping,
} from '../../common/library/grouping';
import { UNKNOWN_GENRE_ID } from '../../common/library/genres';
import {
  FAVORITES_PLAYLIST_ID,
  findPlaylist,
} from '../../common/library/playlists';
import type {
  ILibraryListQuery,
  ILibraryScope,
  TLibraryListItem,
  TLibraryNaturalOrder,
} from '../../common/library/query';
import type {
  TLibrarySort,
  TLibrarySortDirection,
  TLibraryViewMode,
} from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import LibraryDetailHeader from './LibraryDetailHeader';
import LibraryGridView from './LibraryGridView';
import LibraryListView from './LibraryListView';
import { usePlaylists } from './PlaylistContext';
import { useLibraryList } from './useLibraryList';

interface ILibraryDetailProps {
  albumId?: string;
  artistId?: string;
  /** A genre bucket, opened from the Genres shelf. Mutually exclusive with
   * the others the same way they are with each other. */
  genreId?: string;
  /** A physical directory, opened from the Folders shelf. */
  folderPath?: string;
  /** A playlist, opened from the Playlists shelf. */
  playlistId?: string;
  onBack: () => void;
  onPlayTrack: (trackId: string) => void;
  /** A song pressed twice in one double-press — forwarded to the table and
   * grid below. See `LibraryListView`'s own prop of the same name. */
  onRestartTrack?: (trackId: string) => void;
  /** Put this panel's whole list at the end of what is already queued.
   * Without it the button is not drawn. */
  onQueueTracks?: (trackIds: readonly string[]) => void;
  offlineRootIds?: ReadonlySet<string>;
  /** Walk into a folder from this panel: one of its own subfolders. */
  onOpenFolder?: (folderPath: string) => void;
  /** Which of the toolbar's three views the reader chose. Honoured here as
   * well, because switching to Grid and then opening an album used to drop
   * them back into a table. Cover Flow falls back to the list: a carousel of
   * the twelve songs on one album is a worse table, not a better one. */
  viewMode?: TLibraryViewMode;
  /** The song the player is on, forwarded to the table below. */
  playingTrackId?: string;
  /** A row to scroll to and mark — forwarded straight through. */
  revealTrack?: { trackId: string; nonce: number };
  /** The toolbar's search, applied here ONLY when it is not what found this
   * panel — see `isQueryTheContainer`. */
  query?: string;
}

/** What a record's songs are in scope, and the order a record is heard in. */
const recordOf = ({
  albumId,
  artistId,
  genreId,
  folderPath,
  playlistTrackIds,
}: {
  albumId?: string;
  artistId?: string;
  genreId?: string;
  folderPath?: string;
  playlistTrackIds?: readonly string[];
}): { scope: ILibraryScope; natural: TLibraryNaturalOrder } | undefined => {
  if (albumId) {
    // The record as pressed, then the files sharing its folders without
    // being on it: a bonus disc, loose singles, a take tagged differently.
    // One list, those rows marked — a table of their own was tried first and
    // read as two unrelated screens.
    return {
      scope: { album: albumId, withFolderMates: true },
      natural: 'disc',
    };
  }
  if (artistId) {
    return { scope: { artist: artistId }, natural: 'album' };
  }
  if (genreId) {
    // By album, so a genre reads as records rather than a thousand songs.
    return { scope: { genre: genreId }, natural: 'album' };
  }
  if (playlistTrackIds) {
    return { scope: { ids: playlistTrackIds }, natural: 'ids' };
  }
  if (folderPath) {
    // Filename order — the order the folder itself is in.
    return { scope: { folder: folderPath }, natural: 'path' };
  }
  return undefined;
};

/**
 * The drill-in behind a tile, a row or a cover: a header for the one album,
 * artist, genre, folder or playlist, then its songs — the same table the
 * shelf uses, so every badge, key and menu works here too.
 *
 * Everything on it is asked of the store for this one record: its summary,
 * its songs a page at a time, the folders inside it. It used to group the
 * whole library to find one album.
 */
const LibraryDetail = ({
  albumId,
  artistId,
  genreId,
  folderPath,
  playlistId,
  onBack,
  onPlayTrack,
  onRestartTrack,
  onQueueTracks,
  offlineRootIds,
  onOpenFolder,
  viewMode = 'list',
  playingTrackId,
  revealTrack,
  query = '',
}: ILibraryDetailProps) => {
  const { t } = useTranslation();
  const { playlists, renamePlaylist, deletePlaylist } = usePlaylists();

  /**
   * The column this table is ordered by, or nothing at all: an album's
   * default order is not a column but the order it was pressed in, and
   * inheriting "Title" from outside would alphabetise every album opened.
   */
  const [sort, setSort] = useState<TLibrarySort | undefined>(undefined);
  const [sortDirection, setSortDirection] =
    useState<TLibrarySortDirection>('asc');
  /** Narrows this table and nothing else: a question about one record, not
   * a standing filter the way the toolbar's search is. */
  const [filter, setFilter] = useState('');

  /** The current column reverses; a different one starts ascending. */
  const handleSort = useCallback((key: TLibrarySort) => {
    setSort((current) => {
      setSortDirection((direction) =>
        current === key && direction === 'asc' ? 'desc' : 'asc',
      );
      return key;
    });
  }, []);

  const playlist = useMemo(
    () => (playlistId ? findPlaylist(playlists, playlistId) : undefined),
    [playlists, playlistId],
  );
  const record = useMemo(
    () =>
      recordOf({
        albumId,
        artistId,
        genreId,
        folderPath,
        playlistTrackIds: playlist?.trackIds,
      }),
    [albumId, artistId, genreId, folderPath, playlist],
  );

  /**
   * THE RECORD ITSELF: its name and counts. For a folder, everything beneath
   * it — how much is there, and whether anything is there at all, which is
   * what tells a folder that is gone from one holding only folders. For a
   * playlist, what the library can still see of it, unfiltered.
   */
  const summaryQuery = useMemo((): ILibraryListQuery | undefined => {
    if (albumId) {
      return { shelf: 'albums', scope: { album: albumId }, direction: 'asc' };
    }
    if (artistId) {
      return {
        shelf: 'artists',
        scope: { artist: artistId },
        direction: 'asc',
      };
    }
    if (genreId) {
      return { shelf: 'genres', scope: { genre: genreId }, direction: 'asc' };
    }
    if (folderPath) {
      return {
        shelf: 'tracks',
        scope: { beneath: folderPath },
        natural: 'path',
        direction: 'asc',
      };
    }
    if (playlist) {
      return {
        shelf: 'tracks',
        scope: { ids: playlist.trackIds },
        natural: 'ids',
        direction: 'asc',
      };
    }
    return undefined;
  }, [albumId, artistId, genreId, folderPath, playlist]);
  const summary = useLibraryList(summaryQuery);
  const summaryItem = summary.at(0);
  const album = summaryItem?.kind === 'album' ? summaryItem : undefined;
  const artist = summaryItem?.kind === 'artist' ? summaryItem : undefined;
  const genre = summaryItem?.kind === 'genre' ? summaryItem : undefined;

  /**
   * WHY THIS PANEL CAME UP DECIDES WHAT IT SHOWS.
   *
   * Searching "nsync" and opening CELEBRITY — the record itself is what the
   * query named, and the whole record is what was asked for. Searching
   * "nsync" and opening VARIOS — a five-hundred-song compilation that came up
   * for two of its songs — the two are the reason it is on screen. So: if the
   * query names this album, artist, genre or folder, it found the container
   * and the container is shown plain; otherwise the songs it found inside are
   * lit and lifted to the head of the table (`mark`). Folded the way
   * GROUPING folds, so "nsync" names a record whose artist reads `N'Sync`.
   */
  const needle = normalizeForGrouping(query);
  const isQueryTheContainer =
    needle === '' ||
    [
      album?.title,
      album?.artist,
      artist?.name,
      genre?.name,
      folderPath ? folderDisplayName(folderPath) : undefined,
    ].some(
      (value) =>
        value !== undefined && normalizeForGrouping(value).includes(needle),
    );

  /** The table: the record's songs, narrowed by the panel's own filter,
   * ordered by a header when one was pressed, the search's finds lit. */
  const tableQuery = useMemo((): ILibraryListQuery | undefined => {
    if (record === undefined) {
      return undefined;
    }
    return {
      shelf: 'tracks',
      scope: record.scope,
      natural: record.natural,
      direction: sortDirection,
      ...(sort === undefined ? {} : { sort }),
      ...(filter.trim() === '' ? {} : { search: filter }),
      ...(isQueryTheContainer ? {} : { mark: query }),
    };
  }, [record, sort, sortDirection, filter, isQueryTheContainer, query]);
  const table = useLibraryList(tableQuery);

  /**
   * WITHIN A SEARCH, THE TREE IS THE WAY TO THE MATCHES: the folders inside
   * this one that hold a match, unless the folder standing here is itself
   * what was searched for — name the container and you get all of it.
   */
  const childrenQuery = useMemo((): ILibraryListQuery | undefined => {
    if (!folderPath) {
      return undefined;
    }
    return {
      shelf: 'children',
      scope: {},
      parent: folderPath,
      direction: sortDirection,
      ...(sort === undefined ? {} : { sort }),
      ...(isQueryTheContainer ? {} : { search: query }),
    };
  }, [folderPath, sort, sortDirection, isQueryTheContainer, query]);
  const children = useLibraryList(childrenQuery);

  /**
   * For a folder, its own files unfiltered: a folder with none is a way
   * through to what is under it, not a record. For anything else, the
   * folders its songs are in: one, and it is named under the title; more,
   * and no line at all — a path that is wrong for most of the table is worse
   * than none. A playlist has no folder of its own to name.
   */
  const placeQuery = useMemo((): ILibraryListQuery | undefined => {
    if (folderPath) {
      return {
        shelf: 'tracks',
        scope: { folder: folderPath },
        natural: 'path',
        direction: 'asc',
      };
    }
    if (albumId) {
      return { shelf: 'folders', scope: { album: albumId }, direction: 'asc' };
    }
    if (artistId) {
      return {
        shelf: 'folders',
        scope: { artist: artistId },
        direction: 'asc',
      };
    }
    if (genreId) {
      return { shelf: 'folders', scope: { genre: genreId }, direction: 'asc' };
    }
    return undefined;
  }, [albumId, artistId, genreId, folderPath]);
  const place = useLibraryList(placeQuery);

  /**
   * A record that is gone — a rescan dropped the folder, the root was
   * removed while it was open — closes the panel rather than settling on
   * "Unknown album" and a Play button that does nothing. An empty playlist
   * is not gone: Favourites starts empty. A folder is gone when nothing at
   * all is beneath it.
   */
  const isOrphaned =
    (Boolean(playlistId) && !playlist) ||
    (!playlistId && summary.isLoaded && summary.count === 0);
  useEffect(() => {
    if (isOrphaned) {
      onBack();
    }
  }, [isOrphaned, onBack]);

  if (isOrphaned) {
    return null;
  }

  const isAlbum = Boolean(albumId);
  const isFolder = Boolean(folderPath);
  const isGenre = Boolean(genreId);
  const isPlaylist = Boolean(playlistId);
  /**
   * A FOLDER WITH NOTHING BUT FOLDERS IN IT IS A WAY THROUGH, NOT A RECORD:
   * no sleeve, no Play, no empty table — the panel is the way in to the
   * folders under it, and the moment it holds files of its own, its own
   * record appears.
   */
  const isWayThrough =
    isFolder && place.isLoaded && place.count === 0 && children.count > 0;
  const folderName = folderPath ? folderDisplayName(folderPath) : '';

  let title = artist?.name || t('library.unknownArtist');
  if (isAlbum) {
    title = album?.title || t('library.unknownAlbum');
  } else if (isFolder) {
    title = folderName;
  } else if (isGenre) {
    title =
      genreId === UNKNOWN_GENRE_ID
        ? t('library.genre.unknown')
        : (genre?.name ?? '');
  } else if (isPlaylist) {
    title =
      playlistId === FAVORITES_PLAYLIST_ID
        ? t('library.playlist.favorites')
        : (playlist?.name ?? '');
  }

  // The songs a playlist holds that the library cannot see right now — an
  // unplugged drive — said rather than shown as a playlist that shrank. They
  // stay in the playlist: a list that pruned itself whenever a drive was out
  // would empty over a few weeks with nothing ever having gone wrong.
  const missingCount =
    playlist && summary.isLoaded ? playlist.trackIds.length - summary.count : 0;
  let subtitle = '';
  if (isAlbum) {
    subtitle = album?.artist || t('library.unknownArtist');
  } else if (isFolder) {
    // The whole path: "CD1" alone says nothing about which CD1.
    subtitle = folderPath ?? '';
  } else if (isPlaylist && missingCount > 0) {
    subtitle = t('library.playlist.missing', { count: missingCount });
  }

  let counts = t('library.trackCount', { count: table.count });
  if (artist) {
    counts = `${t('library.albumCount', { count: artist.albumCount })} · ${t(
      'library.trackCount',
      { count: artist.trackCount },
    )}`;
  } else if (genre) {
    // A genre's pair is how many bands and how many songs: forty records say
    // nothing about how varied it is, twenty artists say exactly that.
    counts = `${t('library.artistCount', { count: genre.artistCount })} · ${t(
      'library.trackCount',
      { count: genre.trackCount },
    )}`;
  } else if (playlist) {
    // What the playlist holds, the songs out of sight included.
    counts = t(
      playlist.trackIds.length === 1
        ? 'library.playlist.songCountOne'
        : 'library.playlist.songCount',
      { count: playlist.trackIds.length },
    );
  } else if (isFolder && children.count > 0) {
    // A folder with subfolders counts what is under it: "0 songs" over five
    // hundred one level down is the kind of true that reads as broken.
    counts = t('library.trackCount', { count: summary.count });
  }

  const firstTableTrack = table.at(0);
  const firstSong =
    firstTableTrack?.kind === 'track' ? firstTableTrack.track : undefined;
  const firstBeneath: TLibraryListItem | undefined = summary.at(0);
  /** The header's picture. Inside a directory this is whatever cover was
   * found first beneath it, drawn inside a folder rather than as one. */
  const headerArtId =
    album?.artId ??
    artist?.artId ??
    genre?.artId ??
    firstSong?.artId ??
    (firstBeneath?.kind === 'track' ? firstBeneath.track.artId : undefined);

  const placeItem = place.at(0);
  const recordFolder =
    !isFolder &&
    !isPlaylist &&
    place.count === 1 &&
    placeItem?.kind === 'folder'
      ? placeItem.id
      : undefined;

  const hasTracks =
    table.count > 0 || (filter.trim() !== '' && summary.count > 0);

  /** THE FIRST ROW OF THE TABLE UNDER IT, not the first of the record: with
   * a filter typed or a column pressed the two differ, and Play then ignored
   * the screen it is on. */
  const handlePlay = () => {
    if (firstSong) {
      onPlayTrack(firstSong.id);
    }
  };

  /** Every id in the table, in its order — for the queue and the menu. */
  const loadTrackIds = (): Promise<readonly string[]> =>
    tableQuery === undefined
      ? Promise.resolve([])
      : window.electron.ipcRenderer.queryLibrary({
          type: 'ids',
          query: tableQuery,
          offset: 0,
          limit: Math.max(table.count, 1),
        });

  const editablePlaylist =
    playlist && !playlist.isBuiltIn
      ? {
          id: playlist.id,
          name: playlist.name,
          rename: (name: string) => renamePlaylist(playlist.id, name),
          remove: () => deletePlaylist(playlist.id),
        }
      : undefined;

  // The panel's own filter is not part of it: narrowing the table as the
  // reader types is the same table, and its place should hold.
  const tableKey = `detail|${albumId ?? artistId ?? genreId ?? playlistId ?? folderPath ?? ''}|${sort ?? ''}|${sortDirection}`;
  const childrenKey = `children|${folderPath ?? ''}|${sort ?? ''}|${sortDirection}`;

  return (
    <div className="library-detail">
      {/* No Back of its own: the place bar over every view is the one way
          out (`LibraryPlaceBar`). `onBack` is still how this panel closes
          itself — an orphan, a deleted playlist. */}
      {!isWayThrough && (
        <LibraryDetailHeader
          title={title}
          subtitle={subtitle}
          recordFolder={recordFolder}
          counts={counts}
          matchedCount={table.markedCount}
          isFolder={isFolder}
          artId={headerArtId}
          hasTracks={hasTracks}
          onPlay={handlePlay}
          loadTrackIds={loadTrackIds}
          onlyTrack={table.count === 1 ? firstSong : undefined}
          onQueueTracks={onQueueTracks}
          openPlaylistId={playlistId}
          editablePlaylist={editablePlaylist}
          onBack={onBack}
          filter={filter}
          onFilter={setFilter}
        />
      )}
      {/* What is inside this folder, above what is loose in it, drawn by the
          same two views the panel uses, so a choice of list or grid holds all
          the way down the tree. */}
      {children.count > 0 && onOpenFolder && (
        <div
          className={`library-detail__children${isWayThrough ? ' is-only' : ''}`}
        >
          {viewMode === 'grid' ? (
            <LibraryGridView
              list={children}
              browseMode="folder"
              folderParent={folderPath}
              onOpenAlbum={() => undefined}
              onOpenArtist={() => undefined}
              onOpenFolder={onOpenFolder}
              onPlayTrack={onPlayTrack}
              onRestartTrack={onRestartTrack}
              offlineRootIds={offlineRootIds}
              resetKey={childrenKey}
            />
          ) : (
            <LibraryListView
              list={children}
              browseMode="folder"
              folderParent={folderPath}
              onOpenAlbum={() => undefined}
              onOpenArtist={() => undefined}
              onOpenFolder={onOpenFolder}
              onPlayTrack={onPlayTrack}
              onRestartTrack={onRestartTrack}
              offlineRootIds={offlineRootIds}
              sort={sort}
              sortDirection={sortDirection}
              onSort={handleSort}
              resetKey={childrenKey}
            />
          )}
        </div>
      )}
      {/* A playlist nobody has put anything in yet, and how to: this says
          "this is new", where five empty column headers say "broken". */}
      {isPlaylist && playlist?.trackIds.length === 0 && (
        <div className="library-detail__empty" role="status">
          <p>{t('library.playlist.empty')}</p>
          <p className="library-detail__empty-hint">
            {t('library.playlist.emptyHint')}
          </p>
        </div>
      )}
      {/* And no table where there is nothing in this record to put in one. */}
      {!isWayThrough &&
        !(isPlaylist && playlist?.trackIds.length === 0) &&
        (viewMode === 'grid' ? (
          <LibraryGridView
            list={table}
            browseMode="song"
            onOpenAlbum={() => undefined}
            onOpenArtist={() => undefined}
            onPlayTrack={onPlayTrack}
            onRestartTrack={onRestartTrack}
            offlineRootIds={offlineRootIds}
            playingItemId={playingTrackId}
            revealTrack={revealTrack}
            resetKey={tableKey}
          />
        ) : (
          <LibraryListView
            list={table}
            browseMode="song"
            onOpenAlbum={() => undefined}
            onOpenArtist={() => undefined}
            onPlayTrack={onPlayTrack}
            onRestartTrack={onRestartTrack}
            offlineRootIds={offlineRootIds}
            playingTrackId={playingTrackId}
            revealTrack={revealTrack}
            // "Remove from this playlist" in each row's menu, and only here.
            openPlaylistId={playlistId}
            onQueueTracks={onQueueTracks}
            sort={sort}
            sortDirection={sortDirection}
            onSort={handleSort}
            resetKey={tableKey}
          />
        ))}
    </div>
  );
};

export default LibraryDetail;
