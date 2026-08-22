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
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  groupIntoAlbums,
  groupIntoArtists,
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
import { FAVORITES_PLAYLIST_ID } from '../../common/library/playlists';
import { useTranslation } from '../utils/I18nContext';
import { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import MenuIcon from '../icons/MenuIcon';
import LibraryCoverArt from './LibraryCoverArt';
import LibraryTrackRow from './LibraryTrackRow';
import LibraryTrackMenu from './LibraryTrackMenu';
import { usePlaylists } from './PlaylistContext';
import { useFolderEntries } from './useFolderEntries';

interface ILibraryListViewProps {
  tracks: readonly ILibraryTrack[];
  browseMode: TLibraryBrowseMode;
  onOpenAlbum: (albumId: string) => void;
  onOpenArtist: (artistId: string) => void;
  /** Only the folder browse mode can ever call this, so it is optional the
   * same way the sort handler is: a caller that never shows folders has
   * nothing to supply. */
  onOpenFolder?: (folderPath: string) => void;
  /** Optional for the reason `onOpenFolder` is: only the Playlists shelf can
   * ever call it, and every other caller has nothing to supply. */
  onOpenPlaylist?: (playlistId: string) => void;
  /** The playlist being read, when the rows below are one. Puts "Remove from
   * this playlist" in the row menu, and nothing else. */
  openPlaylistId?: string;
  onPlayTrack: (trackId: string) => void;
  /** Root ids currently marked `isOffline` — spec §10: kept, never deleted,
   * and dimmed. Optional, matching `NowPlayingBar`'s own `volume` prop: real
   * usage always supplies it (`LibraryWorkspace` derives it from `index.roots`),
   * and no test of this view's other behaviours needs a real one to exercise
   * them. */
  offlineRootIds?: ReadonlySet<string>;
  /** The library's own roots, for the Directories reading of the Folders
   * shelf — see `useFolderEntries`. Without them this falls back to every
   * folder at once, which is what the shelf has always shown. */
  folderRoots?: readonly { path: string }[];
  /** Show what is inside this folder rather than the top of the tree. Set by
   * the drill-in, which is the only place a level below the roots is drawn. */
  folderParent?: string;
  /** A search is on, so the folders shown are where the matches are rather
   * than the top of the tree — see `useFolderEntries`. */
  isSearching?: boolean;
  /** The active sort, so a header can show which column is driving the order
   * and which way. Optional with `onSort`: without a handler the headers stay
   * plain labels, which is what the album and artist branches want. */
  sort?: TLibrarySort;
  sortDirection?: TLibrarySortDirection;
  /** Asked for a column. The workspace decides whether that means a new
   * column or a reversal of the current one — this view only reports the
   * press. */
  onSort?: (key: TLibrarySort) => void;
  /** The track the player is on, so the row for it can say so. Optional the
   * same way the other display-only props here are: no test of this view's
   * behaviour needs a player to exercise what it covers. */
  playingTrackId?: string;
  /** Go to this row: page far enough to have mounted it, scroll it into view
   * and mark it. Carries a nonce because asking twice for the same track has
   * to work — the reader may have scrolled away in between, and an id alone
   * would look unchanged and do nothing. */
  revealTrack?: { trackId: string; nonce: number };
  /** Rows that share the open album's folder without belonging to the album.
   * Listed in the same run rather than a table of their own, tagged so the
   * distinction is visible without splitting the screen in two. */
  folderOnlyIds?: ReadonlySet<string>;
  /** Rows the toolbar's search named, in a panel the search did NOT name —
   * drawn at the head of the table and lit, so a compilation that came up for
   * two of its five hundred songs says which two. */
  matchedIds?: ReadonlySet<string>;
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
/** A stable empty list, so the memo behind the folder entries does not see a
 * new array on every render. */
const NO_FOLDER_ROOTS: readonly { path: string }[] = [];
const NO_FOLDER_ONLY: ReadonlySet<string> = new Set();

/** The directory a file sits in, by name alone — the whole path would be a
 * heading nobody can read. Splits on both separators: a path arrives as
 * Windows text but nothing guarantees every one was written with a backslash. */
const folderLabel = (filePath: string): string => {
  const normalised = filePath.replace(/\\/g, '/');
  const parts = normalised.split('/').filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 2] : normalised;
};

/** The column headers this view ever shows, keyed by the existing
 * `library.column.*` translation each draws from — never a computed key,
 * which `Translate`'s literal `TranslationKey` union would reject anyway. */
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
 * Only the rows near the viewport are ever in the document — see
 * `OVERSCAN_VIEWPORTS`.
 */

/**
 * Only the rows near the viewport are mounted. Everything else is empty space
 * on the body's own padding, and nothing else at all.
 *
 * This was tried once before and reverted, for two reasons worth naming
 * because both are fixed here rather than tolerated:
 *
 * The spacers were sized from an *assumed* row height, so every row that
 * disagreed with it by a pixel walked the scrollbar away from the content.
 * `.library-list__row` and `.library-list__folder-heading` now carry an
 * explicit, identical height in `Library.scss` — the stylesheet says so, in
 * as many words — and this view measures a real one on mount anyway and uses
 * what it finds. An assumption that is checked against the thing it assumes
 * about is not an assumption.
 *
 * And dragging the scrollbar quickly outran React, showing blank bands. That
 * version still built a React element for all fourteen thousand rows on every
 * window change and threw all but sixty of them away, which is slower than
 * mounting the lot. The branches below now build elements for the window
 * only — `renderTable` takes a count and a slice function, never an array —
 * so a window change costs sixty rows' work, and three viewports of overscan
 * either way is more than a flick can cross between two scroll events.
 */
const OVERSCAN_VIEWPORTS = 3;

/**
 * One row's height, and the empty space reserved for one that is not mounted.
 *
 * A starting value only: `.library-list__row` in `Library.scss` sets exactly
 * this, and the view measures a mounted row on layout and uses whatever the
 * stylesheet actually produced. Wrong here costs one frame of a slightly
 * misjudged window, never a wrong scrollbar.
 */
const ROW_HEIGHT = 46;

/** Rows mounted before anything has been measured — enough to fill the
 * tallest pane this app is usable in, so the first paint is never short while
 * the layout effect below is still working out the real numbers. */
const FIRST_WINDOW_ROWS = 60;

/**
 * The most rows this view will mount, whatever it is told about the pane.
 *
 * Seven viewports of a tall screen is a few hundred rows; nothing legitimate
 * ever asks for more, and the thing that asked for more was a bug — see
 * `rowWindowFor`. A ceiling made of arithmetic cannot be wrong the way one
 * made of a measurement can.
 */
const MAX_WINDOW_ROWS = 600;

/**
 * Which rows belong on screen, from numbers alone.
 *
 * Pure, exported and tested, because getting it wrong once cost the whole
 * app: `paneHeight` is a measurement, and a measurement can be absurd. This
 * pane's height comes from a chain that includes a `flex: 0 0 auto`, so a
 * layout that stops constraining it leaves the scroll container as tall as
 * its own content — `clientHeight` came back as the full 647,542px of a
 * fourteen-thousand-row list, which this multiplied by seven and obediently
 * mounted. Reported as the window freezing and the app reaching 5GB on a
 * resize.
 *
 * Two ceilings answer that, and both are deliberate. Nobody can read more
 * than a screenful, so a scroll container taller than the screen is a layout
 * fault and `screenHeight` caps what is believed; and `MAX_WINDOW_ROWS` caps
 * the result regardless, so no arithmetic on any measurement can get past it.
 */
export const rowWindowFor = ({
  scrollTop,
  paneHeight,
  screenHeight,
  rowHeight,
  count,
}: {
  scrollTop: number;
  /** The scroll container's own `clientHeight`. Zero before it is laid out. */
  paneHeight: number;
  screenHeight: number;
  rowHeight: number;
  count: number;
}): { start: number; end: number } => {
  // A body that has not been laid out yet reports nothing; a screenful is a
  // better guess than none, and the observer that calls this corrects it
  // either way.
  const viewport = Math.min(
    paneHeight || rowHeight * FIRST_WINDOW_ROWS,
    screenHeight,
  );
  const overscan = viewport * OVERSCAN_VIEWPORTS;
  const top = Math.max(0, scrollTop - overscan);
  const bottom = scrollTop + viewport + overscan;
  const start = Math.max(0, Math.min(Math.floor(top / rowHeight), count));
  return {
    start,
    end: Math.max(
      start,
      Math.min(Math.ceil(bottom / rowHeight), count, start + MAX_WINDOW_ROWS),
    ),
  };
};

/** One row of the song list, as data rather than as an element: what the
 * window needs in order to count and index rows without building any. A
 * heading and the track under it are two entries, not one — see `songRows`. */
interface ISongRow {
  /** Set only on a folder heading, and then it is the label. */
  heading?: string;
  track: ILibraryTrack;
}

/**
 * Where each list was left, keyed by what that list was showing.
 *
 * Module-level and deliberately not React state: opening an album unmounts
 * this whole view — the drill-in replaces it rather than covering it — so
 * anything held inside the component is gone by the time the reader presses
 * Back. Keeping it here is what lets them return to the row they came from
 * instead of the top of a list they had scrolled a thousand rows into.
 *
 * Capped, because the key holds the search text and the search box writes a
 * new one on every keystroke: this is not "the handful of lists a reader
 * visits" but one entry per prefix of everything they have ever typed, which
 * grows for as long as the window is open. The entries are tiny and the
 * eviction is cheap, so the cap is generous — far more lists than anyone
 * revisits, and still a ceiling rather than none.
 */
const rememberedListState = new Map<
  string,
  { scrollTop: number; activeId?: string }
>();

/** Lists whose place is worth keeping. Past this the least recently written
 * one goes. */
const REMEMBERED_LISTS = 200;

/** Writes a place, and keeps the map from being a slow leak. Re-inserting
 * rather than assigning is what makes `Map`'s insertion order a *recency*
 * order, so the entry evicted is the one nobody has come back to. */
const rememberList = (
  key: string,
  value: { scrollTop: number; activeId?: string },
): void => {
  rememberedListState.delete(key);
  rememberedListState.set(key, value);
  if (rememberedListState.size > REMEMBERED_LISTS) {
    const oldest = rememberedListState.keys().next();
    if (!oldest.done) {
      rememberedListState.delete(oldest.value);
    }
  }
};

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
  onOpenPlaylist,
  openPlaylistId,
  onPlayTrack,
  offlineRootIds = NO_OFFLINE_ROOTS,
  folderRoots = NO_FOLDER_ROOTS,
  folderParent,
  isSearching = false,
  sort,
  sortDirection,
  onSort,
  playingTrackId,
  revealTrack,
  folderOnlyIds = NO_FOLDER_ONLY,
  matchedIds = NO_FOLDER_ONLY,
  groupByFolder = false,
  resetKey = '',
}: ILibraryListViewProps) => {
  const { t } = useTranslation();
  const { playlists, isFavorite } = usePlaylists();
  const bodyRef = useRef<HTMLDivElement | null>(null);

  /** The half-open slice of rows that is mounted. Everything outside it is
   * not in the document at all — see `OVERSCAN_VIEWPORTS`. */
  const [rowWindow, setRowWindow] = useState({
    start: 0,
    end: FIRST_WINDOW_ROWS,
  });
  /** The same value, readable from a scroll handler that must not re-render
   * to find out whether it needs to. */
  const rowWindowRef = useRef(rowWindow);
  rowWindowRef.current = rowWindow;
  /** How many rows the branch below produced, written as it renders. The
   * scroll handler needs the count to clamp a window against and has no other
   * way to learn it — which branch ran, and how many rows it made, is decided
   * after every hook in this component has already run. */
  const rowCountRef = useRef(0);
  /** A row's real height, measured once there is a row to measure. */
  const rowHeightRef = useRef(ROW_HEIGHT);

  /** True while the restore below is still assigning, so the scroll events
   * that assignment itself fires do not write the half-restored value back
   * over the one being restored. */
  const isRestoringRef = useRef(false);

  /**
   * Which rows belong on screen for where the body is scrolled to now.
   *
   * Pure arithmetic against a measured row height — no element is consulted
   * and none needs to exist, which is what lets the reveal below jump
   * straight to a row ten thousand down without first mounting the ten
   * thousand above it.
   */
  const windowFor = useCallback(
    (element: HTMLElement) =>
      rowWindowFor({
        scrollTop: element.scrollTop,
        paneHeight: element.clientHeight,
        screenHeight: window.innerHeight,
        rowHeight: rowHeightRef.current,
        count: rowCountRef.current,
      }),
    [],
  );

  /** Applies a window, and only re-renders when it is genuinely a different
   * one. Scroll fires every frame; three viewports of overscan means the
   * answer changes every few hundred pixels, so almost every one of those
   * events ends here without costing anything. */
  const applyWindow = useCallback((next: { start: number; end: number }) => {
    const { current } = rowWindowRef;
    if (next.start === current.start && next.end === current.end) {
      return;
    }
    rowWindowRef.current = next;
    setRowWindow(next);
  }, []);

  /**
   * The song branch's rows as plain data — a folder heading, or a track.
   *
   * Built here rather than in the branch because two things need it before
   * any element exists: the window, which has to know how many rows there are
   * without making them, and the reveal, which has to turn a track id into a
   * row *index* — with `groupByFolder` on, the headings interleave and a
   * track's index in `tracks` is no longer its index down the list.
   *
   * Empty in the other three modes: they list groupings, not songs, and
   * walking fourteen thousand tracks to build rows nobody is going to render
   * is exactly the work this whole window exists to avoid. Folder mode is in
   * that group — it lists directories, and building a row per song there was
   * fourteen thousand objects held for a branch that never reads them.
   */
  const songRows = useMemo<ISongRow[]>(() => {
    if (
      browseMode === 'album' ||
      browseMode === 'artist' ||
      browseMode === 'folder'
    ) {
      return [];
    }
    const entries: ISongRow[] = [];
    tracks.forEach((track, index) => {
      // A heading whenever the folder changes, and only when asked for. The
      // list is already in whatever order the sort chose, so this labels runs
      // rather than reordering anything — turning it on while sorted by title
      // gives one heading per row, which is the honest answer to a question
      // that does not really make sense, not something to prevent.
      const heading =
        groupByFolder &&
        (index === 0 ||
          folderLabel(tracks[index - 1].path) !== folderLabel(track.path))
          ? folderLabel(track.path)
          : undefined;
      if (heading !== undefined) {
        entries.push({ heading, track });
      }
      entries.push({ track });
    });
    return entries;
  }, [tracks, groupByFolder, browseMode]);

  // Which folders this shelf holds, under whichever reading is on — the tree's
  // roots or every directory at once. Above the branch that draws them because
  // that branch is a return, and a hook cannot live under one.
  const folderEntries = useFolderEntries(
    tracks,
    folderRoots,
    folderParent,
    isSearching,
  );

  /** Where a track sits *down the list*, headings included. Held in a ref so
   * the reveal effect can ask without listing it as a dependency — it changes
   * on every scan batch, and re-running the reveal for that would drag the
   * reader back to the same row for the whole of a scan. */
  const rowIndexOfTrackRef = useRef((trackId: string) =>
    songRows.findIndex((entry) => !entry.heading && entry.track.id === trackId),
  );
  rowIndexOfTrackRef.current = (trackId: string) =>
    songRows.findIndex((entry) => !entry.heading && entry.track.id === trackId);

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
      rememberList(resetKey, {
        scrollTop: element.scrollTop,
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
      rememberList(resetKey, {
        scrollTop:
          element?.scrollTop ??
          rememberedListState.get(resetKey)?.scrollTop ??
          0,
        activeId: id,
      });
    },
    [resetKey],
  );

  /**
   * "Show me what is playing", the second half of it.
   *
   * The bar already brings the reader to the right album; this brings them to
   * the row, and marks it — which is what makes it findable at all on an album
   * where every row looks alike.
   *
   * The scroll is arithmetic, not a search: the row's position is its index
   * times a row's height whether or not it is mounted, so this jumps straight
   * to a track ten thousand down without first putting the ten thousand above
   * it in the document. That is the whole point of the window — the old
   * version had to page down to the row, wait for React, then find it, and
   * retried across frames when it was not there yet.
   *
   * Keyed on the nonce, so pressing the bar twice for the same track works
   * even after the reader has scrolled away.
   */
  const revealNonce = revealTrack?.nonce;
  const revealTrackId = revealTrack?.trackId;
  useEffect(() => {
    if (revealTrackId === undefined) {
      return;
    }
    const index = rowIndexOfTrackRef.current(revealTrackId);
    if (index < 0) {
      return;
    }
    setActiveId(revealTrackId);
    const element = bodyRef.current;
    if (!element) {
      return;
    }
    const rowHeight = rowHeightRef.current;
    // Centred, and never past either end — `scrollTop` clamps itself, but
    // asking for a negative one on the first row would land at zero anyway
    // and this says so.
    element.scrollTop = Math.max(
      0,
      index * rowHeight - (element.clientHeight - rowHeight) / 2,
    );
    applyWindow(windowFor(element));
    remember(element);
    // Keyed on the request. `tracks` is deliberately absent: it is replaced on
    // every scan batch, and re-running this would drag the reader back to the
    // revealed row for the whole of a scan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealTrackId, revealNonce]);

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
    if (!element) {
      return;
    }
    // One assignment, and it sticks. The body reserves the full height of
    // every row from its first paint — that is what the padding is — so
    // `scrollTop` is no longer clamped to however far the list happened to
    // have been paged, which is what the old retry loop existed to outlast.
    //
    // `scrollTop` rather than `scrollTo`, which jsdom does not implement and
    // would need mocking in every test that renders this view.
    isRestoringRef.current = true;
    setActiveId(remembered?.activeId);
    element.scrollTop = remembered?.scrollTop ?? 0;
    applyWindow(windowFor(element));
    isRestoringRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  /**
   * What a row is really this tall, and how tall the pane really is.
   *
   * Both are measured rather than assumed, because the empty space this view
   * reserves for rows it has not mounted is only right while it matches what
   * a mounted one comes out as — the previous windowed version was reverted
   * precisely because an assumed height walked the scrollbar away from the
   * content a pixel at a time. A `ResizeObserver` rather than a resize
   * listener so a pane that changes height without the window doing so —
   * the graph being collapsed, the scan strip appearing — is caught too.
   */
  useLayoutEffect(() => {
    const element = bodyRef.current;
    if (!element) {
      return undefined;
    }
    const measure = () => {
      const row = element.querySelector('.library-list__row');
      const height = row?.getBoundingClientRect().height ?? 0;
      if (height > 0) {
        rowHeightRef.current = height;
      }
      applyWindow(windowFor(element));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [applyWindow, windowFor]);
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

  /** Enter mirrors the row's primary action — a click, whatever that row
   * does with one — so the list is fully driveable without a mouse. */
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
  /**
   * The track-number header, which lives *inside* the title cell because the
   * number itself does — see `LibraryTrackRow`, where it is drawn at the head
   * of the title so twelve of them make a column the eye can run down. A
   * column header of its own would have to sit before the title cell and
   * would then stand 18px left of every number under it.
   *
   * Marked `aria-hidden`: the cell it sits in is already the title's
   * `columnheader`, and a second control inside one cell is noise read out.
   * The order it sets is announced by the title cell's own `aria-sort`, and
   * the sort control on the bar offers the same order in a labelled form.
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

  /** The `role="table"` shell every branch below shares: the leading,
   * unlabelled art column, the header row, the rowgroup, and — for the
   * track branch only — the context menu portalled beside it. Pulled out
   * once the three branches turned out to repeat this exact wrapper rather
   * than differ in it; what differs is only the header cells and the rows
   * themselves, both still supplied by the branch that knows what it is
   * listing. */
  const renderTable = (
    headerCells: ReactNode,
    count: number,
    renderRows: (start: number, end: number) => ReactNode[],
    menu?: ReactNode,
  ) => {
    // Written during render, and read by the scroll handler and both layout
    // effects — none of which can be told the count any other way, because
    // which branch runs and how many rows it has is settled after every hook
    // in this component.
    rowCountRef.current = count;
    const rowHeight = rowHeightRef.current;
    const start = Math.min(rowWindow.start, count);
    const end = Math.min(Math.max(rowWindow.end, start), count);
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
            applyWindow(windowFor(element));
            remember(element);
          }}
        >
          {/* The rows that are not mounted, as two empty blocks standing in
              for them — which is what keeps the scrollbar measuring the whole
              list from the first paint, and is what lets the restore above
              assign `scrollTop` once instead of retrying until the list has
              grown far enough to hold it.

              Blocks and not the body's own padding, which is what this was
              written as first: a flex item cannot shrink below its own
              padding, so six hundred thousand pixels of it forced the body
              past its parent instead of scrolling inside it — measured, the
              body came out with a `clientHeight` of zero and nothing worked.
              Content shrinks; padding does not.

              `aria-hidden` rather than a role, because a `rowgroup` may only
              contain rows: hidden, the subtree is not in the accessibility
              tree at all and cannot be the wrong kind of child. */}
          {start > 0 && (
            <div
              aria-hidden="true"
              // `flexShrink: 0` is not decoration. The body is a flex column,
              // and a flex item's automatic minimum is its content — which
              // for an empty block is nothing, so without this the spacer
              // shrinks to zero and takes the scrollbar with it. The rows
              // stay their own size because they have content to be minimum
              // about; a spacer has none by definition.
              style={{ height: start * rowHeight, flexShrink: 0 }}
            />
          )}
          {renderRows(start, end)}
          {end < count && (
            <div
              aria-hidden="true"
              style={{ height: (count - end) * rowHeight, flexShrink: 0 }}
            />
          )}
        </div>
        {menu}
      </div>
    );
  };

  if (browseMode === 'album') {
    // An unset sort means the caller has already decided the order — a
    // search ranks its hits by relevance and re-sorting by title would throw
    // that away. Same meaning `LibraryDetail` gives it for an album's own
    // track listing.
    const grouped = groupIntoAlbums(tracks);
    const albums = sort ? sortAlbums(grouped, sort, sortDirection) : grouped;
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
      albums.length,
      (start, end) =>
        albums.slice(start, end).map((album) => {
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
    const folders = sort
      ? sortFolders(folderEntries, sort, sortDirection)
      : folderEntries;
    return renderTable(
      sortableHeader('title', 'title', 'library-list__col--span'),
      folders.length,
      (start, end) =>
        folders.slice(start, end).map((folder) => {
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
                  <span className="library-list__title-label">
                    {folder.name}
                  </span>
                </span>
                {/* The path, not the name again: two folders called "CD1" are
                  the normal case, and the only thing that tells them apart is
                  where they live. */}
                <small className="library-list__subtitle">
                  {/* Except inside the tree, where the reader walked in and
                      knows where they are: there the path is the same forty
                      characters on every row, ending in the one word already
                      printed above it. */}
                  {folderParent === undefined
                    ? `${t('library.trackCount', { count: folder.trackCount })} · ${folder.id}`
                    : t('library.trackCount', { count: folder.trackCount })}
                </small>
              </span>
            </div>
          );
        }),
    );
  }

  if (browseMode === 'artist') {
    const groupedArtists = groupIntoArtists(tracks);
    const artists = sort
      ? sortArtists(groupedArtists, sort, sortDirection)
      : groupedArtists;
    return renderTable(
      sortableHeader('title', 'title', 'library-list__col--span'),
      artists.length,
      (start, end) =>
        artists.slice(start, end).map((artist) => {
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

  if (browseMode === 'playlist') {
    // Not sorted by the toolbar. `sortPlaylists` has already put Favourites
    // first and the rest by name, and that order is the point: the one list
    // that is always there is always in the same place. A title/artist/year
    // sort has nothing to say about a playlist anyway — two of those three
    // columns do not exist here.
    return renderTable(
      // A plain label, not `sortableHeader`. This branch ignores the sort —
      // see above — so a header that could be pressed would be a control
      // that does nothing, which is worse than no control.
      <span
        role="columnheader"
        className="library-list__col library-list__col--span"
      >
        {columnHeader('title')}
      </span>,
      playlists.length,
      (start, end) =>
        playlists.slice(start, end).map((playlist) => {
          const activate = () => {
            rememberActive(playlist.id);
            onOpenPlaylist?.(playlist.id);
          };
          const isBuiltIn = playlist.id === FAVORITES_PLAYLIST_ID;
          const name = isBuiltIn
            ? t('library.playlist.favorites')
            : playlist.name;
          const isSelected = activeId === playlist.id;
          // The first song in it that the library can still see. A playlist
          // of songs from an unplugged drive keeps its entry and draws a
          // generated tile, rather than showing a cover for a song it cannot
          // play.
          const cover = tracks.find((track) =>
            playlist.trackIds.includes(track.id),
          );
          return (
            <div
              key={playlist.id}
              role="row"
              tabIndex={0}
              aria-selected={isSelected}
              className={`library-list__row${
                isSelected ? ' library-list__row--selected' : ''
              }`}
              onClick={activate}
              onKeyDown={(event) => onActivateKeyDown(event, activate)}
            >
              <span
                role="cell"
                className="library-list__col library-list__col--art"
              >
                <LibraryCoverArt artId={cover?.artId} label={name} size="row" />
              </span>
              <span
                role="cell"
                className="library-list__col library-list__col--title library-list__col--span"
              >
                <span className="library-list__title-text">
                  {isBuiltIn && (
                    <span
                      className="library-list__badge library-list__badge--favorite"
                      title={t('library.playlist.builtIn')}
                    >
                      <MenuIcon
                        name="star"
                        className="library-list__badge-icon"
                      />
                    </span>
                  )}
                  <span className="library-list__title-label">{name}</span>
                </span>
                <small className="library-list__subtitle">
                  {t(
                    playlist.trackIds.length === 1
                      ? 'library.playlist.songCountOne'
                      : 'library.playlist.songCount',
                    { count: playlist.trackIds.length },
                  )}
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
      {sortableHeader('title', 'title', undefined, trackNoSort())}
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
    songRows.length,
    (start, end) =>
      songRows.slice(start, end).map((entry) =>
        entry.heading !== undefined ? (
          <div
            key={`folder-${entry.track.id}`}
            role="row"
            className="library-list__folder-heading"
          >
            <span role="cell">
              <MenuIcon name="folder" className="library-list__badge-icon" />
              <span>{entry.heading}</span>
            </span>
          </div>
        ) : (
          <LibraryTrackRow
            key={entry.track.id}
            track={entry.track}
            isOffline={offlineRootIds.has(entry.track.rootId)}
            isFolderOnly={folderOnlyIds.has(entry.track.id)}
            isSearchMatch={matchedIds.has(entry.track.id)}
            isSelected={activeId === entry.track.id}
            isPlaying={playingTrackId === entry.track.id}
            isFavorite={isFavorite(entry.track.id)}
            duration={formatDuration(entry.track.durationMs)}
            onPlay={onPlayTrack}
            onSelect={rememberActive}
            onKeyDown={onTrackRowKeyDown}
            onContextMenu={openTrackMenu}
          />
        ),
      ),
    <LibraryTrackMenu
      anchor={trackMenu?.anchor ?? null}
      isOpen={Boolean(trackMenu)}
      // Resolved from the list this view is already holding rather than
      // stored alongside the anchor: a rescan can replace the track object
      // under an open menu, and the menu must act on what the index says now.
      track={tracks.find((track) => track.id === trackMenu?.trackId)}
      openPlaylistId={openPlaylistId}
      onReveal={reveal}
      onClose={() => setTrackMenu(undefined)}
    />,
  );
};

export default LibraryListView;
