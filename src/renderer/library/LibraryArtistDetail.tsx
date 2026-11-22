/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeForGrouping } from '../../common/library/grouping';
import type { ILibraryListQuery } from '../../common/library/query';
import type {
  TLibrarySort,
  TLibrarySortDirection,
  TLibraryViewMode,
} from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import LibraryArtistAlbums from './LibraryArtistAlbums';
import LibraryArtistHeading from './LibraryArtistHeading';
import LibraryArtistPicture from './LibraryArtistPicture';
import LibraryDetailHeader from './LibraryDetailHeader';
import LibraryGridView from './LibraryGridView';
import LibraryListView from './LibraryListView';
import { countText, formatLength } from './libraryFormat';
import { useLibraryRecordLinks } from './libraryRecordLinks';
import { useLibraryPlayerSessionIfAny } from './player/LibraryPlayerContext';
import { useLibraryAnswer } from './useLibraryAnswer';
import { useLibraryList } from './useLibraryList';

/** A name as grouping folds it, spaces gone: what a search is held to. */
const folded = (value: string): string =>
  normalizeForGrouping(value).replace(/ /g, '');

interface ILibraryArtistDetailProps {
  /** The artist, by `artistKeyOf`: an album artist or any name a song
   * credits. */
  artistId: string;
  /** How the page closes itself when nobody is credited any more. */
  onBack: () => void;
  onPlayTrack: (trackId: string) => void;
  onRestartTrack?: (trackId: string) => void;
  onQueueTracks?: (trackIds: readonly string[]) => void;
  offlineRootIds?: ReadonlySet<string>;
  /** The toolbar's view; Cover Flow lists the songs, as an album's page does. */
  viewMode?: TLibraryViewMode;
  playingTrackId?: string;
  revealTrack?: { trackId: string; nonce: number };
  /** The toolbar's search: lights the songs it names, unless it names the
   * artist, as `LibraryDetail` lights a record's. */
  query?: string;
}

/**
 * AN ARTIST'S PAGE (Ivan, 2026-11-22: "click on the artist and show more of
 * that artist"): the record page's header — their picture, their name, how
 * many records and songs and how long, Play, Shuffle and Add to up next for
 * all of it — then their records as a row of covers, then every song they
 * are on, their own and the ones they are a guest on, in the table every
 * shelf uses, sortable and filterable the same way.
 *
 * Everything is asked of the store for this one artist, a page at a time:
 * the head (`artist`), the records (`albumCredit`), the songs (`credit`).
 */
const LibraryArtistDetail = ({
  artistId,
  onBack,
  onPlayTrack,
  onRestartTrack,
  onQueueTracks,
  offlineRootIds,
  viewMode = 'list',
  playingTrackId,
  revealTrack,
  query = '',
}: ILibraryArtistDetailProps) => {
  const { t } = useTranslation();
  const links = useLibraryRecordLinks();
  /** The column the table is ordered by, or none: record by record, newest
   * first as the covers over it are, each as it was pressed. */
  const [sort, setSort] = useState<TLibrarySort | undefined>(undefined);
  const [sortDirection, setSortDirection] =
    useState<TLibrarySortDirection>('asc');
  /** Narrows this table and nothing else. */
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

  const facts = useLibraryAnswer({ type: 'artist', id: artistId });
  const name = facts?.name || t('library.unknownArtist');

  /** Newest first, as a discography reads; records with no year last. */
  const albumsQuery = useMemo(
    (): ILibraryListQuery => ({
      shelf: 'albums',
      scope: { albumCredit: artistId },
      sort: 'year',
      direction: 'desc',
    }),
    [artistId],
  );
  const albums = useLibraryList(albumsQuery);

  const needle = folded(query);
  const isQueryTheArtist =
    needle === '' || (facts ? folded(facts.name).includes(needle) : true);
  const tableQuery = useMemo(
    (): ILibraryListQuery => ({
      shelf: 'tracks',
      scope: { credit: artistId },
      natural: 'records',
      direction: sortDirection,
      ...(sort === undefined ? {} : { sort }),
      ...(filter.trim() === '' ? {} : { search: filter }),
      ...(isQueryTheArtist ? {} : { mark: query }),
    }),
    [artistId, sort, sortDirection, filter, isQueryTheArtist, query],
  );
  const table = useLibraryList(tableQuery);

  const playerSession = useLibraryPlayerSessionIfAny();
  const setShuffle = playerSession?.setShuffle;
  const isShuffled = playerSession?.isShuffled === true;

  // Nobody credited any more — a rescan took their last song — closes the
  // page rather than settling on an empty one.
  const isOrphaned = facts === null;
  useEffect(() => {
    if (isOrphaned) {
      onBack();
    }
  }, [isOrphaned, onBack]);

  /** The artist whose page has been drawn whole: a filter or a sort re-asks
   * the same artist's lists, and the page stays up through those. */
  const knownArtistRef = useRef<string | undefined>(undefined);
  if (isOrphaned) {
    return null;
  }
  // Nothing is drawn until the head, the records and the songs have all
  // answered, so the page never comes up as the last artist's and turns
  // into this one (`LibraryDetail` waits the same way).
  const isKnown = facts !== undefined && albums.isLoaded && table.isLoaded;
  if (isKnown) {
    knownArtistRef.current = artistId;
  } else if (knownArtistRef.current !== artistId) {
    return <div className="library-detail-pending" aria-busy="true" />;
  }

  const counts = facts
    ? [
        facts.albumCount > 0
          ? countText(t, 'library.albumCount', facts.albumCount)
          : '',
        countText(t, 'library.trackCount', facts.trackCount),
        facts.durationMs > 0 ? formatLength(facts.durationMs, t) : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  const firstItem = table.at(0);
  const firstSong = firstItem?.kind === 'track' ? firstItem.track : undefined;
  const hasTracks =
    table.count > 0 || (filter.trim() !== '' && (facts?.trackCount ?? 0) > 0);

  /** Every id in the table, in its order — for the queue and the menu. */
  const loadTrackIds = (): Promise<readonly string[]> =>
    window.electron.ipcRenderer.queryLibrary({
      type: 'ids',
      query: tableQuery,
      offset: 0,
      limit: Math.max(table.count, 1),
    });

  /** The first row of the table on screen, filtered and ordered as it is. */
  const handlePlay = () => {
    if (firstSong) {
      onPlayTrack(firstSong.id);
    }
  };

  /** A switch, as on a record's page: off, a song at random with shuffle
   * on; on, shuffle off and the song left playing. */
  const handleShuffle = () => {
    if (isShuffled) {
      setShuffle?.(false);
      return;
    }
    loadTrackIds()
      .then((ids) => {
        const pick = ids[Math.floor(Math.random() * ids.length)];
        if (pick !== undefined) {
          onPlayTrack(pick);
          setShuffle?.(true);
        }
        return undefined;
      })
      .catch(() => undefined);
  };

  // The panel's own filter is not part of it: narrowing the table as the
  // reader types is the same table, and its place should hold.
  const tableKey = `artist|${artistId}|${sort ?? ''}|${sortDirection}`;

  return (
    <div className="library-detail library-artist">
      <LibraryDetailHeader
        kind={t('library.kind.artist')}
        title={name}
        // Somebody with no record of their own is here for the songs they
        // are a guest on, and the line says so.
        subtitle={facts?.albumCount === 0 ? t('library.artist.guest') : ''}
        counts={counts}
        matchedCount={table.markedCount}
        isFolder={false}
        artId={facts?.artId}
        picture={
          <LibraryArtistPicture
            name={name}
            artId={facts?.artId}
            albums={albums}
          />
        }
        hasTracks={hasTracks}
        onPlay={handlePlay}
        onShuffle={setShuffle ? handleShuffle : undefined}
        isShuffled={isShuffled}
        loadTrackIds={loadTrackIds}
        onlyTrack={table.count === 1 ? firstSong : undefined}
        onQueueTracks={onQueueTracks}
        onBack={onBack}
        filter={filter}
        onFilter={setFilter}
        tagScope={{ scope: 'selection', title: name }}
      />
      {albums.count > 0 && (
        <>
          <LibraryArtistAlbums list={albums} onOpenAlbum={links?.openAlbum} />
          {/* Named as the records over it are, or a grid of songs under a
              row of records reads as one wall of covers. */}
          <LibraryArtistHeading
            icon="song"
            label={t('library.browse.song')}
            count={table.count}
          />
        </>
      )}
      {viewMode === 'grid' ? (
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
          onQueueTracks={onQueueTracks}
          sort={sort}
          sortDirection={sortDirection}
          onSort={handleSort}
          resetKey={tableKey}
        />
      )}
    </div>
  );
};

export default LibraryArtistDetail;
