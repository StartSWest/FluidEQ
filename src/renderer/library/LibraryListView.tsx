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
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  groupIntoAlbums,
  groupIntoArtists,
  groupIntoFolders,
  sortAlbums,
  sortArtists,
  sortFolders,
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
  /** Only the folder browse mode can ever call this, so it is optional the
   * same way the sort handler is: a caller that never shows folders has
   * nothing to supply. */
  onOpenFolder?: (folderPath: string) => void;
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

/**
 * Where each list was left, keyed by what that list was showing.
 *
 * Module-level and deliberately not React state: opening an album unmounts
 * this whole view — the drill-in replaces it rather than covering it — so
 * anything held inside the component is gone by the time the reader presses
 * Back. Keeping it here is what lets them return to the row they came from
 * instead of the top of a list they had scrolled a thousand rows into.
 *
 * Bounded by the number of distinct browse/search/sort combinations one
 * session produces, each entry two numbers — small enough that it is never
 * worth evicting from, and cleared with the window.
 */
const rememberedListState = new Map<
  string,
  { scrollTop: number; shownCount: number; activeId?: string }
>();

/** How many frames a restore keeps retrying before giving up. Generous: the
 * cost of one more assignment is nothing, and the cost of stopping a frame
 * too early is the reader losing their place. */
const RESTORE_ATTEMPTS = 20;

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
  onOpenFolder,
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
  const [shownCount, setShownCount] = useState(
    () => rememberedListState.get(resetKey)?.shownCount ?? PAGE_SIZE,
  );

  // Keep a ref in step with the count so the cleanup below saves what is on
  // screen now, not what was there when the effect was created.
  const shownCountRef = useRef(shownCount);
  shownCountRef.current = shownCount;

  /** True while the restore below is still assigning, so the scroll events
   * that assignment itself fires do not write the half-restored value back
   * over the one being restored. */
  const isRestoringRef = useRef(false);

  /**
   * Where the reader is, recorded as they go.
   *
   * Written on every scroll rather than once at unmount, which is what had
   * this returning to the top no matter how carefully the restore was
   * written: a cleanup reads `scrollTop` off an element that is already
   * being torn down, and any ancestor that has collapsed — `display: none`
   * on the workspace, a detached subtree, a parent that has lost its height
   * for one frame — has silently zeroed it first. Saving zero looks exactly
   * like never having scrolled. Recording it while the element is
   * demonstrably on screen and demonstrably scrolled cannot be wrong in that
   * way.
   */
  const remember = useCallback(
    (element: HTMLDivElement) => {
      if (isRestoringRef.current) {
        return;
      }
      rememberedListState.set(resetKey, {
        scrollTop: element.scrollTop,
        shownCount: shownCountRef.current,
        activeId: rememberedListState.get(resetKey)?.activeId,
      });
    },
    [resetKey],
  );

  /** Which row the reader last opened, so coming back out of the drill-in
   * shows them the one they went into rather than a list of identical rows
   * they have to find their place in again. Held here as well as in the map
   * because the map is what survives the unmount and this is what renders. */
  const [activeId, setActiveId] = useState<string | undefined>(
    () => rememberedListState.get(resetKey)?.activeId,
  );

  /** Records the row being opened before the view is torn down for the
   * drill-in — the scroll position alone puts the reader back on the right
   * screen, not back on the right row. */
  const rememberActive = useCallback(
    (id: string) => {
      setActiveId(id);
      const element = bodyRef.current;
      rememberedListState.set(resetKey, {
        scrollTop:
          element?.scrollTop ??
          rememberedListState.get(resetKey)?.scrollTop ??
          0,
        shownCount: shownCountRef.current,
        activeId: id,
      });
    },
    [resetKey],
  );

  /**
   * Back to where they left it, or to the top if they have not been here.
   *
   * One effect, because there is one decision. Two effects on the same key
   * fought over the scroll position and whichever ran last won.
   *
   * `useLayoutEffect`, not `useEffect`: opening an album unmounts this view
   * entirely — the drill-in replaces it rather than covering it — so coming
   * back is a fresh mount, and restoring after paint shows one frame of the
   * top of the list before it jumps. Keyed on what the list MEANS, never on
   * the `tracks` array, which gets a new identity on every scan batch and
   * would otherwise reset the reader's place several times a second for the
   * whole of a scan.
   */
  useLayoutEffect(() => {
    const element = bodyRef.current;
    const remembered = rememberedListState.get(resetKey);
    let frame = 0;
    if (!remembered) {
      setShownCount(PAGE_SIZE);
      setActiveId(undefined);
      if (element) {
        element.scrollTop = 0;
      }
      return undefined;
    }
    setShownCount(remembered.shownCount);
    setActiveId(remembered.activeId);
    // Assigning once is not enough. `scrollTop` is clamped to the content's
    // current height, and the page this restore needs has only just been
    // asked for — until React has rendered those rows the maximum is one
    // page tall and the assignment quietly becomes that instead. Retried on
    // following frames until the value survives being read back.
    //
    // `scrollTop` rather than `scrollTo`, which jsdom does not implement and
    // would need mocking in every test that renders this view.
    isRestoringRef.current = true;
    let attempts = 0;
    const restore = () => {
      frame = 0;
      if (!element) {
        isRestoringRef.current = false;
        return;
      }
      element.scrollTop = remembered.scrollTop;
      attempts += 1;
      if (
        Math.abs(element.scrollTop - remembered.scrollTop) > 1 &&
        attempts < RESTORE_ATTEMPTS
      ) {
        frame = requestAnimationFrame(restore);
        return;
      }
      isRestoringRef.current = false;
    };
    restore();
    return () => {
      isRestoringRef.current = false;
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
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
   * A sortable header cell.
   *
   * Every branch gets these now: `sortAlbums` and `sortArtists` answer for
   * groupings what `sortTracks` answers for tracks, so a header that offers
   * a column is a header that can deliver it. The one column still left
   * plain everywhere is `length` — no comparator sorts by duration yet, and
   * a control that does nothing is worse than no control.
   */
  const sortableHeader = (
    column: TListColumn,
    key: TLibrarySort,
    extraClass = '',
  ) => {
    const isActive = onSort !== undefined && sort === key;
    return (
      <span
        role="columnheader"
        aria-sort={activeSortLabel(isActive, sortDirection)}
        className={`library-list__col${
          column === 'length' ? ' library-list__col--length' : ''
        }${extraClass ? ` ${extraClass}` : ''}`}
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
            const element = event.currentTarget;
            if (remaining > 0) {
              const distanceToBottom =
                element.scrollHeight - element.scrollTop - element.clientHeight;
              if (distanceToBottom <= NEXT_PAGE_THRESHOLD_PX) {
                // The ref, not just the state: `remember` right below reads
                // it this same tick, and a `setShownCount` has not landed by
                // then — remembering the count from before the page was
                // added would restore a list too short to hold the position
                // remembered beside it.
                shownCountRef.current += PAGE_SIZE;
                setShownCount(shownCountRef.current);
              }
            }
            remember(element);
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
    const albums = sortAlbums(
      groupIntoAlbums(tracks),
      sort ?? 'title',
      sortDirection,
    );
    return renderTable(
      <>
        {sortableHeader('title', 'title')}
        {sortableHeader('artist', 'artist')}
        {sortableHeader('year', 'year')}
        <span
          role="columnheader"
          className="library-list__col library-list__col--length"
        >
          {columnHeader('length')}
        </span>
      </>,
      albums.map((album) => {
        const activate = () => {
          rememberActive(album.id);
          onOpenAlbum(album.id);
        };
        const title = album.title || t('library.unknownAlbum');
        const isSelected = activeId === album.id;
        return (
          <div
            key={album.id}
            role="row"
            tabIndex={0}
            aria-selected={isSelected}
            className={`library-list__row${album.isPending ? ' library-list__row--pending' : ''}${
              isSelected ? ' library-list__row--selected' : ''
            }`}
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

  if (browseMode === 'folder') {
    const folders = sortFolders(
      groupIntoFolders(tracks),
      sort ?? 'title',
      sortDirection,
    );
    return renderTable(
      sortableHeader('title', 'title', 'library-list__col--span'),
      folders.map((folder) => {
        const activate = () => {
          rememberActive(folder.id);
          onOpenFolder?.(folder.id);
        };
        const isSelected = activeId === folder.id;
        return (
          <div
            key={folder.id}
            role="row"
            tabIndex={0}
            aria-selected={isSelected}
            className={`library-list__row${folder.isPending ? ' library-list__row--pending' : ''}${
              isSelected ? ' library-list__row--selected' : ''
            }`}
            onClick={activate}
            onKeyDown={(event) => onActivateKeyDown(event, activate)}
          >
            <span
              role="cell"
              className="library-list__col library-list__col--art"
            >
              <LibraryCoverArt
                artId={folder.artId}
                label={folder.name}
                size="row"
              />
            </span>
            <span
              role="cell"
              className="library-list__col library-list__col--title library-list__col--span"
            >
              <span className="library-list__title-text">
                <span className="library-list__title-label">{folder.name}</span>
              </span>
              {/* The path, not the name again: two folders called "CD1" are
                  the normal case, and the only thing that tells them apart is
                  where they live. */}
              <small className="library-list__subtitle">
                {`${t('library.trackCount', { count: folder.trackCount })} · ${folder.id}`}
              </small>
            </span>
          </div>
        );
      }),
    );
  }

  if (browseMode === 'artist') {
    const artists = sortArtists(
      groupIntoArtists(tracks),
      sort ?? 'title',
      sortDirection,
    );
    return renderTable(
      sortableHeader('title', 'title', 'library-list__col--span'),
      artists.map((artist) => {
        const activate = () => {
          rememberActive(artist.id);
          onOpenArtist(artist.id);
        };
        const name = artist.name || t('library.unknownArtist');
        const isSelected = activeId === artist.id;
        return (
          <div
            key={artist.id}
            role="row"
            tabIndex={0}
            aria-selected={isSelected}
            className={`library-list__row${artist.isPending ? ' library-list__row--pending' : ''}${
              isSelected ? ' library-list__row--selected' : ''
            }`}
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
          isSelected={activeId === track.id}
          duration={formatDuration(track.durationMs)}
          onPlay={onPlayTrack}
          onSelect={rememberActive}
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
