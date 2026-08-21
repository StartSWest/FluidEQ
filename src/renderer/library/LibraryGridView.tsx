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
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  albumKey,
  artistKey,
  groupIntoAlbums,
  groupIntoArtists,
  sortAlbums,
  sortArtists,
  sortFolders,
  trackFolderPath,
} from '../../common/library/grouping';
import {
  ILibraryTrack,
  TLibraryBrowseMode,
  TLibrarySort,
  TLibrarySortDirection,
} from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import LibraryCoverArt from './LibraryCoverArt';
import { useFolderEntries } from './useFolderEntries';

interface ILibraryGridViewProps {
  tracks: readonly ILibraryTrack[];
  browseMode: TLibraryBrowseMode;
  onOpenAlbum: (albumId: string) => void;
  onOpenArtist: (artistId: string) => void;
  /** Only the folder browse mode can call this — optional for the same
   * reason `LibraryListView`'s own is. */
  onOpenFolder?: (folderPath: string) => void;
  onPlayTrack: (trackId: string) => void;
  /** Root ids currently marked `isOffline` — spec §10: kept, never deleted,
   * and dimmed. Optional for the same reason `LibraryListView`'s own prop of
   * the same name is: real usage always supplies it. */
  offlineRootIds?: ReadonlySet<string>;
  /** The library roots, for the Directories reading of the Folders shelf —
   * see `useFolderEntries`. Without them this shows every folder at once. */
  folderRoots?: readonly { path: string }[];
  /** Show what is inside this folder rather than the top of the tree. Set by
   * the drill-in, which is the only place a level below the roots is drawn. */
  folderParent?: string;
  /** The active order. Song tiles arrive already sorted — the workspace sorts
   * the track list itself — but albums and artists come out of their grouping
   * in whatever order the Map built them, so this view has to apply it. */
  sort?: TLibrarySort;
  sortDirection?: TLibrarySortDirection;
  /** Changes when the grid means something different — a new browse mode,
   * search or sort. How far the grid has been paged resets on this and
   * nothing else; `tracks` is replaced on every scan batch, which is not a
   * reason to throw away tiles the reader has already scrolled to. */
  resetKey?: string;
  /** The track the player is on, so a song tile can carry the same mark its
   * row does. */
  playingTrackId?: string;
  /** A tile to page to, scroll to and select, with a nonce so that asking
   * twice for the same one still moves the grid — `LibraryListView`'s prop of
   * the same name, and the same reasoning. */
  revealTrack?: { trackId: string; nonce: number };
}

const NO_OFFLINE_ROOTS: ReadonlySet<string> = new Set();
/** Stable, so the folder memo is not handed a new array every render. */
const NO_FOLDER_ROOTS: readonly { path: string }[] = [];

/** How far beyond the viewport stays mounted, each way, in viewports — the
 * list view's own constant, and everything its comment says applies here. */
const OVERSCAN_VIEWPORTS = 3;

/** Starting guesses only. Every one of them is measured off the real grid on
 * layout, because this one cannot assume even the column count: the columns
 * are `repeat(auto-fill, minmax(150px, 1fr))` and there is deliberately no
 * right number to hardcode. */
const TILE_HEIGHT = 196;
const TILE_COLUMNS = 6;
/** Tiles mounted before anything has been measured — a few rows' worth at any
 * plausible column count, so the first paint is never short. */
const FIRST_WINDOW_TILES = 60;

/** Where each grid was left and which tile was opened out of it, keyed by
 * what the grid was showing. Module-level for the reason `LibraryListView`'s
 * equivalent is: opening an album unmounts this view, so nothing held inside
 * the component survives to put the reader back where they were. Capped for
 * that one's reason too — the key holds the search text, so the box writes a
 * fresh one on every keystroke and the map would grow all session. */
const rememberedGridState = new Map<
  string,
  { scrollTop: number; activeId?: string }
>();

/** Grids whose place is worth keeping. Past this the least recently written
 * one goes. */
const REMEMBERED_GRIDS = 200;

/** Writes a place, and keeps the map from being a slow leak. Re-inserting
 * rather than assigning turns `Map`'s insertion order into a recency order,
 * so what is evicted is what nobody came back to. */
const rememberGrid = (
  key: string,
  value: { scrollTop: number; activeId?: string },
): void => {
  rememberedGridState.delete(key);
  rememberedGridState.set(key, value);
  if (rememberedGridState.size > REMEMBERED_GRIDS) {
    const oldest = rememberedGridState.keys().next();
    if (!oldest.done) {
      rememberedGridState.delete(oldest.value);
    }
  }
};

/** The most tiles this view will mount, whatever it is told about the pane —
 * `LibraryListView`'s `MAX_WINDOW_ROWS`, and its comment applies here word for
 * word. */
const MAX_WINDOW_TILES = 600;

/** What the grid actually laid out, all of it measured — see `metricsRef`. */
export interface IGridMetrics {
  tileHeight: number;
  rowGap: number;
  columns: number;
  padding: number;
}

/**
 * Which tiles belong on screen, from numbers alone. Whole rows only: half a
 * row leaves a ragged edge the reader reads as missing art.
 *
 * Pure, exported and tested for the reason `rowWindowFor` is — `paneHeight`
 * is a measurement and a measurement can be absurd. See that function for the
 * layout fault that made one absurd, and for why there are two ceilings here
 * rather than none.
 */
export const tileWindowFor = ({
  scrollTop,
  paneHeight,
  screenHeight,
  metrics,
  count,
}: {
  scrollTop: number;
  /** The grid's own `clientHeight`. Zero before it is laid out. */
  paneHeight: number;
  screenHeight: number;
  metrics: IGridMetrics;
  count: number;
}): { start: number; end: number } => {
  const { tileHeight, rowGap, columns, padding } = metrics;
  const pitch = tileHeight + rowGap;
  const rows = Math.ceil(count / columns);
  const viewport = Math.min(paneHeight || pitch * 3, screenHeight);
  const overscan = viewport * OVERSCAN_VIEWPORTS;
  const top = scrollTop - padding - overscan;
  const bottom = scrollTop - padding + viewport + overscan;
  const firstRow = Math.max(0, Math.min(Math.floor(top / pitch), rows));
  const lastRow = Math.max(firstRow, Math.min(Math.ceil(bottom / pitch), rows));
  const start = Math.min(firstRow * columns, count);
  return {
    start,
    end: Math.max(
      start,
      Math.min(lastRow * columns, count, start + MAX_WINDOW_TILES),
    ),
  };
};

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
  /** Only ever set for a song tile — an album or artist has no single root
   * of its own to dim by. */
  rootId?: string;
  /** A song tile: the track itself. An album or artist tile: true only
   * while every track currently grouped into it is still unread — see
   * `groupIntoAlbums`'/`groupIntoArtists`' own comments. */
  isPending: boolean;
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
  onOpenFolder,
  onPlayTrack,
  offlineRootIds = NO_OFFLINE_ROOTS,
  folderRoots = NO_FOLDER_ROOTS,
  folderParent,
  sort,
  sortDirection = 'asc',
  resetKey = '',
  playingTrackId,
  revealTrack,
}: ILibraryGridViewProps) => {
  const { t } = useTranslation();
  const gridRef = useRef<HTMLDivElement | null>(null);
  const isRestoringRef = useRef(false);
  const [activeId, setActiveId] = useState<string | undefined>(
    () => rememberedGridState.get(resetKey)?.activeId,
  );

  /** The half-open slice of tiles that is mounted; everything else is empty
   * space on the grid's own padding. Always whole rows of tiles — half a row
   * would leave a ragged edge the reader would read as missing art. */
  const [tileWindow, setTileWindow] = useState({
    start: 0,
    end: FIRST_WINDOW_TILES,
  });
  const tileWindowRef = useRef(tileWindow);
  tileWindowRef.current = tileWindow;
  /** How many tiles the memo below produced, written as it renders — the
   * scroll handler has no other way to learn it. */
  const tileCountRef = useRef(0);
  /**
   * What the grid actually laid out: a tile's height, the gap between rows,
   * how many columns `auto-fill` chose, and the padding the stylesheet puts
   * around the lot.
   *
   * All measured, none assumed. The column count especially: it comes from
   * the pane's width against a 150px minimum, and there is no one right
   * number to write down — which is exactly why the earlier attempt at a
   * window here was abandoned rather than made to guess.
   */
  const metricsRef = useRef<IGridMetrics>({
    tileHeight: TILE_HEIGHT,
    rowGap: 0,
    columns: TILE_COLUMNS,
    padding: 0,
  });

  /** Same contract as `LibraryListView`'s own `remember`, and written for the
   * same reason: recorded as the reader scrolls, never off an element that is
   * already being torn down. */
  const remember = useCallback(
    (element: HTMLDivElement) => {
      if (isRestoringRef.current) {
        return;
      }
      rememberGrid(resetKey, {
        scrollTop: element.scrollTop,
        activeId: rememberedGridState.get(resetKey)?.activeId,
      });
    },
    [resetKey],
  );

  /**
   * Which tiles belong on screen for where the grid is scrolled to now.
   *
   * Whole rows only, and pure arithmetic against the measured metrics — no
   * element is consulted, which is what lets the reveal jump straight to a
   * tile six thousand down without mounting the six thousand above it.
   */
  const windowFor = useCallback(
    (element: HTMLElement) =>
      tileWindowFor({
        scrollTop: element.scrollTop,
        paneHeight: element.clientHeight,
        screenHeight: window.innerHeight,
        metrics: metricsRef.current,
        count: tileCountRef.current,
      }),
    [],
  );

  /** Applies a window, and re-renders only when it is genuinely a different
   * one — see `LibraryListView`'s twin for why almost every scroll event ends
   * here having cost nothing. */
  const applyWindow = useCallback((next: { start: number; end: number }) => {
    const { current } = tileWindowRef;
    if (next.start === current.start && next.end === current.end) {
      return;
    }
    tileWindowRef.current = next;
    setTileWindow(next);
  }, []);

  const rememberActive = useCallback(
    (id: string) => {
      setActiveId(id);
      rememberGrid(resetKey, {
        scrollTop:
          gridRef.current?.scrollTop ??
          rememberedGridState.get(resetKey)?.scrollTop ??
          0,
        activeId: id,
      });
    },
    [resetKey],
  );

  // Back to where the reader left this grid, or to the top if they have not
  // been in it. Keyed on `resetKey` rather than on `items`, which gets a new
  // identity on every scan batch — resetting on that would yank them to the
  // top several times a second while a scan runs.
  //
  // One assignment, and it sticks: the grid reserves the full height of every
  // row of tiles from its first paint, so `scrollTop` is no longer clamped to
  // however far the grid happened to have been paged. That clamping is what
  // the old retry loop existed to outlast.
  useLayoutEffect(() => {
    const element = gridRef.current;
    const remembered = rememberedGridState.get(resetKey);
    if (!element) {
      return;
    }
    isRestoringRef.current = true;
    setActiveId(remembered?.activeId);
    element.scrollTop = remembered?.scrollTop ?? 0;
    applyWindow(windowFor(element));
    isRestoringRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  /**
   * What the grid really laid out, measured rather than assumed.
   *
   * `padding` is read from the *left* padding deliberately: the stylesheet
   * sets all four the same, and top and bottom are the two this view
   * overwrites to stand in for the tiles it has not mounted — so left is the
   * only one that still reports what the stylesheet asked for.
   */
  useLayoutEffect(() => {
    const element = gridRef.current;
    if (!element) {
      return undefined;
    }
    const measure = () => {
      const style = getComputedStyle(element);
      const columns = style.gridTemplateColumns
        .split(' ')
        .filter(Boolean).length;
      const tile = element.querySelector('.library-grid__tile');
      const tileHeight = tile?.getBoundingClientRect().height ?? 0;
      metricsRef.current = {
        tileHeight: tileHeight > 0 ? tileHeight : metricsRef.current.tileHeight,
        rowGap: parseFloat(style.rowGap) || 0,
        columns: columns > 0 ? columns : metricsRef.current.columns,
        padding: parseFloat(style.paddingLeft) || 0,
      };
      applyWindow(windowFor(element));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [applyWindow, windowFor]);

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
  // Which folders the shelf holds, under whichever reading is on.
  const folderEntries = useFolderEntries(tracks, folderRoots, folderParent);

  const items: IGridItem[] = useMemo(() => {
    if (browseMode === 'album') {
      const grouped = groupIntoAlbums(tracks);
      return (sort ? sortAlbums(grouped, sort, sortDirection) : grouped).map(
        (album) => ({
          id: album.id,
          artId: album.artId,
          title: album.title,
          artistName: album.artist,
          isPending: album.isPending,
        }),
      );
    }
    if (browseMode === 'folder') {
      return (
        sort ? sortFolders(folderEntries, sort, sortDirection) : folderEntries
      ).map((folder) => ({
        id: folder.id,
        artId: folder.artId,
        title: folder.name,
        // The path under the name — two folders called "CD1" are the normal
        // case and only their location tells them apart.
        artistName: folder.id,
        isPending: folder.isPending,
      }));
    }
    if (browseMode === 'artist') {
      const grouped = groupIntoArtists(tracks);
      return (sort ? sortArtists(grouped, sort, sortDirection) : grouped).map(
        (artist) => ({
          id: artist.id,
          artId: artist.artId,
          title: artist.name,
          artistName: '',
          albumCount: artist.albumCount,
          isPending: artist.isPending,
        }),
      );
    }
    // 'song', and any browse mode this view does not know about yet — the
    // same fallback `LibraryListView` makes: anything that is not 'album'
    // or 'artist' is treated as 'song'.
    return tracks.map((track) => ({
      id: track.id,
      artId: track.artId,
      title: track.title,
      artistName: track.artist ?? '',
      rootId: track.rootId,
      isPending: track.isPending === true,
    }));
  }, [tracks, browseMode, sort, sortDirection, folderEntries]);

  /** The same tiles, readable from the reveal without being one of its
   * dependencies — `items` gets a new identity on every scan batch, and a
   * reveal that re-ran for that would drag the grid back to the same tile
   * several times a second for the whole of a scan. */
  const itemsRef = useRef(items);
  itemsRef.current = items;

  /** The row's primary action, resolved from the always-current callback
   * props rather than baked into the memoised `items` above. */
  const openItem = (id: string) => {
    if (browseMode === 'album') {
      rememberActive(id);
      onOpenAlbum(id);
      return;
    }
    if (browseMode === 'artist') {
      rememberActive(id);
      onOpenArtist(id);
      return;
    }
    if (browseMode === 'folder') {
      rememberActive(id);
      onOpenFolder?.(id);
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

  /**
   * The tile the playing track belongs to.
   *
   * Keyed the way the tiles themselves are grouped — `albumKey` for an album
   * tile, `artistKey` for an artist one, the folder path for a folder, the
   * track's own id for a song — so a tile and its songs can never disagree
   * about which is playing. Same derivation `LibraryCoverFlow` makes for its
   * covers, and for the same reason: without it the grid gave no sign at all
   * of where the music was coming from.
   */
  const playingItemId = useMemo(() => {
    if (playingTrackId === undefined) {
      return undefined;
    }
    const playing = tracks.find((track) => track.id === playingTrackId);
    if (!playing) {
      return undefined;
    }
    if (browseMode === 'album') {
      return albumKey(playing);
    }
    if (browseMode === 'artist') {
      return artistKey(playing);
    }
    if (browseMode === 'folder') {
      return trackFolderPath(playing.path);
    }
    return playing.id;
  }, [tracks, playingTrackId, browseMode]);

  /**
   * Scroll to a tile and select it — the grid's half of `LibraryListView`'s
   * reveal, written the same way and for the same reason.
   *
   * Arithmetic, not a search: a tile's row is its index over the column
   * count, so this jumps straight to a tile six thousand down without putting
   * the six thousand above it in the document first. The version before the
   * window had to page down to it, wait for React, then find it — and when it
   * was not there yet it silently scrolled nowhere, which is exactly what was
   * measured on a 6660-tile grid: the right tile selected 133,743px down a
   * grid that had not moved.
   */
  const revealNonce = revealTrack?.nonce;
  const revealTrackId = revealTrack?.trackId;
  useEffect(() => {
    if (revealTrackId === undefined) {
      return;
    }
    const index = itemsRef.current.findIndex(
      (item) => item.id === revealTrackId,
    );
    if (index < 0) {
      return;
    }
    rememberActive(revealTrackId);
    const element = gridRef.current;
    if (!element) {
      return;
    }
    const { tileHeight, rowGap, columns, padding } = metricsRef.current;
    const row = Math.floor(index / columns);
    element.scrollTop = Math.max(
      0,
      padding +
        row * (tileHeight + rowGap) -
        (element.clientHeight - tileHeight) / 2,
    );
    applyWindow(windowFor(element));
    remember(element);
    // Keyed on the request, not on `items` — which gets a new identity on
    // every scan batch and would drag the grid back here several times a
    // second while one runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealTrackId, revealNonce]);

  // Written during render: the scroll handler and both layout effects need
  // the count and have no other way to learn it.
  tileCountRef.current = items.length;
  const { tileHeight, rowGap, columns } = metricsRef.current;
  const start = Math.min(tileWindow.start, items.length);
  const end = Math.min(Math.max(tileWindow.end, start), items.length);
  // The rows of tiles that are not mounted, as one empty block above and one
  // below. A row is a tile plus the gap that joins it to the next, which is
  // why the pitch and not the height alone — and a spacer brings a gap of its
  // own, which is the `- rowGap`: without it every one of them would push the
  // grid a further sixteen pixels out of step with its own scrollbar.
  const pitch = tileHeight + rowGap;
  const rowsAbove = Math.floor(start / columns);
  const rowsTotal = Math.ceil(items.length / columns);
  const rowsBelow = Math.max(0, rowsTotal - Math.ceil(end / columns));
  const spacer = (rows: number) => ({
    height: Math.max(0, rows * pitch - rowGap),
    // Full width, so it stands in for whole rows rather than being placed as
    // one more tile in the flow.
    gridColumn: '1 / -1',
  });

  return (
    <div
      className="library-grid"
      aria-label={t('tabs.library')}
      ref={gridRef}
      onScroll={(event) => {
        const element = event.currentTarget;
        applyWindow(windowFor(element));
        remember(element);
      }}
    >
      {rowsAbove > 0 && <div aria-hidden="true" style={spacer(rowsAbove)} />}
      {items.slice(start, end).map((item) => {
        const title = tileTitle(item);
        const subtitle = tileSubtitle(item);
        // Spec §10: a root missing at rescan is marked offline and its
        // tracks are "kept and dimmed — never deleted", not silently
        // unplayable. Only ever true for a song tile — `rootId` is unset
        // for an album or artist grouping.
        const isOffline = Boolean(
          item.rootId && offlineRootIds.has(item.rootId),
        );
        const isSelected = activeId === item.id;
        const isPlaying = playingItemId === item.id;
        const tileClassName = [
          'library-grid__tile',
          isOffline ? 'library-grid__tile--offline' : '',
          item.isPending ? 'library-grid__tile--pending' : '',
          isSelected ? 'library-grid__tile--selected' : '',
          isPlaying ? 'library-grid__tile--playing' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={item.id}
            type="button"
            data-tile-id={item.id}
            aria-current={isSelected ? 'true' : undefined}
            className={tileClassName}
            title={isOffline ? t('library.root.offline') : undefined}
            onClick={() => openItem(item.id)}
          >
            <span className="library-grid__art">
              <LibraryCoverArt artId={item.artId} label={title} size="tile" />
              {/* Same restraint as `LibraryListView`'s pending badge: this is
                  information, not a problem, so it gets the quiet mark
                  rather than the unplayable one's red. */}
              {item.isPending && (
                <span
                  className="library-grid__badge--pending"
                  title={t('library.pending')}
                >
                  <MenuIcon
                    name="pending"
                    className="library-list__badge-icon"
                  />
                </span>
              )}
            </span>
            <span className="library-grid__title">{title}</span>
            <small className="library-grid__subtitle">{subtitle}</small>
          </button>
        );
      })}
      {rowsBelow > 0 && <div aria-hidden="true" style={spacer(rowsBelow)} />}
    </div>
  );
};

export default LibraryGridView;
