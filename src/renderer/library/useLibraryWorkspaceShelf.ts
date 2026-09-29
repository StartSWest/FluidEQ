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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { useLibrary } from './LibraryContext';
import { useFolderTree } from './folderTree';
import { usePlaylists } from './PlaylistContext';
import { useLibraryPlayerSession } from './player/LibraryPlayerContext';
import {
  BROWSE_MODE_KEY,
  BROWSE_MODES,
  OPEN_ALBUM_KEY,
  OPEN_ARTIST_KEY,
  OPEN_FOLDER_KEY,
  OPEN_GENRE_KEY,
  OPEN_PLAYLIST_KEY,
  readPersistedMode,
  readPersistedText,
  SORT_DIRECTION_KEY,
  SORT_DIRECTIONS,
  SORT_KEY,
  SORTS,
  UP_NEXT_FLOAT_WIDTH,
  UP_NEXT_MAX,
  UP_NEXT_MIN,
  UP_NEXT_WIDTH_KEY,
  VIEW_MODE_KEY,
  VIEW_MODES,
  writePersistedMode,
  writePersistedText,
} from './libraryWorkspacePrefs';
import {
  type TLibraryBrowseMode,
  type TLibrarySort,
  type TLibrarySortDirection,
  type TLibraryViewMode,
} from '../../common/library/types';
import {
  albumKey,
  artistKey,
  parentFolderPath,
  trackFolderPath,
} from '../../common/library/grouping';
import { shelfQueryFor } from './libraryShelfQuery';
import { useLibraryList } from './useLibraryList';
import { trackGenreIds } from '../../common/library/genres';
import { type ILibraryWorkspaceProps } from './LibraryWorkspace';

/**
 * The Library's shelf: the index and the queue, the browse mode, view and
 * sort, what is open in each mode and where the reader is inside it, the
 * Up next pane, and the list the shelf shows — everything the navigation
 * and the markup read, returned as one object in the order it is declared.
 */
const useLibraryWorkspaceShelf = ({
  revealRequest,
}: Pick<ILibraryWorkspaceProps, 'revealRequest'>) => {
  const { t } = useTranslation();
  const {
    summary,
    isIndexLoaded,
    isScanning,
    progress,
    addFolder,
    addFolderPaths,
    rescan,
    forceRescan,
    cancelScan,
    removeRoot,
  } = useLibrary();
  const { roots, wasReset, trackCount } = summary;
  const isTree = useFolderTree();
  const { playlists, wasReset: playlistsWereReset } = usePlaylists();
  const {
    playTracks,
    retargetQueue,
    appendToQueue,
    upNext,
    videoTrackId,
    track: playingTrack,
    isPlaying,
    seek,
  } = useLibraryPlayerSession();

  /**
   * The Up Next panel's fold, and the width it takes when open.
   *
   * FOLDED WHEN THERE IS NOTHING IN IT, OPEN THE MOMENT THERE IS. A launch
   * with an empty list should not spend a fifth of the tab on saying so, and
   * a list that has just been added to should not have to be found. After
   * that it is the reader's: folding it by hand sticks until the list next
   * goes from empty to not.
   */
  const [isUpNextCollapsed, setIsUpNextCollapsed] = useState(true);
  const hadUpNextRef = useRef(false);
  useEffect(() => {
    const has = upNext.length > 0;
    if (has && !hadUpNextRef.current) {
      setIsUpNextCollapsed(false);
    }
    hadUpNextRef.current = has;
  }, [upNext.length]);

  /** Dragged from the panel's own edge; remembered for the next session. */
  const [upNextWidth, setUpNextWidth] = useState(() => {
    const stored = Number(readPersistedText(UP_NEXT_WIDTH_KEY));
    return Number.isFinite(stored) && stored > 0
      ? Math.min(UP_NEXT_MAX, Math.max(UP_NEXT_MIN, stored))
      : 260;
  });
  /** The width the drag started from — the splitter reports a delta, not a
   * position, exactly as the karaoke panes' does. */
  const upNextResizeStartRef = useRef(upNextWidth);
  /**
   * The queue's edge is being dragged. Published on the card as
   * `is-resizing-up-next` for the stylesheet, which used to find it out with
   * `:has(.library-up-next__splitter .is-dragging)` — and paid for it: every
   * queue row picked up or put down re-asked the card, 9 ms a time against
   * 0.2 measured, because the rows' own drag wears `is-dragging` too.
   */
  const [isResizingUpNext, setIsResizingUpNext] = useState(false);
  /**
   * The width the last drag step asked for, remembered once the drag ends.
   *
   * Not on every width: it was an effect on the width, so each pointer move
   * of a drag wrote localStorage, which is synchronous, on the thread drawing
   * the drag — `commitPaneSizes` writes on release for the same reason. A ref
   * rather than the state, because a keyboard step is start, drag and end in
   * one handler, where the end still sees the width from before the step.
   */
  const upNextDraggedToRef = useRef(upNextWidth);

  /** Not over a video: there the picture is the whole surface. */
  /**
   * The queue is drawn on every surface this tab has, the picture included.
   *
   * It was withheld while a video played, on the reasoning that the picture
   * is the whole surface — but a video is a queue entry like any other, and
   * "what is next" is exactly the question a listener has while one is
   * playing. Karaoke keeps its playlist beside the stage in full screen for
   * the same reason. Over the picture it floats rather than taking a strip of
   * its own: see `is-over-video`.
   */
  const isUpNextOverVideo = videoTrackId !== undefined;

  /**
   * Narrow enough that the queue stops taking a strip and stands over the
   * shelf instead — a drawer.
   *
   * Measured in JS rather than left to the container query that used to own
   * this, because the drawer is not only a layout: it draws over the toolbar,
   * it blurs what is behind it, and a press outside it puts it away. The last
   * of those needs a listener, and a listener cannot read a container query.
   * One source of truth, and CSS follows the class.
   *
   * A `ResizeObserver`, which is what the queue panel already watches its own
   * scrollport with. The card is what is asked, not the window: the queue
   * takes a fifth of the card, so the two disagree by exactly the amount that
   * decides this.
   */
  const cardRef = useRef<HTMLElement | null>(null);
  const [isCardNarrow, setIsCardNarrow] = useState(false);
  /**
   * How tall the controls above the shelf are, so the drawer can start below
   * them.
   *
   * A drawer that covers the list is the point; one that covers the toolbar is
   * a bug — it took the search box and the folder controls with it, and there
   * was no way to reach them without closing the queue first. The row's height
   * is not a constant: it is one line or two depending on what has collapsed,
   * so it is measured rather than guessed at.
   */
  const [chromeHeight, setChromeHeight] = useState(0);
  const chromeObserverRef = useRef<ResizeObserver | undefined>(undefined);
  /**
   * A CALLBACK REF, not an effect over a `useRef`.
   *
   * The row is only rendered once the library has something in it, so on the
   * first pass there is no element to observe — and an effect with no
   * dependencies runs exactly once, before it exists. The height stayed at
   * zero, and the queue opened over the toolbar it was supposed to start
   * below. A callback ref fires when the node arrives, whenever that is.
   */
  const chromeRef = useCallback((node: HTMLDivElement | null) => {
    chromeObserverRef.current?.disconnect();
    chromeObserverRef.current = undefined;
    if (!node || typeof ResizeObserver === 'undefined') {
      return;
    }
    setChromeHeight(Math.round(node.getBoundingClientRect().height));
    const observer = new ResizeObserver((entries) => {
      const height = entries[entries.length - 1]?.contentRect.height;
      if (height !== undefined && height > 0) {
        setChromeHeight(Math.round(height));
      }
    });
    observer.observe(node);
    chromeObserverRef.current = observer;
  }, []);
  useEffect(
    () => () => {
      chromeObserverRef.current?.disconnect();
    },
    [],
  );
  useEffect(() => {
    const card = cardRef.current;
    if (!card || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const width = entries[entries.length - 1]?.contentRect.width;
      // A HIDDEN CARD HAS NO WIDTH TO JUDGE, and zero is not narrow.
      //
      // This tab is hidden rather than unmounted, so leaving it reports a
      // width of 0 — which read as "very narrow", turned the drawer on, and
      // armed the press-outside listener. The next click anywhere in the app,
      // on any other tab, then folded the queue away for no reason the reader
      // could see. Nothing measurable means nothing to reconsider.
      if (width !== undefined && width > 0) {
        setIsCardNarrow(width < UP_NEXT_FLOAT_WIDTH);
      }
    });
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  /**
   * Whether the queue stands over the shelf as a drawer rather than beside
   * it. Not whether it is open: the drawer keeps its look while it folds away
   * (`Library.scss`), or its shadow would drop off the first frame of closing.
   */
  const isUpNextDrawer = isCardNarrow && !isUpNextOverVideo;
  const isUpNextFloating = isUpNextDrawer && !isUpNextCollapsed;

  /**
   * A press anywhere else puts the drawer away.
   *
   * Only while it IS a drawer. In the strip layout the shelf beside it is not
   * "outside" anything — the two stand side by side — and folding the queue
   * because somebody clicked a song would be the worst kind of surprise.
   */
  useEffect(() => {
    if (!isUpNextFloating) {
      return undefined;
    }
    const onPointerDown = ({ target }: globalThis.MouseEvent) => {
      // The chip that opens it counts as inside: a press on it while the
      // drawer is up would otherwise close and reopen in one gesture, and the
      // drawer would look like it never went away.
      if (
        target instanceof Element &&
        !target.closest('.library-up-next, .library-up-next__chip')
      ) {
        setIsUpNextCollapsed(true);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, [isUpNextFloating]);

  /**
   * The mark on the row, which is not the same as the track that is loaded.
   *
   * A paused song is the selected row and nothing more — the animated meter
   * beside a title says "this is what you are hearing", and there is nothing
   * to hear. `playingTrack` itself stays the loaded one wherever the question
   * is which album to open or which row to reveal, because that is still the
   * song being listened to.
   */
  const playingMarkId = isPlaying ? playingTrack?.id : undefined;

  const [isDragOver, setIsDragOver] = useState(false);
  const [isResetNoticeDismissed, setIsResetNoticeDismissed] = useState(false);
  const [isPlaylistNoticeDismissed, setIsPlaylistNoticeDismissed] =
    useState(false);

  // The toolbar's own state. Held here rather than inside `LibraryToolbar` so
  // that component stays a pure controlled view, testable without a
  // `LibraryProvider` above it.
  const [browseMode, setBrowseMode] = useState<TLibraryBrowseMode>(() =>
    readPersistedMode(BROWSE_MODE_KEY, BROWSE_MODES, 'album'),
  );
  // Cover Flow on a fresh install, and albums with it: the first thing the
  // library should be is a shelf of covers, because that is what somebody
  // recognises their own music by. The grid is a fine second look and the list
  // is the one for work; neither is the one to open on. Anybody who picks
  // another keeps it — this is only the value with nothing remembered yet.
  const [viewMode, setViewMode] = useState<TLibraryViewMode>(() =>
    readPersistedMode(VIEW_MODE_KEY, VIEW_MODES, 'coverflow'),
  );
  const [sortDirection, setSortDirection] = useState<TLibrarySortDirection>(
    () => readPersistedMode(SORT_DIRECTION_KEY, SORT_DIRECTIONS, 'asc'),
  );
  const [sort, setSort] = useState<TLibrarySort>(() =>
    readPersistedMode(SORT_KEY, SORTS, 'title'),
  );
  const [query, setQuery] = useState('');
  // Whether the order on screen was asked for or merely inherited. See
  // `viewSort`: it is the difference between "these are your matches, best
  // first" and "these are your matches, by year".
  const [isSortChosen, setIsSortChosen] = useState(false);

  // The drill-in behind a grid tile or a list row, kept across restarts along
  // with the browse and view modes: coming back and finding the album you
  // were reading closed is the same loss as finding the wrong view selected.
  //
  // Nothing validates these on the way in, deliberately. An id that no longer
  // groups to anything makes `LibraryDetail` orphan itself and call `onBack`
  // — the same path a rescan mid-session already takes — so a stale id
  // costs one render of nothing rather than needing a check here that would
  // have to run before the index has even arrived.
  const [openFolderPath, setOpenFolderPath] = useState<string | undefined>(() =>
    readPersistedText(OPEN_FOLDER_KEY),
  );
  const [openAlbumId, setOpenAlbumId] = useState<string | undefined>(() =>
    readPersistedText(OPEN_ALBUM_KEY),
  );
  const [openArtistId, setOpenArtistId] = useState<string | undefined>(() =>
    readPersistedText(OPEN_ARTIST_KEY),
  );
  const [openGenreId, setOpenGenreId] = useState<string | undefined>(() =>
    readPersistedText(OPEN_GENRE_KEY),
  );
  const [openPlaylistId, setOpenPlaylistId] = useState<string | undefined>(() =>
    readPersistedText(OPEN_PLAYLIST_KEY),
  );

  useEffect(
    () => writePersistedText(OPEN_PLAYLIST_KEY, openPlaylistId),
    [openPlaylistId],
  );
  useEffect(
    () => writePersistedText(OPEN_ALBUM_KEY, openAlbumId),
    [openAlbumId],
  );
  useEffect(
    () => writePersistedText(OPEN_ARTIST_KEY, openArtistId),
    [openArtistId],
  );
  useEffect(
    () => writePersistedText(OPEN_GENRE_KEY, openGenreId),
    [openGenreId],
  );
  useEffect(
    () => writePersistedText(OPEN_FOLDER_KEY, openFolderPath),
    [openFolderPath],
  );

  useEffect(
    () => writePersistedMode(BROWSE_MODE_KEY, browseMode),
    [browseMode],
  );
  useEffect(() => writePersistedMode(VIEW_MODE_KEY, viewMode), [viewMode]);
  useEffect(() => writePersistedMode(SORT_KEY, sort), [sort]);
  useEffect(
    () => writePersistedMode(SORT_DIRECTION_KEY, sortDirection),
    [sortDirection],
  );

  // Set by whichever path changed the browse mode *and* set the drill-in for
  // it in the same pass — a reveal, or a browse chip carrying the open album
  // across. The effect below closes the drill-in on every other mode change;
  // this is how it tells the two apart. See that effect for why.
  const drillInDrivenMode = useRef<TLibraryBrowseMode | undefined>(undefined);

  /**
   * The row every view should scroll to and mark.
   *
   * Carries a nonce of its own so that asking twice for the same track still
   * moves the list — the reader may well have scrolled away in between, and
   * an id that looks unchanged would do nothing.
   *
   * Two things write it. The now-playing bar's "show me what is playing",
   * which also opens an album; and a switch to Songs, which is the one browse
   * mode with no drill-in to carry across and so carries the row instead —
   * without it, pressing Songs from an album dropped the reader at the top of
   * fourteen thousand of them with no sign of where they had been.
   */
  const [revealTrack, setRevealTrack] = useState<
    { trackId: string; nonce: number } | undefined
  >(undefined);
  const revealRow = useCallback((trackId: string) => {
    setRevealTrack((current) => ({
      trackId,
      nonce: (current?.nonce ?? 0) + 1,
    }));
  }, []);

  // "Show me what is playing", asked for by the now-playing bar. Browsing has
  // to move to albums first: the drill-in only exists in that mode, and the
  // browse-mode effect below closes any open album when the mode changes, so
  // setting both here in one pass is what makes the album survive the switch.
  // Keyed on the nonce so pressing it twice for the same album still works.
  const revealNonce = revealRequest?.nonce;
  const revealAlbumId = revealRequest?.albumId;
  const revealRequestTrackId = revealRequest?.trackId;
  useEffect(() => {
    if (revealAlbumId === undefined) {
      return;
    }
    drillInDrivenMode.current = 'album';
    setBrowseMode('album');
    setOpenArtistId(undefined);
    setOpenFolderPath(undefined);
    setOpenAlbumId(revealAlbumId);
    if (revealRequestTrackId !== undefined) {
      revealRow(revealRequestTrackId);
    }
    // `revealRequestTrackId` and `revealRow` are deliberately not
    // dependencies: this runs for a *request*, which the nonce identifies,
    // and listing the id would fire it again for an unrelated render that
    // happened to change it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealAlbumId, revealNonce]);

  // An album id means nothing while artists are listed, and the reverse — a
  // mode change that brings no drill-in of its own closes whatever was open.
  //
  // Except when the switch was itself part of opening something: a reveal
  // moves to album mode *in order to* open an album, and a browse chip
  // re-derives the open album as the folder or artist it belongs to, both
  // in the same commit this effect fires on. The ref lets it recognise a
  // mode change that already settled the drill-in and leave it alone. A
  // boolean would not do — two of those in a row must both survive.
  // And except on the very first run, which is not a mode *change* at all —
  // it is this effect firing once on mount, and left ungated it threw away
  // the drill-in restored from the last session a frame after it was read
  // back.
  const hasSeenBrowseMode = useRef(false);
  useEffect(() => {
    if (!hasSeenBrowseMode.current) {
      hasSeenBrowseMode.current = true;
      return;
    }
    if (drillInDrivenMode.current === browseMode) {
      drillInDrivenMode.current = undefined;
      return;
    }
    setOpenAlbumId(undefined);
    setOpenArtistId(undefined);
    setOpenGenreId(undefined);
    // The open playlist goes with them, and unlike the folder below it has
    // no second reading: a playlist is a thing that was opened, never a
    // place the reader is standing, so it means nothing at all on a shelf of
    // albums.
    setOpenPlaylistId(undefined);
    // The folder stays. An album id means nothing while artists are listed —
    // that is what this effect is for — but a directory means the same thing
    // on every shelf, and it is where the reader is rather than what they had
    // opened. Cleared here it took them out of the folder they were standing
    // in every time they changed how it was arranged.
  }, [browseMode]);

  const karaokeSkippedCount = roots.reduce(
    (total, root) => total + root.karaokeSkipped,
    0,
  );

  // Spec §10: a root missing at rescan is marked offline and its tracks are
  // "kept and dimmed — never deleted". Recomputed only when the roots
  // themselves change, not on every render this workspace has (a scan tick,
  // most of all).
  const offlineRootIds = useMemo(
    () =>
      new Set(roots.filter((root) => root.isOffline).map((root) => root.id)),
    [roots],
  );

  /**
   * While a search is running, relevance IS the order — see `viewSort`.
   */
  const isSearching = query.trim().length > 0;

  /**
   * The order to hand the views: nothing while searching, which every one of
   * them reads as "leave this order alone" — the same meaning `LibraryDetail`
   * gives an unset sort for an album's own track listing.
   *
   * Until the reader asks for an order themselves. Relevance is the DEFAULT
   * under a search, not a lock on it: with a query in the box every column
   * header and the bar's own control went dead, on all five shelves, because
   * an unset sort tells the views to sort nothing. Pressing a header IS the
   * decision to stop ranking by relevance, so it takes effect; a new query
   * hands the ranking back.
   */
  const viewSort = isSearching && !isSortChosen ? undefined : sort;

  // What makes the list a DIFFERENT list, as opposed to the same list with
  // more in it. A scan republishes the whole index every batch, so the track
  // array's identity changes constantly and means nothing to the reader —
  // only these five do. The folder is one: the albums in `Pop` and the
  // albums in the whole library are two lists, each with its own place to
  // come back to, and without it stepping out of a folder kept the scroll
  // and selection of the one just left.
  const listResetKey = `${browseMode}|${openFolderPath ?? ''}|${query}|${sort}|${sortDirection}`;

  /**
   * The Folders shelf's row in Cover Flow is the level the open folder stands
   * on, so the open one is always among its neighbours: the row used to be
   * the roots and only the roots, and the second step into a tree closed the
   * panel and left a carousel of one card.
   */
  const folderLevel =
    browseMode === 'folder' &&
    viewMode === 'coverflow' &&
    openFolderPath !== undefined
      ? parentFolderPath(openFolderPath, roots)
      : undefined;

  /**
   * The shelf, as the store is asked for it — every rule of where the reader
   * stands and what a search reaches is `libraryShelfQuery.ts`'s. Every view
   * draws it a page at a time; none of them holds it whole.
   */
  const hasRoots = roots.length > 0;
  const shelfState = useMemo(
    () => ({
      browseMode,
      viewMode,
      folderPath: openFolderPath,
      search: query,
      sort: viewSort,
      direction: sortDirection,
      isTree,
      hasRoots,
      folderLevel,
    }),
    [
      browseMode,
      viewMode,
      openFolderPath,
      query,
      viewSort,
      sortDirection,
      isTree,
      hasRoots,
      folderLevel,
    ],
  );
  const shelfQuery = useMemo(() => shelfQueryFor(shelfState), [shelfState]);
  const shelfList = useLibraryList(shelfQuery);

  /**
   * The tile or cover the playing song belongs to on this shelf — its album,
   * artist, genre or folder, or the song itself — keyed the way the shelf
   * groups, so a cover and its songs never disagree about which is playing.
   * A song tagged with several genres marks the first: one cover can be the
   * one playing, and the tag's own order keeps the choice stable.
   */
  const playingItemId = useMemo(() => {
    if (!isPlaying || !playingTrack) {
      return undefined;
    }
    switch (browseMode) {
      case 'album':
        return albumKey(playingTrack);
      case 'artist':
        return artistKey(playingTrack);
      case 'genre':
        return trackGenreIds(playingTrack)[0];
      case 'folder':
        return trackFolderPath(playingTrack.path);
      default:
        return playingTrack.id;
    }
  }, [browseMode, isPlaying, playingTrack]);

  return {
    t,
    isIndexLoaded,
    isScanning,
    progress,
    addFolder,
    addFolderPaths,
    rescan,
    forceRescan,
    cancelScan,
    removeRoot,
    roots,
    wasReset,
    trackCount,
    playlists,
    playlistsWereReset,
    playTracks,
    retargetQueue,
    appendToQueue,
    upNext,
    videoTrackId,
    playingTrack,
    isPlaying,
    seek,
    isUpNextCollapsed,
    setIsUpNextCollapsed,
    upNextWidth,
    setUpNextWidth,
    upNextResizeStartRef,
    isResizingUpNext,
    setIsResizingUpNext,
    upNextDraggedToRef,
    isUpNextOverVideo,
    cardRef,
    chromeHeight,
    chromeRef,
    isUpNextDrawer,
    playingMarkId,
    isDragOver,
    setIsDragOver,
    isResetNoticeDismissed,
    setIsResetNoticeDismissed,
    isPlaylistNoticeDismissed,
    setIsPlaylistNoticeDismissed,
    browseMode,
    setBrowseMode,
    viewMode,
    setViewMode,
    sortDirection,
    setSortDirection,
    sort,
    setSort,
    query,
    setQuery,
    setIsSortChosen,
    openFolderPath,
    setOpenFolderPath,
    openAlbumId,
    setOpenAlbumId,
    openArtistId,
    setOpenArtistId,
    openGenreId,
    setOpenGenreId,
    openPlaylistId,
    setOpenPlaylistId,
    drillInDrivenMode,
    revealTrack,
    revealRow,
    karaokeSkippedCount,
    offlineRootIds,
    isSearching,
    viewSort,
    listResetKey,
    shelfState,
    shelfQuery,
    shelfList,
    playingItemId,
  };
};

export type TLibraryWorkspaceShelf = ReturnType<
  typeof useLibraryWorkspaceShelf
>;

export default useLibraryWorkspaceShelf;
