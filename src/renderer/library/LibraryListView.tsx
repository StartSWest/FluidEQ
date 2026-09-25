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
  useMemo,
  useRef,
  useState,
} from 'react';
import { UNKNOWN_GENRE_ID } from '../../common/library/genres';
import { FAVORITES_PLAYLIST_ID } from '../../common/library/playlists';
import type {
  ILibraryTrack,
  TLibraryBrowseMode,
  TLibrarySort,
  TLibrarySortDirection,
} from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import MenuIcon from '../icons/MenuIcon';
import LibraryListGroupRow, {
  LibraryListPlaceholderRow,
} from './LibraryListGroupRow';
import { LibrarySectionRow } from './LibrarySectionHeading';
import LibraryTrackMenu from './LibraryTrackMenu';
import LibraryTrackRow from './LibraryTrackRow';
import { usePlaylists } from './PlaylistContext';
import { libraryRows } from './libraryRows';
import type { ILibraryList } from './useLibraryList';
import { useListWindow } from './useListWindow';
import usePlaylistCovers from './usePlaylistCovers';

interface ILibraryListViewProps {
  /**
   * What the table lists, a page at a time (`useLibraryList`). Every shelf
   * but Playlists, which are the listener's own and are read from
   * `usePlaylists`.
   */
  list?: ILibraryList;
  browseMode: TLibraryBrowseMode;
  onOpenAlbum: (albumId: string) => void;
  onOpenArtist: (artistId: string) => void;
  /** Only the Genres shelf can call it. */
  onOpenGenre?: (genreId: string) => void;
  /** Only the Folders shelf can call it. */
  onOpenFolder?: (folderPath: string) => void;
  /** Only the Playlists shelf can call it. */
  onOpenPlaylist?: (playlistId: string) => void;
  /** The playlist being read, when the rows below are one. Puts "Remove from
   * this playlist" in the row menu, and nothing else. */
  openPlaylistId?: string;
  /** Put a song after what is playing, from its own row menu. */
  onQueueTracks?: (trackIds: readonly string[]) => void;
  onPlayTrack: (trackId: string) => void;
  /** A row pressed twice in one double-press: the song starts again from the
   * top. Without it the second press plays the song again, which is what a
   * double-press did before it had a meaning of its own. */
  onRestartTrack?: (trackId: string) => void;
  /** Root ids currently marked `isOffline` — kept, never deleted, dimmed. */
  offlineRootIds?: ReadonlySet<string>;
  /** Inside the tree, where the reader walked in and knows where they are:
   * a folder row says how much is in it, not the path it shares with every
   * row beside it. */
  folderParent?: string;
  /** The active sort, so a header can say which column drives the order and
   * which way. Without `onSort` the headers stay plain labels. */
  sort?: TLibrarySort;
  sortDirection?: TLibrarySortDirection;
  /** Asked for a column. The workspace decides whether that means a new
   * column or a reversal — this view only reports the press. */
  onSort?: (key: TLibrarySort) => void;
  /** The song the player is on, so its row can say so. */
  playingTrackId?: string;
  /** Go to this row, scroll it into view and mark it. Carries a nonce because
   * asking twice for the same song has to work. */
  revealTrack?: { trackId: string; nonce: number };
  /** Changes when the table means something different — a new shelf, search
   * or sort — and only then. The rows change under a scan several times a
   * second, which is not a reason to lose the reader's place. */
  resetKey?: string;
}

const NO_OFFLINE_ROOTS: ReadonlySet<string> = new Set();

/** The column headers this view ever shows, keyed by the translation each
 * draws from — never a computed key. */
const COLUMN_LABEL_KEYS = {
  title: 'library.column.title',
  artist: 'library.column.artist',
  album: 'library.column.album',
  year: 'library.column.year',
  length: 'library.column.length',
  trackNo: 'library.column.trackNo',
} as const;

type TListColumn = keyof typeof COLUMN_LABEL_KEYS;

/**
 * `m:ss`. Minutes are never padded and never capped at 60 — an album total
 * can run well past an hour and reads naturally as `62:04`. Anything that is
 * not a real, non-negative duration draws blank rather than `NaN:NaN`.
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

/** What a screen reader is told about a column: only the one driving the
 * order claims a direction. */
const activeSortLabel = (
  isActive: boolean,
  direction: TLibrarySortDirection | undefined,
): 'ascending' | 'descending' | 'none' => {
  if (!isActive) {
    return 'none';
  }
  return direction === 'desc' ? 'descending' : 'ascending';
};

/** The directory a heading names, by its last segment alone — the whole
 * path would be a heading nobody can read. */
const folderLabel = (folder: string): string => {
  const parts = folder.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? folder;
};

/**
 * A dense, sortable row-per-entry table — songs, or the shelves you open
 * rather than play.
 *
 * `browseMode` chooses how a row is drawn; what the rows ARE comes from the
 * store, a page at a time, already grouped, searched and ordered
 * (`useLibraryList`). Only the rows near the viewport are ever in the
 * document (`useListWindow`), and only their pages are ever here.
 */
const LibraryListView = ({
  list,
  browseMode,
  onOpenAlbum,
  onOpenArtist,
  onOpenGenre,
  onOpenFolder,
  onOpenPlaylist,
  openPlaylistId,
  onQueueTracks,
  onPlayTrack,
  onRestartTrack,
  offlineRootIds = NO_OFFLINE_ROOTS,
  folderParent,
  sort,
  sortDirection,
  onSort,
  playingTrackId,
  revealTrack,
  resetKey = '',
}: ILibraryListViewProps) => {
  const { t } = useTranslation();
  const { playlists, isFavorite } = usePlaylists();
  const covers = usePlaylistCovers(browseMode === 'playlist' ? playlists : []);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const rows = useMemo(
    () => (list === undefined ? undefined : libraryRows(list)),
    [list],
  );
  const isPlaylists = browseMode === 'playlist';
  const count = isPlaylists ? playlists.length : (rows?.count ?? 0);

  /**
   * Rows lit for a menu to act on all at once.
   *
   * Deliberately NOT the active row, which marks the one the reader last
   * opened and has to survive a drill-in. This is a working set that lives as
   * long as the reader is looking at this table and no longer. Empty is the
   * ordinary state, and it means "whatever the pointer is on".
   */
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  /** Where a Shift range measures from — the last row taken on its own. */
  const selectionAnchorRef = useRef<string | undefined>(undefined);
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    selectionAnchorRef.current = undefined;
  }, []);

  const {
    start,
    end,
    rowHeight,
    activeId,
    setActiveId,
    rememberActive,
    onScroll,
    scrollToRow,
  } = useListWindow({ bodyRef, count, resetKey, onReset: clearSelection });

  // The pages under the rows on screen, asked for as the window moves.
  useEffect(() => {
    rows?.want(start, end);
  }, [rows, start, end]);

  /** Read by the reveal and the selection, which must not re-run for every
   * page that lands. */
  const listRef = useRef(list);
  listRef.current = list;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  /**
   * "Show me what is playing", the second half of it: the row, marked.
   *
   * Where the row is comes from the store when it is not among the pages
   * held — the song can be ten thousand rows down — and the scroll is then
   * arithmetic, so nothing above it is mounted first. Keyed on the nonce, so
   * asking twice for the same song works after the reader scrolled away.
   */
  const revealNonce = revealTrack?.nonce;
  const revealTrackId = revealTrack?.trackId;
  useEffect(() => {
    const { current } = listRef;
    if (revealTrackId === undefined || current?.query === undefined) {
      return undefined;
    }
    let isCurrent = true;
    const go = (index: number) => {
      const shown = rowsRef.current;
      if (!isCurrent || index < 0 || shown === undefined) {
        return;
      }
      setActiveId(revealTrackId);
      scrollToRow(shown.rowOf(index));
    };
    const held = current.indexOf(revealTrackId);
    if (held >= 0) {
      go(held);
      return undefined;
    }
    window.electron.ipcRenderer
      .queryLibrary({
        type: 'position',
        query: current.query,
        id: revealTrackId,
      })
      .then(go)
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
    // Keyed on the request: the list changes under a scan, and re-running
    // for that would drag the reader back to the row for the whole of it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealTrackId, revealNonce]);

  // The row a right click or a keyboard context-menu request landed on, and
  // the element the menu hangs off.
  const [trackMenu, setTrackMenu] = useState<
    { trackId: string; anchor: HTMLElement } | undefined
  >(undefined);

  // Closes on a click elsewhere and on Escape, the pattern every menu built on
  // `AnchoredMenu` follows.
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

  /**
   * Ctrl/Cmd-click and Shift-click, which are what build a selection.
   *
   * A plain click is left alone: a row is a thing you press to hear. Ctrl
   * adds or drops one row, Shift takes everything between the last single
   * pick and this one — asked of the store, because the rows between two
   * presses need not all be here. Returns true when it consumed the press,
   * the row's signal not to play the song as well.
   */
  const pickRow = useCallback(
    (trackId: string, modifiers: { toggle: boolean; range: boolean }) => {
      if (!modifiers.toggle && !modifiers.range) {
        // A plain press ends the selection: the reader is listening again.
        setSelectedIds((current) => (current.size === 0 ? current : new Set()));
        selectionAnchorRef.current = trackId;
        return false;
      }
      const { current } = listRef;
      const anchor = selectionAnchorRef.current;
      if (modifiers.range && anchor && current?.query !== undefined) {
        const from = current.indexOf(anchor);
        const to = current.indexOf(trackId);
        if (from !== -1 && to !== -1) {
          const [low, high] = from <= to ? [from, to] : [to, from];
          window.electron.ipcRenderer
            .queryLibrary({
              type: 'ids',
              query: current.query,
              offset: low,
              limit: high - low + 1,
            })
            .then((ids) => {
              setSelectedIds(new Set(ids));
              return undefined;
            })
            .catch(() => undefined);
          return true;
        }
      }
      setSelectedIds((selected) => {
        const next = new Set(selected);
        if (next.has(trackId)) {
          next.delete(trackId);
        } else {
          next.add(trackId);
        }
        return next;
      });
      selectionAnchorRef.current = trackId;
      return true;
    },
    [],
  );

  // Stable, like the row's other callbacks: a fresh identity here would make
  // every memoised row re-render on any state change this view has.
  const openTrackMenu = useCallback((anchor: HTMLElement, trackId: string) => {
    setTrackMenu({ trackId, anchor });
    // A menu on a row OUTSIDE the selection is the reader changing their mind:
    // the row under the pointer wins and the lit rows are dropped. Inside it,
    // the menu acts on all of it — the rule every file manager uses.
    setSelectedIds((current) =>
      current.has(trackId) ? current : new Set<string>(),
    );
  }, []);

  /**
   * What the open menu is about: the lit rows in the order the table has
   * them — a queue is built from this, and a selection added to it should
   * play down the page the way it reads — or the one row it opened on.
   */
  const menuSubject = useMemo(() => {
    if (!trackMenu) {
      return { trackIds: [] as string[], track: undefined };
    }
    if (selectedIds.has(trackMenu.trackId) && selectedIds.size > 1) {
      const place = (id: string) => {
        const at = list?.indexOf(id) ?? -1;
        return at === -1 ? Number.MAX_SAFE_INTEGER : at;
      };
      return {
        trackIds: Array.from(selectedIds).sort(
          (left, right) => place(left) - place(right),
        ),
        track: undefined,
      };
    }
    const at = list?.indexOf(trackMenu.trackId) ?? -1;
    const item = at === -1 ? undefined : list?.at(at);
    return {
      trackIds: [trackMenu.trackId],
      track: item?.kind === 'track' ? item.track : undefined,
    };
  }, [list, trackMenu, selectedIds]);

  const reveal = (trackId: string) => {
    window.electron.ipcRenderer
      .revealLibraryTrack(trackId)
      .catch(() => undefined);
    setTrackMenu(undefined);
  };

  /** Enter plays the row, and the two Windows conventions for "context menu
   * here" — the Context Menu key and Shift+F10 — open the menu a right click
   * does. Without it "Show in Explorer" would be the one action a keyboard
   * could never reach. */
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
   * The track-number header, inside the title cell because the number itself
   * is — see `LibraryTrackRow`. `aria-hidden`: the title cell is already the
   * `columnheader`, and its own `aria-sort` announces the order this sets.
   */
  const trackNoSort = () =>
    onSort ? (
      <button
        type="button"
        className={`library-list__sort library-list__sort--no${
          sort === 'track' ? ' is-active' : ''
        }`}
        onClick={() => onSort('track')}
        title={t(COLUMN_LABEL_KEYS.trackNo)}
        aria-hidden="true"
        tabIndex={-1}
      >
        #
      </button>
    ) : null;

  /** A sortable header cell. `length` stays plain everywhere: no order sorts
   * by duration, and a control that does nothing is worse than none. */
  const sortableHeader = (
    column: TListColumn,
    key: TLibrarySort,
    extraClass?: string,
    lead?: ReactNode,
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
        {lead}
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

  const lengthHeader = (
    <span
      role="columnheader"
      className="library-list__col library-list__col--length"
    >
      {columnHeader('length')}
    </span>
  );

  const headerCells = (): ReactNode => {
    if (browseMode === 'album') {
      return (
        <>
          {sortableHeader('title', 'title')}
          {sortableHeader('artist', 'artist')}
          {sortableHeader('year', 'year')}
          {lengthHeader}
        </>
      );
    }
    if (isPlaylists) {
      // A plain label: the playlists are in their own order — Favourites
      // first, then by name — and a header that could be pressed would be a
      // control that does nothing.
      return (
        <span
          role="columnheader"
          className="library-list__col library-list__col--span"
        >
          {columnHeader('title')}
        </span>
      );
    }
    if (
      browseMode === 'artist' ||
      browseMode === 'genre' ||
      browseMode === 'folder'
    ) {
      return sortableHeader('title', 'title', 'library-list__col--span');
    }
    return (
      <>
        {sortableHeader('title', 'title', undefined, trackNoSort())}
        {sortableHeader('artist', 'artist')}
        {sortableHeader('album', 'album')}
        {lengthHeader}
      </>
    );
  };

  const openGroup =
    (open: ((id: string) => void) | undefined) => (id: string) => {
      rememberActive(id);
      open?.(id);
    };

  const renderPlaylistRow = (at: number): ReactNode => {
    const playlist = playlists[at];
    if (!playlist) {
      return null;
    }
    const isBuiltIn = playlist.id === FAVORITES_PLAYLIST_ID;
    return (
      <LibraryListGroupRow
        key={playlist.id}
        id={playlist.id}
        title={isBuiltIn ? t('library.playlist.favorites') : playlist.name}
        subtitle={t(
          playlist.trackIds.length === 1
            ? 'library.playlist.songCountOne'
            : 'library.playlist.songCount',
          { count: playlist.trackIds.length },
        )}
        artId={covers.get(playlist.id)}
        isBuiltIn={isBuiltIn}
        isPending={false}
        isSelected={activeId === playlist.id}
        onOpen={openGroup(onOpenPlaylist)}
      />
    );
  };

  /** Keys by id, with a count for an id met again in the same window — a
   * playlist can hold one song twice. */
  const keysSeen = new Map<string, number>();
  const keyFor = (id: string) => {
    const seen = keysSeen.get(id) ?? 0;
    keysSeen.set(id, seen + 1);
    return seen === 0 ? id : `${id}#${seen}`;
  };

  const renderRow = (row: number): ReactNode => {
    const item = rows?.at(row);
    if (item === undefined) {
      return <LibraryListPlaceholderRow key={`pending-${row}`} />;
    }
    if (item.kind === 'section') {
      return (
        <LibrarySectionRow
          key={`section-${item.section}`}
          row={item}
          folderPath={list?.query?.near}
        />
      );
    }
    if (item.kind === 'heading') {
      return (
        <div
          key={`heading-${row}`}
          role="row"
          className="library-list__folder-heading"
        >
          <span role="cell">
            <MenuIcon name="folder" className="library-list__badge-icon" />
            <span>{folderLabel(item.folder)}</span>
          </span>
        </div>
      );
    }
    if (item.kind === 'track') {
      const { track } = item;
      return (
        <LibraryTrackRow
          key={keyFor(track.id)}
          track={track}
          isOffline={offlineRootIds.has(track.rootId)}
          isFolderOnly={item.folderOnly === true}
          isSearchMatch={item.matched === true}
          isSelected={activeId === track.id || selectedIds.has(track.id)}
          isPlaying={playingTrackId === track.id}
          isFavorite={isFavorite(track.id)}
          duration={formatDuration(track.durationMs)}
          onPlay={onPlayTrack}
          onRestart={onRestartTrack ?? onPlayTrack}
          onSelect={rememberActive}
          onPick={pickRow}
          onKeyDown={onTrackRowKeyDown}
          onContextMenu={openTrackMenu}
        />
      );
    }
    if (item.kind === 'album') {
      const title = item.title || t('library.unknownAlbum');
      return (
        <LibraryListGroupRow
          key={keyFor(item.id)}
          id={item.id}
          title={title}
          subtitle={t('library.trackCount', { count: item.trackCount })}
          artId={item.artId}
          isPending={item.isPending}
          isSelected={activeId === item.id}
          onOpen={openGroup(onOpenAlbum)}
          cells={
            <>
              <span role="cell" className="library-list__col">
                {item.artist || t('library.unknownArtist')}
              </span>
              <span role="cell" className="library-list__col">
                {item.year ?? ''}
              </span>
              <span
                role="cell"
                className="library-list__col library-list__col--length"
              >
                {formatDuration(item.durationMs)}
              </span>
            </>
          }
        />
      );
    }
    if (item.kind === 'artist') {
      return (
        <LibraryListGroupRow
          key={keyFor(item.id)}
          id={item.id}
          title={item.name || t('library.unknownArtist')}
          subtitle={`${t('library.albumCount', { count: item.albumCount })} · ${t(
            'library.trackCount',
            { count: item.trackCount },
          )}`}
          artId={item.artId}
          isPending={item.isPending}
          isSelected={activeId === item.id}
          onOpen={openGroup(onOpenArtist)}
        />
      );
    }
    if (item.kind === 'genre') {
      return (
        <LibraryListGroupRow
          key={keyFor(item.id)}
          id={item.id}
          // The one bucket with no tag behind it is named here, in a locale.
          title={
            item.id === UNKNOWN_GENRE_ID
              ? t('library.genre.unknown')
              : item.name
          }
          subtitle={`${t('library.artistCount', { count: item.artistCount })} · ${t(
            'library.trackCount',
            { count: item.trackCount },
          )}`}
          artId={item.artId}
          isPending={item.isPending}
          isSelected={activeId === item.id}
          onOpen={openGroup(onOpenGenre)}
        />
      );
    }
    // A folder. The path under the name: two folders called "CD1" are the
    // normal case, and only where they live tells them apart — except inside
    // the tree, where every row would carry the same path.
    return (
      <LibraryListGroupRow
        key={keyFor(item.id)}
        id={item.id}
        title={item.name}
        subtitle={
          folderParent === undefined
            ? `${t('library.trackCount', { count: item.trackCount })} · ${item.id}`
            : t('library.trackCount', { count: item.trackCount })
        }
        artId={item.artId}
        isFolder
        isPending={item.isPending}
        isSelected={activeId === item.id}
        onOpen={openGroup(onOpenFolder)}
      />
    );
  };

  const mounted: ReactNode[] = [];
  for (let row = start; row < end; row += 1) {
    mounted.push(isPlaylists ? renderPlaylistRow(row) : renderRow(row));
  }

  return (
    <div className="library-list" role="table" aria-label={t('tabs.library')}>
      <div className="library-list__header" role="row">
        <span
          className="library-list__col library-list__col--art"
          aria-hidden="true"
        />
        {headerCells()}
      </div>
      <div
        className="library-list__body"
        role="rowgroup"
        ref={bodyRef}
        onScroll={(event) => onScroll(event.currentTarget)}
      >
        {/* The rows that are not mounted, as two empty blocks standing in for
            them, which keeps the scrollbar measuring the whole table from the
            first paint. Blocks and not the body's padding: a flex item cannot
            shrink below its own padding, so six hundred thousand pixels of it
            pushed the body past its parent instead of scrolling inside it.
            `flexShrink: 0` because an empty flex item's automatic minimum is
            nothing, and the spacer would shrink away with the scrollbar.
            `aria-hidden`: a `rowgroup` may only contain rows. */}
        {start > 0 && (
          <div
            aria-hidden="true"
            style={{ height: start * rowHeight, flexShrink: 0 }}
          />
        )}
        {mounted}
        {end < count && (
          <div
            aria-hidden="true"
            style={{ height: (count - end) * rowHeight, flexShrink: 0 }}
          />
        )}
      </div>
      {!isPlaylists &&
        browseMode !== 'album' &&
        browseMode !== 'artist' &&
        browseMode !== 'genre' &&
        browseMode !== 'folder' && (
          <LibraryTrackMenu
            anchor={trackMenu?.anchor ?? null}
            isOpen={Boolean(trackMenu)}
            trackIds={menuSubject.trackIds}
            track={menuSubject.track}
            openPlaylistId={openPlaylistId}
            onQueueTracks={onQueueTracks}
            onReveal={reveal}
            onClose={() => setTrackMenu(undefined)}
          />
        )}
    </div>
  );
};

export default LibraryListView;
