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
  KeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  groupIntoAlbums,
  groupIntoArtists,
} from '../../common/library/grouping';
import {
  ILibraryTrack,
  TLibraryBrowseMode,
  TLibrarySort,
  TLibrarySortDirection,
} from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import MenuIcon from '../icons/MenuIcon';
import LibraryCoverArt from './LibraryCoverArt';
import LibraryTrackRow from './LibraryTrackRow';

interface ILibraryListViewProps {
  tracks: readonly ILibraryTrack[];
  browseMode: TLibraryBrowseMode;
  onOpenAlbum: (albumId: string) => void;
  onOpenArtist: (artistId: string) => void;
  onPlayTrack: (trackId: string) => void;
  /** Root ids currently marked `isOffline` — spec §10: kept, never deleted,
   * and dimmed. Optional, matching `NowPlayingBar`'s own `volume` prop: real
   * usage always supplies it (`LibraryWorkspace` derives it from `index.roots`),
   * and no test of this view's other behaviours needs a real one to exercise
   * them. */
  offlineRootIds?: ReadonlySet<string>;
  /** The active sort, so a header can show which column is driving the order
   * and which way. Optional with `onSort`: without a handler the headers stay
   * plain labels, which is what the album and artist branches want. */
  sort?: TLibrarySort;
  sortDirection?: TLibrarySortDirection;
  /** Asked for a column. The workspace decides whether that means a new
   * column or a reversal of the current one — this view only reports the
   * press. */
  onSort?: (key: TLibrarySort) => void;
  /** Rows that share the open album's folder without belonging to the album.
   * Listed in the same run rather than a table of their own, tagged so the
   * distinction is visible without splitting the screen in two. */
  folderOnlyIds?: ReadonlySet<string>;
  /** Break the song list into a heading per folder. Off by default: a library
   * browsed by album has no use for it, and a folder heading above every row
   * would be noise rather than structure. */
  groupByFolder?: boolean;
  /** Changes when the list means something different — a new browse mode,
   * search or sort — and only then. Scroll position and how far the list has
   * been paged reset on this and nothing else; the `tracks` array itself is
   * replaced on every scan batch and is not a signal that the user is now
   * looking at a different list. */
  resetKey?: string;
}

const NO_OFFLINE_ROOTS: ReadonlySet<string> = new Set();
const NO_FOLDER_ONLY: ReadonlySet<string> = new Set();

/** The directory a file sits in, by name alone — the whole path would be a
 * heading nobody can read. Splits on both separators: a path arrives as
 * Windows text but nothing guarantees every one was written with a backslash. */
const folderLabel = (filePath: string): string => {
  const normalised = filePath.replace(/\\/g, '/');
  const parts = normalised.split('/').filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 2] : normalised;
};

/** The five column headers this view ever shows, keyed by the existing
 * `library.column.*` translation each draws from — never a computed key,
 * which `Translate`'s literal `TranslationKey` union would reject anyway. */
const COLUMN_LABEL_KEYS = {
  title: 'library.column.title',
  artist: 'library.column.artist',
  album: 'library.column.album',
  year: 'library.column.year',
  length: 'library.column.length',
} as const;

type TListColumn = keyof typeof COLUMN_LABEL_KEYS;

/**
 * `m:ss`. Minutes are never padded and never capped at 60 — an album total
 * can run well past an hour and reads naturally as `62:04`, not `1:02:04`.
 * Anything that is not a real, non-negative duration (an unread tag,
 * `NaN`) draws blank rather than `NaN:NaN`.
 */
const formatDuration = (durationMs: number | undefined): string => {
  if (
    durationMs === undefined ||
    !Number.isFinite(durationMs) ||
    durationMs < 0
  ) {
    return '';
  }
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * A dense, sortable row-per-entry list — the first view that shows what is
 * actually in the library.
 *
 * `browseMode` chooses WHAT is listed, not HOW a row is drawn: for `'song'`
 * the rows are tracks, already searched and sorted by the caller; for
 * `'album'`/`'artist'` they are `groupIntoAlbums`/`groupIntoArtists` grouped
 * from those same tracks, and a click opens the drill-in rather than playing
 * anything. A later task widens `TLibraryBrowseMode` with `'video'` — the
 * workspace routes that value elsewhere and never hands it to this
 * component, so any value that is not `'album'` or `'artist'` is treated as
 * `'song'` here.
 *
 * The list grows rather than windowing — see `PAGE_SIZE`.
 */

/**
 * How many rows are on screen to begin with, and how many more arrive each
 * time the bottom comes into reach.
 *
 * This replaced a fixed window with spacers standing in for the rows above and
 * below. That version was correct on paper and wrong in the hand: the spacer
 * heights come from an assumed row height, every real row that disagreed with
 * it by a pixel moved the scrollbar under the thumb, and dragging the bar
 * quickly outran React and showed blank bands. A list that only ever grows has
 * no spacers to be wrong about — what is rendered is what is there, so the
 * scrollbar cannot lie and nothing can jump.
 *
 * The cost is that scrolling to the end of fourteen thousand tracks eventually
 * mounts all of them. That is the right trade for a list nobody scrolls to the
 * end of: the first paint is a hundred rows either way, and the memory only
 * grows for someone who actually asked to see that far.
 */
const PAGE_SIZE = 100;
/** How close to the bottom, in pixels, counts as asking for the next page.
 * Roughly two rows: far enough to load before the user arrives, near enough
 * that it is their scroll doing the asking rather than a stray wheel tick. */
const NEXT_PAGE_THRESHOLD_PX = 96;

/** What a screen reader is told about a column: only the one actually driving
 * the order claims a direction. */
const activeSortLabel = (
  isActive: boolean,
  direction: TLibrarySortDirection | undefined,
): 'ascending' | 'descending' | 'none' => {
  if (!isActive) {
    return 'none';
  }
  return direction === 'desc' ? 'descending' : 'ascending';
};

const LibraryListView = ({
  tracks,
  browseMode,
  onOpenAlbum,
  onOpenArtist,
  onPlayTrack,
  offlineRootIds = NO_OFFLINE_ROOTS,
  sort,
  sortDirection,
  onSort,
  folderOnlyIds = NO_FOLDER_ONLY,
  groupByFolder = false,
  resetKey = '',
}: ILibraryListViewProps) => {
  const { t } = useTranslation();
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [shownCount, setShownCount] = useState(PAGE_SIZE);

  // A genuinely different list starts at the top, showing one page again:
  // keeping the old offset after a search or a sort would land the user in
  // the middle of results they have not seen.
  //
  // Keyed on what the list MEANS, never on the `tracks` array itself. That
  // array gets a new identity on every scan batch — the index is re-sent
  // whole and re-sorted — so keying on it snapped the scroll back to the top
  // and shrank the list to one page several times a second for the whole of
  // a scan. Scrolling down simply undid itself.
  useEffect(() => {
    setShownCount(PAGE_SIZE);
    // `scrollTop` rather than `scrollTo`, which jsdom does not implement —
    // and which would need mocking in every test that renders this view.
    const element = bodyRef.current;
    if (element) {
      element.scrollTop = 0;
    }
  }, [resetKey]);
  // The row a right click or a keyboard context-menu request landed on, and
  // the element the menu hangs off — the row itself, since a context menu
  // has no persistent trigger button the way `AnchoredMenu`'s other users
  // do.
  const [trackMenu, setTrackMenu] = useState<
    { trackId: string; anchor: HTMLElement } | undefined
  >(undefined);

  // Closes on a click elsewhere and on Escape, same pattern as every other
  // menu built on `AnchoredMenu` — see `LibraryFolderActions` and
  // `MainContent.tsx`'s `eq-mode__menu` for why the portalled menu has to be
  // asked about separately from the trigger.
  useEffect(() => {
    if (!trackMenu) {
      return undefined;
    }
    const onPointerDown = (event: globalThis.MouseEvent) => {
      if (!isInsideAnchoredMenu(event.target)) {
        setTrackMenu(undefined);
      }
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTrackMenu(undefined);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [trackMenu]);

  /** Shared by the right-click handler and the keyboard one below — both
   * just need an element to anchor the menu to and the row's track id. */
  // Stable, like the row's other callbacks: a fresh identity here would make
  // every memoised row re-render on any state change this view has.
  const openTrackMenu = useCallback((anchor: HTMLElement, trackId: string) => {
    setTrackMenu({ trackId, anchor });
  }, []);

  const reveal = (trackId: string) => {
    window.electron.ipcRenderer
      .revealLibraryTrack(trackId)
      .catch(() => undefined);
    setTrackMenu(undefined);
  };

  /** Enter mirrors the row's primary action — double click for a track,
   * single click for an album or artist — so the list is fully driveable
   * without a mouse. */
  const onActivateKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    activate: () => void,
  ) => {
    if (event.key === 'Enter') {
      activate();
    }
  };

  /** A track row's own key handler: Enter plays it, and the two Windows
   * conventions for "open the context menu here" — the dedicated Context
   * Menu key and Shift+F10 — open the same menu a right click does.
   * Without this, "Show in Explorer" would be the one action in this view a
   * keyboard user could never reach at all. */
  const onTrackRowKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>, track: ILibraryTrack) => {
      if (event.key === 'Enter') {
        onPlayTrack(track.id);
        return;
      }
      if (
        event.key === 'ContextMenu' ||
        (event.shiftKey && event.key === 'F10')
      ) {
        event.preventDefault();
        setTrackMenu({ trackId: track.id, anchor: event.currentTarget });
      }
    },
    [onPlayTrack],
  );

  const columnHeader = (column: TListColumn) => t(COLUMN_LABEL_KEYS[column]);

  /**
   * A sortable header cell, for the branches whose rows are tracks.
   *
   * Album and artist rows are groupings rather than tracks, and `sortTracks`
   * has nothing to say about them — sorting those by "length" would mean
   * something different again. So only the song branch gets these; the other
   * two keep plain labels rather than offering a control that would lie.
   */
  const sortableHeader = (column: TListColumn, key: TLibrarySort) => {
    const isActive = onSort !== undefined && sort === key;
    return (
      <span
        role="columnheader"
        aria-sort={activeSortLabel(isActive, sortDirection)}
        className={`library-list__col${
          column === 'length' ? ' library-list__col--length' : ''
        }`}
      >
        {onSort ? (
          <button
            type="button"
            className={`library-list__sort${isActive ? ' is-active' : ''}`}
            onClick={() => onSort(key)}
          >
            {columnHeader(column)}
            <span className="library-list__sort-arrow" aria-hidden="true">
              {isActive && sortDirection === 'desc' ? '▾' : '▴'}
            </span>
          </button>
        ) : (
          columnHeader(column)
        )}
      </span>
    );
  };

  /** The `role="table"` shell every branch below shares: the leading,
   * unlabelled art column, the header row, the rowgroup, and — for the
   * track branch only — the context menu portalled beside it. Pulled out
   * once the three branches turned out to repeat this exact wrapper rather
   * than differ in it; what differs is only the header cells and the rows
   * themselves, both still supplied by the branch that knows what it is
   * listing. */
  const renderTable = (
    headerCells: ReactNode,
    rows: ReactNode[],
    menu?: ReactNode,
  ) => {
    // A page at a time, growing as the bottom comes into reach. Nothing
    // stands in for what is not rendered, which is the point: the scrollbar
    // measures exactly the rows that exist, so it cannot disagree with them
    // and the thumb cannot move under the pointer.
    const total = rows.length;
    const shown = Math.min(total, shownCount);
    const remaining = total - shown;
    return (
      <div className="library-list" role="table" aria-label={t('tabs.library')}>
        <div className="library-list__header" role="row">
          <span
            className="library-list__col library-list__col--art"
            aria-hidden="true"
          />
          {headerCells}
        </div>
        <div
          className="library-list__body"
          role="rowgroup"
          ref={bodyRef}
          onScroll={(event) => {
            if (remaining <= 0) {
              return;
            }
            const element = event.currentTarget;
            const distanceToBottom =
              element.scrollHeight - element.scrollTop - element.clientHeight;
            if (distanceToBottom <= NEXT_PAGE_THRESHOLD_PX) {
              setShownCount((current) => current + PAGE_SIZE);
            }
          }}
        >
          {rows.slice(0, shown)}
          {remaining > 0 && (
            <div className="library-list__more" role="row">
              <span role="cell">
                {t('library.trackCount', { count: remaining })}
              </span>
            </div>
          )}
        </div>
        {menu}
      </div>
    );
  };

  if (browseMode === 'album') {
    const albums = groupIntoAlbums(tracks);
    return renderTable(
      <>
        <span role="columnheader" className="library-list__col">
          {columnHeader('title')}
        </span>
        <span role="columnheader" className="library-list__col">
          {columnHeader('artist')}
        </span>
        <span role="columnheader" className="library-list__col">
          {columnHeader('year')}
        </span>
        <span
          role="columnheader"
          className="library-list__col library-list__col--length"
        >
          {columnHeader('length')}
        </span>
      </>,
      albums.map((album) => {
        const activate = () => onOpenAlbum(album.id);
        const title = album.title || t('library.unknownAlbum');
        return (
          <div
            key={album.id}
            role="row"
            tabIndex={0}
            className={`library-list__row${album.isPending ? ' library-list__row--pending' : ''}`}
            onClick={activate}
            onKeyDown={(event) => onActivateKeyDown(event, activate)}
          >
            <span
              role="cell"
              className="library-list__col library-list__col--art"
            >
              <LibraryCoverArt artId={album.artId} label={title} size="row" />
            </span>
            <span
              role="cell"
              className="library-list__col library-list__col--title"
            >
              <span className="library-list__title-text">
                <span className="library-list__title-label">{title}</span>
                {/* Every track this folder-derived album currently has is
                    still unread -- see `groupIntoAlbums`' own comment on why
                    one resolved member is enough to clear this. */}
                {album.isPending && (
                  <span
                    className="library-list__badge library-list__badge--pending"
                    title={t('library.pending')}
                  >
                    <MenuIcon
                      name="pending"
                      className="library-list__badge-icon"
                    />
                  </span>
                )}
              </span>
              <small className="library-list__subtitle">
                {t('library.trackCount', { count: album.trackIds.length })}
              </small>
            </span>
            <span role="cell" className="library-list__col">
              {album.artist || t('library.unknownArtist')}
            </span>
            <span role="cell" className="library-list__col">
              {album.year ?? ''}
            </span>
            <span
              role="cell"
              className="library-list__col library-list__col--length"
            >
              {formatDuration(album.durationMs)}
            </span>
          </div>
        );
      }),
    );
  }

  if (browseMode === 'artist') {
    const artists = groupIntoArtists(tracks);
    return renderTable(
      <span
        role="columnheader"
        className="library-list__col library-list__col--span"
      >
        {columnHeader('title')}
      </span>,
      artists.map((artist) => {
        const activate = () => onOpenArtist(artist.id);
        const name = artist.name || t('library.unknownArtist');
        return (
          <div
            key={artist.id}
            role="row"
            tabIndex={0}
            className={`library-list__row${artist.isPending ? ' library-list__row--pending' : ''}`}
            onClick={activate}
            onKeyDown={(event) => onActivateKeyDown(event, activate)}
          >
            <span
              role="cell"
              className="library-list__col library-list__col--art"
            >
              <LibraryCoverArt artId={artist.artId} label={name} size="row" />
            </span>
            <span
              role="cell"
              className="library-list__col library-list__col--title library-list__col--span"
            >
              <span className="library-list__title-text">
                <span className="library-list__title-label">{name}</span>
                {/* Same rule as the album row above: every track grouped
                    under this artist right now is still unread. */}
                {artist.isPending && (
                  <span
                    className="library-list__badge library-list__badge--pending"
                    title={t('library.pending')}
                  >
                    <MenuIcon
                      name="pending"
                      className="library-list__badge-icon"
                    />
                  </span>
                )}
              </span>
              <small className="library-list__subtitle">
                {`${t('library.albumCount', { count: artist.albumCount })} · ${t(
                  'library.trackCount',
                  { count: artist.trackCount },
                )}`}
              </small>
            </span>
          </div>
        );
      }),
    );
  }

  // 'song', and any browse mode this component does not know about yet — see
  // the doc comment above for why that fallback is deliberate.
  return renderTable(
    <>
      {sortableHeader('title', 'title')}
      {sortableHeader('artist', 'artist')}
      {sortableHeader('album', 'album')}
      {/* No `length` sort: `sortTracks` has no duration comparator, and the
          honest options are to add one or not offer the control. Left plain
          until a duration sort is actually wanted. */}
      <span
        role="columnheader"
        className="library-list__col library-list__col--length"
      >
        {columnHeader('length')}
      </span>
    </>,
    tracks.flatMap((track, trackIndex) => {
      // A heading whenever the folder changes, and only when asked for. The
      // list is already in whatever order the sort chose, so this labels runs
      // rather than reordering anything — turning it on while sorted by title
      // gives one heading per row, which is the honest answer to a question
      // that does not really make sense, not something to prevent.
      const folderHeading =
        groupByFolder &&
        (trackIndex === 0 ||
          folderLabel(tracks[trackIndex - 1].path) !==
            folderLabel(track.path)) ? (
          <div
            key={`folder-${track.id}`}
            role="row"
            className="library-list__folder-heading"
          >
            <span role="cell">
              <MenuIcon name="folder" className="library-list__badge-icon" />
              <span>{folderLabel(track.path)}</span>
            </span>
          </div>
        ) : undefined;
      const row = (
        <LibraryTrackRow
          key={track.id}
          track={track}
          isOffline={offlineRootIds.has(track.rootId)}
          isFolderOnly={folderOnlyIds.has(track.id)}
          duration={formatDuration(track.durationMs)}
          onPlay={onPlayTrack}
          onKeyDown={onTrackRowKeyDown}
          onContextMenu={openTrackMenu}
        />
      );
      return folderHeading ? [folderHeading, row] : [row];
    }),
    <AnchoredMenu
      anchor={trackMenu?.anchor ?? null}
      isOpen={Boolean(trackMenu)}
      className="library-list__menu"
      ariaLabel={t('library.reveal')}
    >
      <button
        type="button"
        onClick={() => {
          if (trackMenu) {
            reveal(trackMenu.trackId);
          }
        }}
      >
        <MenuIcon name="external" className="library-list__menu-icon" />
        <span>{t('library.reveal')}</span>
      </button>
    </AnchoredMenu>,
  );
};

export default LibraryListView;
