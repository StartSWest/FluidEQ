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
  CSSProperties,
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  albumKey,
  artistKey,
  groupIntoAlbums,
  searchTracks,
  sortTracks,
  isTrackBeneathFolder,
  parentFolderPath,
  trackFolderPath,
} from '../../common/library/grouping';
import { trackGenreIds } from '../../common/library/genres';
import type {
  ILibraryTrack,
  TLibraryBrowseMode,
  TLibrarySort,
  TLibrarySortDirection,
  TLibraryViewMode,
} from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import { useLibrary } from './LibraryContext';
import { usePlaylists } from './PlaylistContext';
import { findPlaylist } from '../../common/library/playlists';
import { useLibraryPlayerSession } from './player/LibraryPlayerContext';
import LibraryVideoStage from './player/LibraryVideoStage';
import LibraryCoverFlow from './LibraryCoverFlow';
import LibraryDetail from './LibraryDetail';
import Spinner from '../icons/Spinner';
import LibraryEmptyState from './LibraryEmptyState';
import LibraryFolderActions from './LibraryFolderActions';
import LibraryGridView from './LibraryGridView';
import LibraryListView from './LibraryListView';
import LibraryScanProgress from './LibraryScanProgress';
import LibraryUpNext, { LibraryUpNextChip, upNextTotal } from './LibraryUpNext';
import KaraokePaneSplitter from '../karaoke/KaraokePaneSplitter';
import LibraryToolbar from './LibraryToolbar';
import { isFolderTree } from './folderTree';
import LibraryVideoSection, { videoFolderGroups } from './LibraryVideoSection';
import '../styles/Library.scss';

/**
 * The most tracks a queue ever holds.
 *
 * The Songs shelf of a real collection is tens of thousands of rows, and a
 * queue is not a copy of the library: handing all of them over means an id
 * array and an index array of that size rebuilt on every view change, and an
 * Up Next panel that answers "what is next" with everything you own.
 *
 * Two hundred is a hundred either side of what is playing — some ten hours
 * ahead, further than anybody listens in a sitting — and it refills itself
 * for free: the effect that re-aims the queue runs on every track change as
 * well as every view change, so the hundred ahead are replenished from the
 * full list as they are used.
 */
const QUEUE_WINDOW = 200;

/**
 * `ids` narrowed to a window around `aroundId`, or `ids` itself when it is
 * already small enough to hold entirely.
 */
const windowedQueueIds = (
  ids: readonly string[],
  aroundId: string | undefined,
): readonly string[] => {
  if (ids.length <= QUEUE_WINDOW) {
    return ids;
  }
  const index = aroundId === undefined ? -1 : ids.indexOf(aroundId);
  if (index === -1) {
    return ids.slice(0, QUEUE_WINDOW);
  }
  const start = Math.max(
    0,
    Math.min(index - Math.floor(QUEUE_WINDOW / 2), ids.length - QUEUE_WINDOW),
  );
  return ids.slice(start, start + QUEUE_WINDOW);
};

/**
 * The card width below which the queue floats over the shelf instead of taking
 * a strip beside it.
 *
 * 900 because the panel is 273 of it: below this the shelf is left under 600px,
 * which is where the track table starts losing Album and most of Artist. The
 * queue is worth a fifth of a wide card and not a third of a narrow one.
 */
const UP_NEXT_FLOAT_WIDTH = 900;

/** The Up Next panel's width, dragged from its own edge. */
const UP_NEXT_WIDTH_KEY = 'fluideq.library.upNextWidth';
const UP_NEXT_MIN = 190;
const UP_NEXT_MAX = 420;

const BROWSE_MODE_KEY = 'fluideq.library.browseMode';
const VIEW_MODE_KEY = 'fluideq.library.viewMode';
const SORT_KEY = 'fluideq.library.sort';
const SORT_DIRECTION_KEY = 'fluideq.library.sortDirection';
const OPEN_ALBUM_KEY = 'fluideq.library.openAlbum';
const OPEN_ARTIST_KEY = 'fluideq.library.openArtist';
const OPEN_GENRE_KEY = 'fluideq.library.openGenre';
const OPEN_FOLDER_KEY = 'fluideq.library.openFolder';
const OPEN_PLAYLIST_KEY = 'fluideq.library.openPlaylist';

const BROWSE_MODES: readonly TLibraryBrowseMode[] = [
  'album',
  'artist',
  'genre',
  'song',
  'folder',
  'video',
  'playlist',
];
const VIEW_MODES: readonly TLibraryViewMode[] = ['list', 'grid', 'coverflow'];
const SORT_DIRECTIONS: readonly TLibrarySortDirection[] = ['asc', 'desc'];

// Every value `TLibrarySort` has, because this list is what a stored sort is
// validated against — a name missing here is a sort that cannot survive a
// restart, silently falling back to Title.
const SORTS: readonly TLibrarySort[] = [
  'title',
  'artist',
  'album',
  'year',
  'added',
  'track',
];

/**
 * A stored mode, validated against the values that actually exist.
 *
 * Same refusal `App.tsx`'s `readWorkspaceTab` applies to a stored tab name: a
 * user-editable value can hold a name an older build wrote that this one no
 * longer has, and trusting it verbatim would put the toolbar in a mode
 * nothing renders.
 */
const readPersistedMode = <T extends string>(
  key: string,
  validValues: readonly T[],
  fallback: T,
): T => {
  try {
    const stored = window.localStorage.getItem(key);
    return validValues.find((value) => value === stored) ?? fallback;
  } catch {
    return fallback;
  }
};

const writePersistedMode = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not worth failing a mode change over.
  }
};

/** For the drill-in ids, which have no fixed set to validate against — an
 * album key is derived from tags and can be any string. An empty stored value
 * reads back as nothing rather than as an id of `''`. */
const readPersistedText = (key: string): string | undefined => {
  try {
    return window.localStorage.getItem(key) || undefined;
  } catch {
    return undefined;
  }
};

const writePersistedText = (key: string, value: string | undefined): void => {
  try {
    if (value === undefined) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, value);
  } catch {
    // Same as above: not worth failing navigation over.
  }
};

interface ILibraryWorkspaceProps {
  /** Hidden instead of unmounted, matching KaraokeWorkspace and VideoBrowser:
   * once a track is playing here, leaving the tab must not stop it. */
  isHidden: boolean;
  /** An album to open, asked for from outside — the now-playing bar pressing
   * "show me what is playing". Carries a nonce rather than an id alone so that
   * asking twice for the SAME album still reopens it after the user has
   * navigated away; an id-only prop would look unchanged and do nothing. */
  revealRequest?: { albumId: string; trackId: string; nonce: number };
  /** Shared fullscreen state owned by App across all three media tabs. */
  isFullScreen: boolean;
  /** Show only the playing art/video beneath an expanded graph. */
  isGraphBackdrop?: boolean;
  onToggleFullScreen: () => void;
}

/**
 * A dropped file's absolute path, resolved the way `KaraokeWorkspace` does.
 *
 * `webUtils.getPathForFile` is the only source of it — `File.path` was
 * removed from Electron. A folder dropped from the OS arrives as a `File`
 * too, with no readable content, so this is exactly as far as the renderer
 * goes: it hands the raw path across and main decides what is a directory.
 */
const droppedFilePath = (file: File): string => {
  try {
    return window.electron?.ipcRenderer.getPathForFile?.(file) ?? '';
  } catch {
    return '';
  }
};

const LibraryWorkspace = ({
  isHidden,
  revealRequest,
  isFullScreen,
  isGraphBackdrop = false,
  onToggleFullScreen,
}: ILibraryWorkspaceProps) => {
  const { t } = useTranslation();
  const {
    index,
    wasReset,
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
  const { playlists, wasReset: playlistsWereReset } = usePlaylists();
  const {
    playTracks,
    retargetQueue,
    appendToQueue,
    upNext,
    videoTrackId,
    track: playingTrack,
    isPlaying,
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
  useEffect(
    () => writePersistedText(UP_NEXT_WIDTH_KEY, String(upNextWidth)),
    [upNextWidth],
  );
  /** The width the drag started from — the splitter reports a delta, not a
   * position, exactly as the karaoke panes' does. */
  const upNextResizeStartRef = useRef(upNextWidth);

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

  const isUpNextFloating =
    isCardNarrow && !isUpNextOverVideo && !isUpNextCollapsed;

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

  const karaokeSkippedCount = index.roots.reduce(
    (total, root) => total + root.karaokeSkipped,
    0,
  );

  // Spec §10: a root missing at rescan is marked offline and its tracks are
  // "kept and dimmed — never deleted". Recomputed only when the roots
  // themselves change, not on every render this workspace has (a scan tick,
  // most of all).
  const offlineRootIds = useMemo(
    () =>
      new Set(
        index.roots.filter((root) => root.isOffline).map((root) => root.id),
      ),
    [index.roots],
  );

  // What `LibraryListView` and `LibraryGridView` (and, later, Cover Flow)
  // actually draw: the toolbar's own query and sort applied once here, so
  // every view is handed the same already-filtered, already-ordered tracks
  // rather than repeating the search/sort logic per view. Memoised because
  // both steps scan and copy every track — `searchTracks` normalises and
  // tests each one, `sortTracks` copies the array and runs `localeCompare`
  // per comparison — and without this, a large library redoes that work on
  // every render this component has, including ones the search box and the
  // sort dropdown had nothing to do with (a drag-over toggle, a scan
  // progress tick).
  /**
   * While a search is running, relevance IS the order.
   *
   * `searchTracks` ranks its hits — best match first — and sorting that by
   * title afterwards throws the ranking away, which is how a search for an
   * artist used to bury them somewhere in four thousand alphabetised results.
   * Clearing the box puts the chosen column back.
   */
  const isSearching = query.trim().length > 0;

  /**
   * THE FOLDER SOMEBODY IS STANDING IN IS WHERE THEY ARE, ON EVERY SHELF.
   *
   * Not a drill-in that belongs to the Folders view: a physical directory is
   * the one thing all four shelves can agree on, so walking into `[Country]`
   * and pressing Albums shows the albums in `[Country]`, Artists the artists
   * in it, Songs its songs. Leaving it is the Back chip, and nothing else
   * moves it — which is why it survives a shelf change and a restart, where
   * an album id would not: the tags can change under it, the path cannot.
   */
  const scopedTracks = useMemo(
    () =>
      openFolderPath === undefined
        ? index.tracks
        : index.tracks.filter((track) =>
            isTrackBeneathFolder(track.path, openFolderPath),
          ),
    [index.tracks, openFolderPath],
  );

  const visibleTracks = useMemo(() => {
    const matches = searchTracks(scopedTracks, query);
    if (!isSearching) {
      return sortTracks(matches, sort, sortDirection);
    }
    // A SHELF OF CONTAINERS SHOWS WHOLE CONTAINERS.
    //
    // The album and artist shelves group whatever they are handed, so handing
    // them the matches alone described every record by the part of it that
    // matched: a five-hundred-track compilation holding two songs by the band
    // searched for was drawn as "Baladas · 2 songs", which is not an album
    // that exists. The same query on an album whose own artist matched showed
    // it whole, so two rows of one shelf were counting different things.
    //
    // Every container with a hit in it is listed, and listed entire. Which
    // songs actually matched is said inside, where `LibraryDetail` lifts them
    // to the head of the table and lights them — the honest division of
    // labour between "what is this" and "why is it here".
    //
    // Songs and videos are not containers and keep the matches themselves.
    if (browseMode === 'song' || browseMode === 'video') {
      return matches;
    }
    // The one shelf whose containers are many-to-many, so it cannot be a
    // single key per track like the others below: a file tagged "Rock; Pop"
    // is in two of them, and keying on the first would drop the whole Pop
    // shelf out of a search that matched a Pop record.
    if (browseMode === 'genre') {
      const hit = new Set(matches.flatMap(trackGenreIds));
      return scopedTracks.filter((track) =>
        trackGenreIds(track).some((id) => hit.has(id)),
      );
    }
    // What "the same container" means on each shelf.
    const containerKeys: Partial<
      Record<TLibraryBrowseMode, (track: ILibraryTrack) => string>
    > = {
      artist: artistKey,
      folder: (track) => trackFolderPath(track.path),
    };
    const keyOf = containerKeys[browseMode] ?? albumKey;
    const hit = new Set(matches.map(keyOf));
    return scopedTracks.filter((track) => hit.has(keyOf(track)));
  }, [scopedTracks, query, isSearching, sort, sortDirection, browseMode]);

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
  // only these four do.
  const listResetKey = `${browseMode}|${query}|${sort}|${sortDirection}`;

  /**
   * A column header was pressed.
   *
   * Pressing the column already sorting reverses it; pressing a different one
   * moves to that column and starts ascending again, rather than inheriting
   * the previous column's direction — carrying a descending order across to a
   * newly chosen column gives an order nobody asked for.
   */
  const handleSort = useCallback((key: TLibrarySort) => {
    // Asking for an order is what ends relevance ranking — see `viewSort`.
    setIsSortChosen(true);
    setSort((currentSort) => {
      setSortDirection((currentDirection) =>
        currentSort === key && currentDirection === 'asc' ? 'desc' : 'asc',
      );
      return key;
    });
  }, []);

  /**
   * The track a browse-mode change should land on.
   *
   * The three grouping ids have nothing in common — an album key is not a
   * path and neither is an artist name — so a mode change cannot translate
   * one into another directly. A track can: it belongs to exactly one album,
   * one artist and one folder, and any of the three ids is derivable from it.
   *
   * Which track, in order:
   *
   * The playing one, whenever it is inside whatever is open. That is the case
   * that matters most — "show me what is playing" opens that song's album,
   * and switching to Folders afterwards must land on the folder that song is
   * in, not on the folder the album's first track happens to sit in; on a
   * compilation those are different directories.
   *
   * Otherwise the first track of whatever is open, which is how an album
   * nothing is playing out of still carries across.
   *
   * And when *nothing* is open, NOTHING. This used to fall back to the playing
   * track, on the reasoning that Songs has no drill-in and would otherwise
   * hand the next shelf nothing at all. What it actually did was move the
   * reader: standing in a list with nothing opened and pressing Tree carried
   * them off to the folder of whatever was coming out of the speakers, which
   * from the outside is a shelf switching to a random album, artist or folder.
   * A press that changes how the library is arranged is not a request to go
   * somewhere, and going to the playing song is what the bar at the foot of
   * the window is for.
   */
  const drillInAnchor = useMemo(() => {
    if (
      openAlbumId === undefined &&
      openArtistId === undefined &&
      openFolderPath === undefined
    ) {
      return undefined;
    }
    const belongs = (track: ILibraryTrack): boolean => {
      if (openAlbumId !== undefined) {
        return albumKey(track) === openAlbumId;
      }
      if (openArtistId !== undefined) {
        return artistKey(track) === openArtistId;
      }
      return trackFolderPath(track.path) === openFolderPath;
    };
    if (playingTrack && belongs(playingTrack)) {
      return playingTrack;
    }
    return index.tracks.find(belongs);
  }, [index.tracks, playingTrack, openAlbumId, openArtistId, openFolderPath]);

  /**
   * A browse chip was pressed.
   *
   * The drill-in comes along. Reading an album and pressing "Folders" used to
   * throw it away and drop the reader at the top of an unrelated list, which
   * is the same loss as closing a book to change the lamp: the mode is how
   * the collection is arranged, not what is being read. So whatever is open
   * is re-derived for the new mode from the anchor above, and only the two
   * modes with nothing to drill into — songs and videos — actually close it.
   *
   * Songs is not left empty-handed, though. It has no drill-in to carry, so
   * what it carries is the row: the list scrolls to the same track and marks
   * it. Its anchor falls back to whatever is playing, because unlike the
   * other three, "the song" is a thing the reader has even when nothing is
   * drilled in at all.
   *
   * Songs takes the first track of whatever was open — the anchor is already
   * that, or the playing song when it happens to be inside it — so switching
   * to it from a folder lands on that folder's first row rather than
   * somewhere else in the library.
   */
  const handleBrowseMode = useCallback(
    (mode: TLibraryBrowseMode) => {
      // WHERE THE READER IS, NEVER WHAT IS PLAYING.
      //
      // Pressing a shelf was made to jump to the playing song and that was
      // wrong: somebody standing in `Cascade Popo` and pressing Tree is asking
      // to see that folder as a tree, not to be carried off to the folder of
      // whatever happens to be coming out of the speakers. The bar at the foot
      // of the window is what goes to what is playing, and it already does.
      const anchor = drillInAnchor;
      setOpenAlbumId(anchor && mode === 'album' ? albumKey(anchor) : undefined);
      setOpenArtistId(
        anchor && mode === 'artist' ? artistKey(anchor) : undefined,
      );
      // Nothing is re-derived for the Playlists shelf. The other three modes
      // can carry a drill-in across because the album, artist and folder an
      // anchoring track belongs to are all facts about that track; which
      // playlist it "belongs to" is not — it may be in none of them or in
      // four. So this shelf always opens at the top.
      setOpenPlaylistId(undefined);
      // The folder is not touched. It is not this shelf's drill-in, it is
      // where the reader is standing — see `scopedTracks` — and a shelf
      // change is a change of arrangement, not of place. Re-derived from the
      // anchor it also vanished outright whenever the folder held only
      // folders, because there is no track in one for the anchor to be.
      if (mode === 'folder' && openFolderPath === undefined && anchor) {
        setOpenFolderPath(trackFolderPath(anchor.path));
      }
      if (mode === 'song' && anchor) {
        // The first track of what was open, and only that. It fell back to the
        // playing song, which is the same move as the anchor's old fallback
        // and the same complaint: a list that scrolled itself somewhere the
        // reader had not been.
        revealRow(anchor.id);
      }
      // The effect below closes the drill-in on every mode change it did not
      // cause itself; this is one it did not cause but must not undo.
      drillInDrivenMode.current = mode;
      setBrowseMode(mode);
    },
    [drillInAnchor, openFolderPath, revealRow],
  );

  const handleOpenFolder = useCallback((folderPath: string) => {
    setOpenAlbumId(undefined);
    setOpenArtistId(undefined);
    setOpenGenreId(undefined);
    setOpenFolderPath(folderPath);
  }, []);

  const handleOpenPlaylist = useCallback((playlistId: string) => {
    setOpenAlbumId(undefined);
    setOpenArtistId(undefined);
    setOpenGenreId(undefined);
    setOpenPlaylistId(playlistId);
  }, []);

  /** Cover Flow opened or closed its own panel. The drill-in is one piece of
   * state shared by all three views, so changing view keeps whatever was open
   * instead of each view remembering something different. */
  const handleCoverFlowOpen = useCallback(
    (openId: string | undefined) => {
      if (browseMode === 'artist') {
        setOpenArtistId(openId);
        return;
      }
      if (browseMode === 'genre') {
        setOpenGenreId(openId);
        return;
      }
      if (browseMode === 'folder') {
        setOpenFolderPath(openId);
        return;
      }
      if (browseMode === 'playlist') {
        setOpenPlaylistId(openId);
        return;
      }
      setOpenAlbumId(openId);
    },
    [browseMode],
  );

  /**
   * A drill-in is open, so the list the toolbar steers is not the thing on
   * screen.
   *
   * A folder counts only on the Folders shelf. Everywhere else it is not a
   * drill-in at all: it is where the reader is standing, and the shelf goes
   * on drawing albums or artists — the ones inside it. See `scopedTracks`.
   */
  const isDrilledIn = Boolean(
    openAlbumId ||
    openArtistId ||
    // Gated on its own shelf for the same reason the playlist below is: the
    // two ids are restored from storage independently at launch, and a stale
    // genre would otherwise open over the Albums shelf.
    (openGenreId !== undefined && browseMode === 'genre') ||
    // Gated on its own shelf, the way the folder below is. Nothing should be
    // able to leave a playlist open while albums are being browsed — both the
    // chip handler and the mode effect clear it — but the two values are
    // restored from storage independently at launch, and a stale pair would
    // otherwise put a playlist on the Albums shelf.
    (openPlaylistId !== undefined && browseMode === 'playlist') ||
    (openFolderPath !== undefined && browseMode === 'folder'),
  );

  /**
   * Searching leaves wherever you were standing.
   *
   * This box says "search songs, artists, albums" and means the library, not
   * the folder somebody happens to be inside — typing in it from three levels
   * down returned the four matches in that directory and looked like a
   * library with almost nothing in it. So the first non-empty query steps
   * back out to the root and closes any drill-in with it, and what comes back
   * is everything that matched, anywhere.
   *
   * It does not put them back when the box is cleared. Coming out of a search
   * lands at the top of the library, which is where the search itself was
   * looking from; restoring a place they had left would be a second surprise
   * after the first.
   */
  const handleQuery = useCallback((next: string) => {
    setQuery(next);
    // A new search hands the ranking back to relevance — see `viewSort`.
    setIsSortChosen(false);
    if (next.trim().length === 0) {
      return;
    }
    setOpenAlbumId(undefined);
    setOpenArtistId(undefined);
    setOpenGenreId(undefined);
    setOpenPlaylistId(undefined);
    setOpenFolderPath(undefined);
  }, []);

  /** The toolbar's arrow: reverses whatever column is already chosen. The
   * dropdown beside it picks the column and leaves the direction alone, so
   * the two together say the same thing a header click says in one press. */
  const handleSortDirection = useCallback(() => {
    setIsSortChosen(true);
    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
  }, []);

  /** The bar's dropdown: names a column and nothing else. Direction is the
   * arrow beside it, which is why this does not toggle one — unlike
   * `handleSort`, where the header press IS both. */
  const handlePickSort = useCallback((key: TLibrarySort) => {
    setIsSortChosen(true);
    setSort(key);
  }, []);

  // Opening one closes the other — only one drill-in is ever on screen.
  // Stable identities, all three. A fresh closure each render is a changed
  // prop, a changed prop defeats the rows' own `memo`, and every row in the
  // list then re-renders for a state change none of them care about — which
  // during a scan is several times a second.
  const handleOpenAlbum = useCallback((albumId: string) => {
    setOpenArtistId(undefined);
    setOpenGenreId(undefined);
    setOpenAlbumId(albumId);
  }, []);
  const handleOpenArtist = useCallback((artistId: string) => {
    setOpenAlbumId(undefined);
    setOpenGenreId(undefined);
    setOpenArtistId(artistId);
  }, []);
  const handleOpenGenre = useCallback((genreId: string) => {
    setOpenAlbumId(undefined);
    setOpenArtistId(undefined);
    setOpenGenreId(genreId);
  }, []);
  const handleBack = useCallback(() => {
    setOpenAlbumId(undefined);
    setOpenArtistId(undefined);
    setOpenGenreId(undefined);
    setOpenPlaylistId(undefined);
    // Up one level, where there is one above and the tree is what is being
    // walked: back out of `Artist/Album` in a file manager is `Artist`, not
    // the shelf you came in from. At a root there is nothing above that this
    // library knows anything about, so there it closes as it always did.
    setOpenFolderPath((current) =>
      current && isFolderTree()
        ? parentFolderPath(current, index.roots)
        : undefined,
    );
  }, [index.roots]);
  // The queue a click hands to `playTracks`: whatever list the surface the
  // click came from is actually showing, so the order the bar plays through
  // matches the order on screen — mirroring `LibraryDetail`'s own
  // `detailTracks` (the *whole* album or artist, never narrowed by the
  // search box that got you there — see its own comment) and
  // `LibraryVideoSection`'s own folder groups exactly, rather than always
  // falling back to the flat browse list. Walks the whole library the same
  // way those two already do, so it is memoised the same way: on the track
  // list and the id actually open, not on every render this workspace has.
  const queueTrackIds = useMemo(() => {
    if (openPlaylistId && browseMode === 'playlist') {
      // The playlist's own order, and only the songs the library can
      // currently resolve — an id whose drive is unplugged is not a track the
      // player can be handed. `LibraryDetail` filters the same way for the
      // table, so the queue matches what is on screen.
      const known = new Set(index.tracks.map((track) => track.id));
      return (
        findPlaylist(playlists, openPlaylistId)?.trackIds.filter((id) =>
          known.has(id),
        ) ?? []
      );
    }
    if (openAlbumId) {
      return (
        groupIntoAlbums(index.tracks).find((album) => album.id === openAlbumId)
          ?.trackIds ?? []
      );
    }
    if (openArtistId) {
      return sortTracks(
        index.tracks.filter((track) => artistKey(track) === openArtistId),
        'album',
      ).map((track) => track.id);
    }
    // The genre shelf's own list, by album — the same order and the same
    // membership rule `LibraryDetail` lists it with. `trackGenreIds` rather
    // than a compare on `track.genre`: a file tagged "Rock; Pop" is on both
    // shelves, and a queue built by string equality would play neither.
    if (openGenreId !== undefined && browseMode === 'genre') {
      return sortTracks(
        index.tracks.filter((track) =>
          trackGenreIds(track).includes(openGenreId),
        ),
        'album',
      ).map((track) => track.id);
    }
    // The folder that is open, exactly as its panel lists it: its own files,
    // in path order, and not the ones in the folders below it. Without this
    // branch a folder drill-in fell through to the shelf, so Next from the
    // third song of an album went to whatever the shelf happened to hold
    // next — the one drill-in of the three that did not carry its own queue.
    if (openFolderPath !== undefined && browseMode === 'folder') {
      return index.tracks
        .filter((track) => trackFolderPath(track.path) === openFolderPath)
        .sort((left, right) => left.path.localeCompare(right.path))
        .map((track) => track.id);
    }
    if (browseMode === 'video') {
      return videoFolderGroups(visibleTracks).flatMap((group) =>
        group.tracks.map((track) => track.id),
      );
    }
    return visibleTracks.map((track) => track.id);
  }, [
    index.tracks,
    openAlbumId,
    openArtistId,
    openGenreId,
    openPlaylistId,
    playlists,
    openFolderPath,
    browseMode,
    visibleTracks,
  ]);

  // The one real destination every view's click hands off to. A track this
  // build cannot decode (`isPlayable === false`) is still handed to
  // `playTracks` rather than swallowed here — `LibraryPlayerContext` loads it,
  // marks it unplayable and `NowPlayingBar` says so with a disabled Play
  // button, which is the honest answer to a click that cannot do anything:
  // visible feedback, not a silent no-op.
  /**
   * A QUEUE OF ONE IS NOT A QUEUE, AND IT FAILS SILENTLY.
   *
   * `advanceQueue` clamps at both ends, so a queue holding a single track
   * answers Next and Previous with nothing at all — no stumble, no message —
   * and the end of that track is the end of the queue, which arrives as "it
   * does not play the next song". One bug, both reports.
   *
   * Two ways in, and the album shelf is the one that survived the first fix.
   * The obvious one is the fallback below: `queueTrackIds` follows what is
   * OPEN rather than where the click came from, so a drill-in left open from
   * the last session made the guard fail for a row clicked anywhere else, and
   * the old code went straight to `[trackId]`.
   *
   * The other is an open drill-in that really does hold one track, which is
   * ordinary rather than exotic: `groupIntoAlbums` keys on the tags, so a
   * folder of loose or inconsistently tagged files is a shelf of one-track
   * albums. The clicked song IS in that list, the guard passes, and the queue
   * is one long anyway. So the test is not "is it in there" but "is there
   * anything to move to" — and where there is not, what is on screen is a
   * real queue and a better answer.
   *
   * `[trackId]` is left for what it was written for: a song that is in no
   * list here at all.
   */
  /** What is on screen, as ids — the fallback queue, and what a view change
   * re-aims the player at. */
  const visibleTrackIds = useMemo(
    () => visibleTracks.map((track) => track.id),
    [visibleTracks],
  );

  /**
   * The list Next should walk from wherever the reader is standing now.
   *
   * The drill-in's own list when it has somewhere to go, and what is on
   * screen otherwise — a one-entry album is not a queue, whatever the tags
   * say about it.
   */
  const viewQueueIds = useMemo(
    () => (queueTrackIds.length > 1 ? queueTrackIds : visibleTrackIds),
    [queueTrackIds, visibleTrackIds],
  );

  /**
   * Changing the view changes what plays next.
   *
   * The same files group differently on every shelf, so the album that
   * follows this song is not the folder that follows it and neither is what
   * the Songs list has next. Leaving the queue frozen at whatever was open
   * when Play was pressed made Next answer for a screen the reader had left.
   *
   * Nothing restarts: `retargetQueue` keeps the playing track and its place,
   * and does nothing at all when that track is not in the new list.
   *
   * Gated on something being loaded, which is what keeps this cheap on a big
   * library. The Songs shelf of a ten-thousand-track collection rebuilds a
   * ten-thousand-entry order, and `visibleTracks` changes on every keystroke
   * of a search — so with nothing playing there is nothing to re-aim and the
   * work is skipped outright. What the queue holds is ids and indices rather
   * than tracks, and `retargetQueue` returns the existing queue untouched
   * when the list comes back the same, so the only real rebuild is a view
   * that actually changed under a song that is actually playing.
   */
  useEffect(() => {
    if (!playingTrack) {
      return;
    }
    retargetQueue(windowedQueueIds(viewQueueIds, playingTrack.id));
  }, [playingTrack, retargetQueue, viewQueueIds]);

  /**
   * How much of the shelf is still to come that the queue has NOT got.
   *
   * The queue never holds more than `QUEUE_WINDOW`, and the effect above
   * slides that window along on every track change, so a shelf far longer
   * than the window still plays through to its end. The panel counts the rows
   * it has, which is the window; this is the rest, and `upNextTotal` adds the
   * two.
   *
   * Which is why what the queue already holds is subtracted here rather than
   * counted twice. Adding a thirteen-song folder to the picks promotes those
   * files into the queue — they are still on the shelf, so a plain
   * "everything after the playhead" counted each of them once as a pick and
   * again as the folder's remainder, and thirteen songs read as "13 / 25".
   *
   * `undefined` when the playing track is not on this shelf at all — then the
   * queue is its own list and its rows are the whole honest count.
   */
  const upNextRestTotal = useMemo(() => {
    if (!playingTrack) {
      return undefined;
    }
    const at = viewQueueIds.indexOf(playingTrack.id);
    if (at === -1) {
      return undefined;
    }
    const held = new Set(upNext.map((entry) => entry.trackId));
    let rest = 0;
    for (let index = at + 1; index < viewQueueIds.length; index += 1) {
      if (!held.has(viewQueueIds[index])) {
        rest += 1;
      }
    }
    return rest;
  }, [playingTrack, viewQueueIds, upNext]);

  const handlePlayTrack = useCallback(
    (trackId: string) => {
      playTracks(
        viewQueueIds.includes(trackId)
          ? windowedQueueIds(viewQueueIds, trackId)
          : [trackId],
        trackId,
      );
    },
    [viewQueueIds, playTracks],
  );

  const handleAddFolder = () => {
    addFolder().catch(() => undefined);
  };

  const handleRescan = () => {
    rescan().catch(() => undefined);
  };

  const handleForceRescan = () => {
    forceRescan().catch(() => undefined);
  };

  const handleRemoveRoot = (rootId: string) => {
    removeRoot(rootId).catch(() => undefined);
  };

  const onDragOver = (event: DragEvent<HTMLElement>) => {
    // Required for the element to accept the drop at all; the browser refuses
    // by default.
    event.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const paths = Array.from(event.dataTransfer.files)
      .map(droppedFilePath)
      .filter((path): path is string => path.length > 0);
    if (paths.length) {
      addFolderPaths(paths).catch(() => undefined);
    }
  };

  // Audio tracks live entirely in LibraryPlayerProvider's detached decks.
  // With no video element to preserve, an off-tab library needs no workspace
  // DOM at all; its engine and transport remain above this component.
  if (isHidden && !videoTrackId) {
    return null;
  }

  return (
    <section
      className={`library-workspace workspace-tab-panel workspace-tab-panel--library${
        isHidden ? ' is-hidden' : ''
      }${
        isGraphBackdrop ? ' is-playback-backdrop' : ''
      }${isDragOver ? ' is-drag-over' : ''}${
        // Only while the panel is actually drawn. The class reserves the
        // column the panel stands in — folded there is no panel and no strip,
        // and leaving it on left a third of the tab empty with the shelf
        // squeezed into what was left.
        //
        // A VIDEO IS NOT AN EXCEPTION TO IT. It used to be: the picture kept
        // the whole tab and the queue was laid on top of its right-hand edge,
        // which is not what this app does anywhere else. Karaoke puts its
        // playlist BESIDE the stage and takes the width out of it, and so does
        // every player worth copying — a list over the picture hides part of
        // what is playing and puts the two things in one rectangle. The strip
        // is reserved here as well now, and the picture is the width that is
        // left over.
        !isUpNextCollapsed ? ' has-up-next' : ''
      }${isUpNextOverVideo ? ' has-video' : ''}${
        isUpNextFloating ? ' has-up-next-floating' : ''
      }`}
      ref={cardRef}
      aria-label={t('tabs.library')}
      aria-hidden={isHidden}
      // The one number both the panel and the strip it stands in are sized
      // from, so the two cannot disagree about how much of the tab is spoken
      // for.
      style={
        {
          '--up-next-width': `${upNextWidth}px`,
          // What the drawer has to clear. Zero until the row is measured,
          // which only matters for the first frame of a floating queue.
          '--library-chrome-height': `${chromeHeight}px`,
        } as CSSProperties
      }
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Fixed in the tree so hiding the workspace never remounts a playing
          video. Hidden mode leaves only this media engine and its wrapper;
          every library shelf and control below is unmounted. */}
      {videoTrackId && (
        <LibraryVideoStage
          isHidden={isHidden}
          isFullScreen={isFullScreen}
          onToggleFullScreen={onToggleFullScreen}
        />
      )}
      {!isHidden && (
        <>
          {/* A library that silently emptied itself after a bad shutdown is the
          worst version of this failure — surfaced once, dismissibly, rather
          than folded into the empty state below where it would read as
          nothing had ever been added. */}
          {wasReset && !isResetNoticeDismissed && (
            <div className="library-workspace__notice" role="status">
              <span>{t('library.indexReset')}</span>
              <button
                type="button"
                aria-label={t('app.dismiss')}
                onClick={() => setIsResetNoticeDismissed(true)}
              >
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M3 3l6 6M9 3l-6 6" />
                </svg>
              </button>
            </div>
          )}
          {/* Its own notice rather than a line in the one above, and worth more
          than that one is: a rescan puts the songs back, and nothing puts
          back a playlist. This is the only moment it can be said. */}
          {playlistsWereReset && !isPlaylistNoticeDismissed && (
            <div className="library-workspace__notice" role="status">
              <span>{t('library.playlist.reset')}</span>
              <button
                type="button"
                aria-label={t('app.dismiss')}
                onClick={() => setIsPlaylistNoticeDismissed(true)}
              >
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M3 3l6 6M9 3l-6 6" />
                </svg>
              </button>
            </div>
          )}
          {/* An empty library has exactly one useful next step, and the empty
          state below is the whole screen for it — a toolbar of browse/view/
          sort/search controls with nothing yet to act on, beside a second
          "Add folder" button, undercuts that. Once a root exists there is
          something to steer and something else worth adding, so the row
          appears from then on.

          AND NOT OVER A VIDEO. Every shelf below is already withheld while
          one plays — the picture is meant to have the whole tab, which is
          what the queue's own placement assumes (`has-video` floats it on
          the picture instead of taking a strip out of the shelf) and what
          the chip assumes when it moves out of this row and onto the
          picture. This row was the one child that never got the same gate,
          so it stayed at the foot of the tab under the video: browse, view,
          sort and search controls steering a shelf that is not on screen,
          holding 41px the picture should have had, and standing exactly
          where the queue's own last rows land — the panel runs to the foot
          of the card, so its end was drawn behind these controls. */}
          {!videoTrackId && index.roots.length > 0 && (
            <div className="library-toolbar-row" ref={chromeRef}>
              <LibraryToolbar
                browseMode={browseMode}
                viewMode={viewMode}
                sort={sort}
                sortDirection={sortDirection}
                onBrowseMode={handleBrowseMode}
                onViewMode={setViewMode}
                // Withheld while a drill-in is open, because this control orders
                // the SHELF and a drill-in replaces the shelf — the bar would be
                // steering a list that is not on screen, and the panel's own
                // headers order the panel.
                //
                // Cover flow is the exception, and the reason is literal: its
                // panel opens UNDER the row rather than instead of it, so the
                // carousel this reorders is still there to watch reorder.
                onSort={
                  isDrilledIn && viewMode !== 'coverflow'
                    ? undefined
                    : handlePickSort
                }
                onSortDirection={
                  isDrilledIn && viewMode !== 'coverflow'
                    ? undefined
                    : handleSortDirection
                }
                query={query}
                onQuery={handleQuery}
              />
              {/* ONE CLUSTER, AND IT NEVER BREAKS UP. The folder controls were
              separate children of this row, so when the bar ran out of width
              they wrapped one at a time and turned up on lines of their own
              under the search box. Bound together they travel as a unit and
              stay where the eye goes looking for them: the top right. */}
              <div className="library-toolbar__tail">
                <LibraryFolderActions
                  roots={index.roots}
                  isScanning={isScanning}
                  onAddFolder={handleAddFolder}
                  onRescan={handleRescan}
                  onForceRescan={handleForceRescan}
                  onRemoveRoot={handleRemoveRoot}
                />
                {/* IN THE ROW, AND IN BOTH STATES.
                It stood under the row before, in the slot the panel opens
                into, to stop the cluster re-laying itself out when the queue
                opened. Mounted here in both states there is nothing to
                re-lay: the chip keeps its place and only lights up, and the
                panel starts below this row at every width — see
                `.library-workspace.has-up-next`, which exempts
                `.library-toolbar-row` from the strip the queue takes. What
                the old position cost was a shelf pushed down 23px and a
                folder path truncated early to clear a chip floating over
                them both.

                Not over a video: there the picture takes the whole tab and
                this row is not drawn at all, so the chip floats — see
                `library-up-next__chip--over-video` below. */}
                {!isUpNextOverVideo && (
                  <LibraryUpNextChip
                    isOpen={!isUpNextCollapsed}
                    count={upNextTotal(upNext, upNextRestTotal)}
                    onToggle={() => setIsUpNextCollapsed((open) => !open)}
                  />
                )}
              </div>
            </div>
          )}
          {/* Pinned under the toolbar rather than a modal: the scan is
          backgroundable simply by leaving the tab, which only works if
          nothing here blocks the rest of the workspace. */}
          {isScanning && progress && (
            <LibraryScanProgress progress={progress} onCancel={cancelScan} />
          )}
          {/* Only once the index has actually been read. It starts empty and is
          filled by a reply a moment later, so gated on the count alone this
          panel greeted everybody with a library every time they opened the
          tab — "no music yet" over a library of fourteen thousand songs. */}
          {isIndexLoaded && index.tracks.length === 0 && (
            <LibraryEmptyState
              karaokeSkippedCount={karaokeSkippedCount}
              onAddFolder={handleAddFolder}
            />
          )}
          {!isIndexLoaded && (
            <div className="library-loading" role="status">
              <Spinner />
            </div>
          )}
          {/* A second Back used to stand here, on the shelves that are not the
          tree, naming the folder the albums below belonged to.

          Two of them on screen at once is one too many, and they did not do
          the same thing: this one walked up the tree while the drill-in's own
          went back to the shelf, so which you got depended on which line you
          happened to aim at. There is one Back now — the drill-in's — and it
          carries the directory beside it, so where the reader is standing is
          said once, on the control that leaves it. */}
          {/* Videos have no album or artist to drill into — routed here on its
          own rather than through the three views below, which never see
          `browseMode === 'video'` at all. The view-mode toggle (list/grid/
          Cover Flow) has nothing to say about a shelf grouped by folder, so
          it is ignored while this is what is browsed. */}
          {index.tracks.length > 0 &&
            !videoTrackId &&
            browseMode === 'video' && (
              <LibraryVideoSection
                tracks={visibleTracks}
                onPlayTrack={handlePlayTrack}
                offlineRootIds={offlineRootIds}
              />
            )}
          {/* The drill-in behind whichever tile, row or cover was opened, in
          place of the browse view below rather than over it — search and
          sort still apply to what got you here, but the album or artist
          itself is shown whole, not narrowed further by a query that was
          for finding it in the first place. */}
          {/* Not in Cover Flow: that view renders this very component itself,
          underneath its row, from the same `openAlbumId`. Rendering it here
          as well put the same album on the screen twice, one above the
          carousel and one below it. */}
          {index.tracks.length > 0 &&
            !videoTrackId &&
            browseMode !== 'video' &&
            viewMode !== 'coverflow' &&
            isDrilledIn && (
              <LibraryDetail
                tracks={index.tracks}
                albumId={openAlbumId}
                artistId={openArtistId}
                genreId={browseMode === 'genre' ? openGenreId : undefined}
                // Only the Folders shelf draws a folder as a panel. On the other
                // three the same folder is the place the shelf is being read in,
                // and the panel would be a second answer to a question the list
                // below is already answering.
                folderPath={
                  browseMode === 'folder' ? openFolderPath : undefined
                }
                playlistId={
                  browseMode === 'playlist' ? openPlaylistId : undefined
                }
                onBack={handleBack}
                onPlayTrack={handlePlayTrack}
                onQueueTracks={appendToQueue}
                offlineRootIds={offlineRootIds}
                folderRoots={index.roots}
                onOpenFolder={handleOpenFolder}
                viewMode={viewMode}
                playingTrackId={playingMarkId}
                revealTrack={revealTrack}
                query={query}
              />
            )}
          {index.tracks.length > 0 &&
            !videoTrackId &&
            browseMode !== 'video' &&
            !isDrilledIn &&
            viewMode === 'list' && (
              <LibraryListView
                tracks={visibleTracks}
                browseMode={browseMode}
                onOpenAlbum={handleOpenAlbum}
                onOpenArtist={handleOpenArtist}
                onOpenGenre={handleOpenGenre}
                onOpenFolder={handleOpenFolder}
                onOpenPlaylist={handleOpenPlaylist}
                onPlayTrack={handlePlayTrack}
                // The Songs shelf has no drill-in header to queue from, so the
                // row menu is the only way into the queue here at all.
                onQueueTracks={appendToQueue}
                offlineRootIds={offlineRootIds}
                folderRoots={index.roots}
                isSearching={isSearching}
                sort={viewSort}
                sortDirection={sortDirection}
                onSort={handleSort}
                // The Songs shelf is a flat run of everything, and the folder a
                // file came from is the only structure it has left — so it is
                // always shown here. It was a toggle, which meant the shelf
                // shipped without its structure and the reader had to know to ask
                // for it. The drill-in's own track list does NOT get this: an
                // album is one folder, and a heading over its twelve songs names
                // what the header above them already says.
                groupByFolder
                playingTrackId={playingMarkId}
                revealTrack={revealTrack}
                resetKey={listResetKey}
              />
            )}
          {index.tracks.length > 0 &&
            !videoTrackId &&
            browseMode !== 'video' &&
            !isDrilledIn &&
            viewMode === 'grid' && (
              <LibraryGridView
                tracks={visibleTracks}
                browseMode={browseMode}
                onOpenAlbum={handleOpenAlbum}
                onOpenArtist={handleOpenArtist}
                onOpenGenre={handleOpenGenre}
                onOpenFolder={handleOpenFolder}
                onOpenPlaylist={handleOpenPlaylist}
                onPlayTrack={handlePlayTrack}
                offlineRootIds={offlineRootIds}
                folderRoots={index.roots}
                isSearching={isSearching}
                sort={viewSort}
                sortDirection={sortDirection}
                playingTrackId={playingMarkId}
                revealTrack={revealTrack}
                resetKey={listResetKey}
              />
            )}
          {/* Not gated on `isDrilledIn` like the other two: this view shows the
          drill-in itself, under its own row. Switching to it from an open
          album carries that album across -- `openId` centres it and opens it
          -- rather than dropping the reader at the top of an unrelated
          carousel with what they were reading closed. */}
          {index.tracks.length > 0 &&
            !videoTrackId &&
            browseMode !== 'video' &&
            viewMode === 'coverflow' && (
              <LibraryCoverFlow
                tracks={visibleTracks}
                browseMode={browseMode}
                onPlayTrack={handlePlayTrack}
                sort={viewSort}
                sortDirection={sortDirection}
                folderRoots={index.roots}
                isSearching={isSearching}
                playingTrackId={playingMarkId}
                revealTrack={revealTrack}
                openId={
                  openAlbumId ??
                  openArtistId ??
                  openGenreId ??
                  openPlaylistId ??
                  openFolderPath
                }
                onOpenChange={handleCoverFlowOpen}
                onQueueTracks={appendToQueue}
                query={query}
              />
            )}
          {/* Last, and outside every view above: the queue belongs to the tab
          rather than to whichever shelf is drawing it. On a shelf it stands
          in the strip `has-up-next` reserves; over a video it floats on the
          picture, full screen included — `has-video` is what moves it. */}
          {!isUpNextCollapsed && (
            <LibraryUpNext
              isCollapsed={isUpNextCollapsed}
              onCollapsedChange={setIsUpNextCollapsed}
              restTotal={upNextRestTotal}
            />
          )}
          {/* OVER A VIDEO ONLY. The picture takes the whole tab and the toolbar
          row that holds the chip everywhere else is not drawn, so here it
          floats — a little below the top, clear of the picture's own Back and
          full-screen buttons, which hold the two corners. */}
          {isUpNextCollapsed && isUpNextOverVideo && (
            <LibraryUpNextChip
              className="library-up-next__chip--over-video"
              isOpen={false}
              count={upNextTotal(upNext, upNextRestTotal)}
              onToggle={() => setIsUpNextCollapsed(false)}
            />
          )}
          {/* The same splitter the karaoke panes are divided by, not a strip of
          this tab's own. Dragging left widens the queue, which is why the
          delta is subtracted: the panel is anchored to the right edge and
          grows towards the pointer. */}
          {!isUpNextCollapsed && (
            <div className="library-up-next__splitter">
              <KaraokePaneSplitter
                orientation="vertical"
                ariaLabel={t('library.upNext')}
                valuePercent={
                  ((upNextWidth - UP_NEXT_MIN) / (UP_NEXT_MAX - UP_NEXT_MIN)) *
                  100
                }
                onStart={() => {
                  upNextResizeStartRef.current = upNextWidth;
                }}
                onDrag={(delta) =>
                  setUpNextWidth(
                    Math.min(
                      UP_NEXT_MAX,
                      Math.max(
                        UP_NEXT_MIN,
                        upNextResizeStartRef.current - delta,
                      ),
                    ),
                  )
                }
                onEnd={() => undefined}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default LibraryWorkspace;
