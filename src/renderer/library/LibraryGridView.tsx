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
  groupIntoFolders,
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

/** Tiles per page, and how close to the bottom asks for the next one. Larger
 * than the list's hundred rows because a tile is a fraction of a row's height
 * and four to eight sit side by side: a hundred would be barely two screens. */
const PAGE_SIZE = 180;
const NEXT_PAGE_THRESHOLD_PX = 320;

/** Where each grid was left and which tile was opened out of it, keyed by
 * what the grid was showing. Module-level for the reason `LibraryListView`'s
 * equivalent is: opening an album unmounts this view, so nothing held inside
 * the component survives to put the reader back where they were. */
const rememberedGridState = new Map<
  string,
  { scrollTop: number; shownCount: number; activeId?: string }
>();

/** Frames a restore keeps retrying before giving up — see the list view's
 * own constant for why one assignment is not enough. */
const RESTORE_ATTEMPTS = 20;

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
  sort,
  sortDirection = 'asc',
  resetKey = '',
  playingTrackId,
  revealTrack,
}: ILibraryGridViewProps) => {
  const { t } = useTranslation();
  const gridRef = useRef<HTMLDivElement | null>(null);
  const isRestoringRef = useRef(false);
  const [shownCount, setShownCount] = useState(
    () => rememberedGridState.get(resetKey)?.shownCount ?? PAGE_SIZE,
  );
  const shownCountRef = useRef(shownCount);
  shownCountRef.current = shownCount;
  const [activeId, setActiveId] = useState<string | undefined>(
    () => rememberedGridState.get(resetKey)?.activeId,
  );

  /** Same contract as `LibraryListView`'s own `remember`, and written for the
   * same reason: recorded as the reader scrolls, never off an element that is
   * already being torn down. */
  const remember = useCallback(
    (element: HTMLDivElement) => {
      if (isRestoringRef.current) {
        return;
      }
      rememberedGridState.set(resetKey, {
        scrollTop: element.scrollTop,
        shownCount: shownCountRef.current,
        activeId: rememberedGridState.get(resetKey)?.activeId,
      });
    },
    [resetKey],
  );

  const rememberActive = useCallback(
    (id: string) => {
      setActiveId(id);
      rememberedGridState.set(resetKey, {
        scrollTop:
          gridRef.current?.scrollTop ??
          rememberedGridState.get(resetKey)?.scrollTop ??
          0,
        shownCount: shownCountRef.current,
        activeId: id,
      });
    },
    [resetKey],
  );

  // Back to where the reader left this grid, or to the first page if they
  // have not been in it. Keyed on `resetKey` rather than on `items`, which
  // gets a new identity on every scan batch — resetting on that would yank
  // them to the top several times a second while a scan runs.
  useLayoutEffect(() => {
    const element = gridRef.current;
    const remembered = rememberedGridState.get(resetKey);
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
      const grouped = groupIntoFolders(tracks);
      return (sort ? sortFolders(grouped, sort, sortDirection) : grouped).map(
        (folder) => ({
          id: folder.id,
          artId: folder.artId,
          title: folder.name,
          // The path under the name — two folders called "CD1" are the normal
          // case and only their location tells them apart.
          artistName: folder.id,
          isPending: folder.isPending,
        }),
      );
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
  }, [tracks, browseMode, sort, sortDirection]);

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
   * Page to a tile, scroll to it and select it — the grid's half of
   * `LibraryListView`'s reveal, written the same way and for the same reason.
   *
   * Paging first is the part that matters: the grid holds a page at a time
   * and the tile asked for is very often past the end of what is mounted, so
   * scrolling to it before growing the grid would scroll to nothing.
   */
  const revealNonce = revealTrack?.nonce;
  const revealTrackId = revealTrack?.trackId;
  useEffect(() => {
    if (revealTrackId === undefined) {
      return undefined;
    }
    const index = items.findIndex((item) => item.id === revealTrackId);
    if (index < 0) {
      return undefined;
    }
    rememberActive(revealTrackId);
    if (index >= shownCountRef.current) {
      const needed = Math.ceil((index + 1) / PAGE_SIZE) * PAGE_SIZE + PAGE_SIZE;
      shownCountRef.current = needed;
      setShownCount(needed);
    }
    // Retried rather than scrolled on the next frame, for the same reason
    // `RESTORE_ATTEMPTS` exists at all: the `setShownCount` above schedules
    // another render, so one frame later the tile asked for very often does
    // not exist yet and a single `scrollIntoView` finds nothing and silently
    // does nothing. Measured on a 6660-tile grid, that was exactly the bug —
    // the right tile was selected 133,743px down a grid that had not moved.
    let attempts = 0;
    let frame = 0;
    const scrollToTile = () => {
      frame = 0;
      const tile = gridRef.current?.querySelector(
        `[data-tile-id="${CSS.escape(revealTrackId)}"]`,
      );
      if (tile) {
        tile.scrollIntoView({ block: 'center' });
        return;
      }
      attempts += 1;
      if (attempts < RESTORE_ATTEMPTS) {
        frame = requestAnimationFrame(scrollToTile);
      }
    };
    frame = requestAnimationFrame(scrollToTile);
    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
    // Keyed on the request, not on `items` — which gets a new identity on
    // every scan batch and would drag the grid back here several times a
    // second while one runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealTrackId, revealNonce]);

  // A page at a time, growing as the bottom comes into reach — the same rule
  // `LibraryListView` follows, and for the same reason: nothing stands in for
  // what is not rendered, so the scrollbar measures exactly the tiles that
  // exist and cannot move under the pointer.
  const shown = Math.min(items.length, shownCount);
  const remaining = items.length - shown;

  return (
    <div
      className="library-grid"
      aria-label={t('tabs.library')}
      ref={gridRef}
      onScroll={(event) => {
        const element = event.currentTarget;
        if (remaining > 0) {
          const distanceToBottom =
            element.scrollHeight - element.scrollTop - element.clientHeight;
          if (distanceToBottom <= NEXT_PAGE_THRESHOLD_PX) {
            // The ref as well as the state — `remember` below reads it this
            // same tick, before a `setShownCount` has landed.
            shownCountRef.current += PAGE_SIZE;
            setShownCount(shownCountRef.current);
          }
        }
        remember(element);
      }}
    >
      {items.slice(0, shown).map((item) => {
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
      {remaining > 0 && (
        <div className="library-grid__more">
          {t('library.trackCount', { count: remaining })}
        </div>
      )}
    </div>
  );
};

export default LibraryGridView;
