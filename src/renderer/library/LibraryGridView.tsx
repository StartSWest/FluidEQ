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
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { UNKNOWN_GENRE_ID } from '../../common/library/genres';
import { FAVORITES_PLAYLIST_ID } from '../../common/library/playlists';
import type { TLibraryBrowseMode } from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import LibraryCoverArt from './LibraryCoverArt';
import LibraryFolderArt from './LibraryFolderArt';
import { LibrarySectionBand } from './LibrarySectionHeading';
import { usePlaylists } from './PlaylistContext';
import {
  GRID_BAND_HEIGHT,
  gridBlocksOf,
  gridRowTop,
  gridWindowFor,
  IGridMetrics,
  IGridWindow,
  TGridBlock,
} from './libraryGridLayout';
import { ILibraryRows, libraryRows, TLibraryRow } from './libraryRows';
import type { ILibraryList } from './useLibraryList';
import usePlaylistCovers from './usePlaylistCovers';

interface ILibraryGridViewProps {
  /** What the grid holds, a page at a time (`useLibraryList`). Every shelf
   * but Playlists, which are the listener's own. */
  list?: ILibraryList;
  browseMode: TLibraryBrowseMode;
  onOpenAlbum: (albumId: string) => void;
  onOpenArtist: (artistId: string) => void;
  onOpenGenre?: (genreId: string) => void;
  onOpenFolder?: (folderPath: string) => void;
  onOpenPlaylist?: (playlistId: string) => void;
  onPlayTrack: (trackId: string) => void;
  /** A song tile pressed twice in one double-press. See `LibraryListView`'s
   * own prop of the same name. */
  onRestartTrack?: (trackId: string) => void;
  /** Root ids currently marked `isOffline` — kept, never deleted, dimmed. */
  offlineRootIds?: ReadonlySet<string>;
  /** Inside the tree: a folder tile says how much is in it rather than the
   * path every tile beside it shares. */
  folderParent?: string;
  /** Changes when the grid means something different. Where it was left is
   * kept per key; the rows changing under a scan is not a new grid. */
  resetKey?: string;
  /** The tile the playing song belongs to — its album, artist, folder or the
   * song itself — so the grid says where the music is coming from. */
  playingItemId?: string;
  /** A tile to scroll to and select, with a nonce so that asking twice for
   * the same one still moves the grid. */
  revealTrack?: { trackId: string; nonce: number };
}

const NO_OFFLINE_ROOTS: ReadonlySet<string> = new Set();

/** Starting guesses only, every one measured off the real grid on layout:
 * the columns are `repeat(auto-fill, minmax(150px, 1fr))` and there is no
 * right number to hardcode. */
const TILE_HEIGHT = 196;
const TILE_COLUMNS = 6;

/** Where each grid was left, keyed by what it showed — module-level because
 * opening an album unmounts the grid, and capped because the key holds the
 * search text. */
const rememberedGridState = new Map<
  string,
  { scrollTop: number; activeId?: string }
>();
const REMEMBERED_GRIDS = 200;

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

/** One tile: the raw values, turned into words at render time. */
interface ITile {
  id: string;
  artId?: string;
  title: string;
  subtitle: string;
  /** A song tile's root, to dim it when the drive is out. */
  rootId?: string;
  isPending: boolean;
}

/**
 * The grid: one tile per album, artist, genre, folder, playlist or song —
 * a cover over a title and a second line, the same fields a table row has,
 * laid out as a card. Only the rows of tiles near the viewport are mounted,
 * and only their pages are here.
 */
const LibraryGridView = ({
  list,
  browseMode,
  onOpenAlbum,
  onOpenArtist,
  onOpenGenre,
  onOpenFolder,
  onOpenPlaylist,
  onPlayTrack,
  onRestartTrack,
  offlineRootIds = NO_OFFLINE_ROOTS,
  folderParent,
  resetKey = '',
  playingItemId,
  revealTrack,
}: ILibraryGridViewProps) => {
  const { t } = useTranslation();
  const { playlists } = usePlaylists();
  const isPlaylists = browseMode === 'playlist';
  const covers = usePlaylistCovers(isPlaylists ? playlists : []);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const isRestoringRef = useRef(false);
  const [activeId, setActiveId] = useState<string | undefined>(
    () => rememberedGridState.get(resetKey)?.activeId,
  );

  const rows = useMemo(
    () => (list === undefined ? undefined : libraryRows(list)),
    [list],
  );
  const count = isPlaylists ? playlists.length : (rows?.count ?? 0);
  /** The runs and bands to lay out. Playlists are one run, like a grid
   * without a search. */
  const blocks = useMemo<TGridBlock[]>(() => {
    if (isPlaylists || rows === undefined) {
      return count > 0 ? [{ kind: 'tiles', first: 0, count }] : [];
    }
    return gridBlocksOf(rows);
  }, [count, isPlaylists, rows]);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const rowsRef = useRef<ILibraryRows | undefined>(rows);
  rowsRef.current = rows;
  const listRef = useRef(list);
  listRef.current = list;

  const metricsRef = useRef<IGridMetrics>({
    tileHeight: TILE_HEIGHT,
    rowGap: 0,
    columns: TILE_COLUMNS,
    padding: 0,
  });
  const [gridWindow, setGridWindow] = useState<IGridWindow>(() =>
    gridWindowFor({
      scrollTop: 0,
      paneHeight: 0,
      screenHeight: window.innerHeight,
      metrics: metricsRef.current,
      blocks,
    }),
  );
  const gridWindowRef = useRef(gridWindow);
  gridWindowRef.current = gridWindow;
  /** The blocks the mounted window was last worked out for. */
  const windowBlocksRef = useRef<readonly TGridBlock[] | undefined>(undefined);

  const windowFor = useCallback((element: HTMLElement) => {
    windowBlocksRef.current = blocksRef.current;
    return gridWindowFor({
      scrollTop: element.scrollTop,
      paneHeight: element.clientHeight,
      screenHeight: window.innerHeight,
      metrics: metricsRef.current,
      blocks: blocksRef.current,
    });
  }, []);

  /** Re-renders only for a genuinely different window. */
  const applyWindow = useCallback((next: IGridWindow) => {
    const { current } = gridWindowRef;
    if (
      current.above === next.above &&
      current.below === next.below &&
      JSON.stringify(current.mounted) === JSON.stringify(next.mounted)
    ) {
      return;
    }
    gridWindowRef.current = next;
    setGridWindow(next);
  }, []);

  /** Recorded as the reader scrolls, never off an element being torn down —
   * see `useListWindow`. */
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

  // Back to where the reader left this grid, or to the top. Keyed on what the
  // grid MEANS, never on its rows, which change under a scan.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new grid, and only that
  }, [resetKey]);

  /**
   * What the grid really laid out, measured: a tile's height, the gap between
   * rows, how many columns `auto-fill` chose, and the padding. The left
   * padding, because top and bottom are not the stylesheet's to report once
   * spacers stand in for rows.
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
      // A real tile: one whose page is still out is drawn to the same size,
      // but measuring it would be trusting the copy over the thing.
      const tile = element.querySelector(
        '.library-grid__tile:not(.library-grid__tile--placeholder)',
      );
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

  /** A window worked out for other blocks than there now are — a grid that
   * grew with no scroll or resize. Costs a comparison when nothing changed. */
  useLayoutEffect(() => {
    const element = gridRef.current;
    if (element && windowBlocksRef.current !== blocksRef.current) {
      applyWindow(windowFor(element));
    }
  });

  // The pages under the tiles on screen, asked for as the window moves.
  useEffect(() => {
    rows?.want(gridWindow.start, gridWindow.end);
  }, [rows, gridWindow.start, gridWindow.end]);

  /**
   * Scroll to a tile and select it. Where it is comes from the store when it
   * is not among the pages held, and the scroll is arithmetic, so the tiles
   * above it are never mounted first. Keyed on the request.
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
      const element = gridRef.current;
      const shown = rowsRef.current;
      if (!isCurrent || index < 0 || !element || shown === undefined) {
        return;
      }
      rememberActive(revealTrackId);
      const top = gridRowTop(
        shown.rowOf(index),
        blocksRef.current,
        metricsRef.current,
      );
      if (top === undefined) {
        return;
      }
      const { tileHeight, padding } = metricsRef.current;
      element.scrollTop = Math.max(
        0,
        padding + top - (element.clientHeight - tileHeight) / 2,
      );
      applyWindow(windowFor(element));
      remember(element);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the request, not on rows that change under a scan
  }, [revealTrackId, revealNonce]);

  /** A tile's words and picture, from what the store sent. */
  const tileOf = (item: TLibraryRow): ITile | undefined => {
    switch (item.kind) {
      case 'album':
        return {
          id: item.id,
          artId: item.artId,
          title: item.title || t('library.unknownAlbum'),
          subtitle: item.artist || t('library.unknownArtist'),
          isPending: item.isPending,
        };
      case 'artist':
        return {
          id: item.id,
          artId: item.artId,
          title: item.name || t('library.unknownArtist'),
          subtitle: t('library.albumCount', { count: item.albumCount }),
          isPending: item.isPending,
        };
      case 'genre':
        return {
          id: item.id,
          artId: item.artId,
          title:
            item.id === UNKNOWN_GENRE_ID
              ? t('library.genre.unknown')
              : item.name,
          subtitle: t('library.artistCount', { count: item.artistCount }),
          isPending: item.isPending,
        };
      case 'folder':
        // The path under the name — two folders called "CD1" are the normal
        // case — except inside the tree, where the count is worth the line.
        return {
          id: item.id,
          artId: item.artId,
          title: item.name,
          subtitle:
            folderParent === undefined
              ? item.id
              : t('library.trackCount', { count: item.trackCount }),
          isPending: item.isPending,
        };
      case 'track':
        return {
          id: item.track.id,
          artId: item.track.artId,
          title: item.track.title,
          subtitle: item.track.artist ?? '',
          rootId: item.track.rootId,
          isPending: item.track.isPending === true,
        };
      default:
        // A folder heading or a section has no tile: the grid draws runs of
        // tiles, and a section is a band between them.
        return undefined;
    }
  };

  const playlistTile = (at: number): ITile | undefined => {
    const playlist = playlists[at];
    if (!playlist) {
      return undefined;
    }
    return {
      id: playlist.id,
      artId: covers.get(playlist.id),
      title:
        playlist.id === FAVORITES_PLAYLIST_ID
          ? t('library.playlist.favorites')
          : playlist.name,
      subtitle: t(
        playlist.trackIds.length === 1
          ? 'library.playlist.songCountOne'
          : 'library.playlist.songCount',
        { count: playlist.trackIds.length },
      ),
      isPending: false,
    };
  };

  /** The tile's primary action. `pressCount` is the system's own click
   * count: the second press of a double-press on a song starts it again. */
  const openItem = (id: string, pressCount: number) => {
    const open: Partial<Record<TLibraryBrowseMode, (openId: string) => void>> =
      {
        album: onOpenAlbum,
        artist: onOpenArtist,
        genre: (openId) => onOpenGenre?.(openId),
        folder: (openId) => onOpenFolder?.(openId),
        playlist: (openId) => onOpenPlaylist?.(openId),
      };
    const opener = open[browseMode];
    if (opener) {
      rememberActive(id);
      opener(id);
      return;
    }
    if (pressCount > 1) {
      (onRestartTrack ?? onPlayTrack)(id);
      return;
    }
    onPlayTrack(id);
  };

  const renderTile = (
    row: number,
    keyFor: (id: string) => string,
  ): ReactNode => {
    const item = isPlaylists ? undefined : rows?.at(row);
    const listed = item === undefined ? undefined : tileOf(item);
    const tile = isPlaylists ? playlistTile(row) : listed;
    if (tile === undefined) {
      // Its page is still out: a tile's own shape and size, empty — the
      // cover's square and the two lines of text under it, each a space.
      return (
        <span
          key={`pending-${row}`}
          aria-hidden="true"
          className="library-grid__tile library-grid__tile--placeholder"
        >
          <span className="library-grid__art">
            <span className="library-cover-art library-cover-art--tile" />
          </span>
          <span className="library-grid__title">{' '}</span>
          <small className="library-grid__subtitle">{' '}</small>
        </span>
      );
    }
    // A root missing at rescan is kept and dimmed, never deleted; only a song
    // tile has one root to dim by.
    const isOffline = Boolean(tile.rootId && offlineRootIds.has(tile.rootId));
    const isSelected = activeId === tile.id;
    const className = [
      'library-grid__tile',
      isOffline ? 'library-grid__tile--offline' : '',
      tile.isPending ? 'library-grid__tile--pending' : '',
      isSelected ? 'library-grid__tile--selected' : '',
      playingItemId === tile.id ? 'library-grid__tile--playing' : '',
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <button
        key={keyFor(tile.id)}
        type="button"
        data-tile-id={tile.id}
        aria-current={isSelected ? 'true' : undefined}
        className={className}
        title={isOffline ? t('library.root.offline') : undefined}
        onClick={(event) => openItem(tile.id, event.detail)}
      >
        <span className="library-grid__art">
          {/* A folder tile is a folder: its picture belongs to the first
              album beneath it, not to the directory — see `LibraryFolderArt`. */}
          {browseMode === 'folder' ? (
            <LibraryFolderArt
              artId={tile.artId}
              label={tile.title}
              size="tile"
            />
          ) : (
            <LibraryCoverArt
              artId={tile.artId}
              label={tile.title}
              size="tile"
            />
          )}
          {tile.isPending && (
            <span
              className="library-grid__badge--pending"
              title={t('library.pending')}
            >
              <MenuIcon name="pending" className="library-list__badge-icon" />
            </span>
          )}
        </span>
        <span className="library-grid__title">{tile.title}</span>
        <small className="library-grid__subtitle">{tile.subtitle}</small>
      </button>
    );
  };

  const mounted: ReactNode[] = [];
  // Keys by id, with a count for an id met again — a playlist's songs, drawn
  // as tiles, can hold one twice.
  const keysSeen = new Map<string, number>();
  const keyFor = (id: string) => {
    const seen = keysSeen.get(id) ?? 0;
    keysSeen.set(id, seen + 1);
    return seen === 0 ? id : `${id}#${seen}`;
  };
  gridWindow.mounted.forEach((entry) => {
    if (entry.kind === 'band') {
      const band = rows?.at(entry.row);
      if (band?.kind === 'section') {
        mounted.push(
          <LibrarySectionBand
            key={`band-${band.section}`}
            row={band}
            folderPath={list?.query?.near}
            height={GRID_BAND_HEIGHT}
          />,
        );
      }
      return;
    }
    for (let row = entry.start; row < Math.min(entry.end, count); row += 1) {
      mounted.push(renderTile(row, keyFor));
    }
  });

  // Full width, so a spacer stands in for whole rows rather than being placed
  // as one more tile in the flow.
  const spacer = (height: number) => ({ height, gridColumn: '1 / -1' });

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
      {gridWindow.above > 0 && (
        <div aria-hidden="true" style={spacer(gridWindow.above)} />
      )}
      {mounted}
      {gridWindow.below > 0 && (
        <div aria-hidden="true" style={spacer(gridWindow.below)} />
      )}
    </div>
  );
};

export default LibraryGridView;
