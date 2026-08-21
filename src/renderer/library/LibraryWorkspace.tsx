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
import type {
  ILibraryTrack,
  TLibraryBrowseMode,
  TLibrarySort,
  TLibrarySortDirection,
  TLibraryViewMode,
} from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import { useLibrary } from './LibraryContext';
import { useLibraryPlayer } from './player/LibraryPlayerContext';
import LibraryVideoStage from './player/LibraryVideoStage';
import LibraryCoverFlow from './LibraryCoverFlow';
import LibraryDetail from './LibraryDetail';
import Spinner from '../icons/Spinner';
import LibraryEmptyState from './LibraryEmptyState';
import LibraryFolderActions from './LibraryFolderActions';
import LibraryGridView from './LibraryGridView';
import LibraryListView from './LibraryListView';
import LibraryScanProgress from './LibraryScanProgress';
import MenuIcon from '../icons/MenuIcon';
import LibraryToolbar from './LibraryToolbar';
import { isFolderTree } from './folderTree';
import LibraryVideoSection, { videoFolderGroups } from './LibraryVideoSection';
import '../styles/Library.scss';

const BROWSE_MODE_KEY = 'fluideq.library.browseMode';
const VIEW_MODE_KEY = 'fluideq.library.viewMode';
const SORT_KEY = 'fluideq.library.sort';
const SORT_DIRECTION_KEY = 'fluideq.library.sortDirection';
const GROUP_BY_FOLDER_KEY = 'fluideq.library.groupByFolder';
const OPEN_ALBUM_KEY = 'fluideq.library.openAlbum';
const OPEN_ARTIST_KEY = 'fluideq.library.openArtist';
const OPEN_FOLDER_KEY = 'fluideq.library.openFolder';

const BROWSE_MODES: readonly TLibraryBrowseMode[] = [
  'album',
  'artist',
  'song',
  'folder',
  'video',
];
const VIEW_MODES: readonly TLibraryViewMode[] = ['list', 'grid', 'coverflow'];
const SORT_DIRECTIONS: readonly TLibrarySortDirection[] = ['asc', 'desc'];

const SORTS: readonly TLibrarySort[] = [
  'title',
  'artist',
  'album',
  'year',
  'added',
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
  const {
    playTracks,
    videoTrackId,
    track: playingTrack,
    isPlaying,
  } = useLibraryPlayer();

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
  // Labels each run of rows with the folder it came from. Off by default:
  // most browsing is by album, where the folder is noise.
  const [groupByFolder, setGroupByFolder] = useState<boolean>(
    () => readPersistedMode(GROUP_BY_FOLDER_KEY, ['on', 'off'], 'off') === 'on',
  );
  useEffect(
    () => writePersistedMode(GROUP_BY_FOLDER_KEY, groupByFolder ? 'on' : 'off'),
    [groupByFolder],
  );
  const [sort, setSort] = useState<TLibrarySort>(() =>
    readPersistedMode(SORT_KEY, SORTS, 'title'),
  );
  const [query, setQuery] = useState('');

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

  useEffect(
    () => writePersistedText(OPEN_ALBUM_KEY, openAlbumId),
    [openAlbumId],
  );
  useEffect(
    () => writePersistedText(OPEN_ARTIST_KEY, openArtistId),
    [openArtistId],
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
    return isSearching ? matches : sortTracks(matches, sort, sortDirection);
  }, [scopedTracks, query, isSearching, sort, sortDirection]);

  /** The order to hand the views: nothing while searching, which every one of
   * them already reads as "leave this order alone" — the same meaning
   * `LibraryDetail` gives an unset sort for an album's own track listing. */
  const viewSort = isSearching ? undefined : sort;

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
    setOpenFolderPath(folderPath);
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
      if (browseMode === 'folder') {
        setOpenFolderPath(openId);
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
    (openFolderPath !== undefined && browseMode === 'folder'),
  );

  /** The toolbar's arrow: reverses whatever column is already chosen. The
   * dropdown beside it picks the column and leaves the direction alone, so
   * the two together say the same thing a header click says in one press. */
  const handleSortDirection = useCallback(() => {
    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
  }, []);

  // Opening one closes the other — only one drill-in is ever on screen.
  // Stable identities, all three. A fresh closure each render is a changed
  // prop, a changed prop defeats the rows' own `memo`, and every row in the
  // list then re-renders for a state change none of them care about — which
  // during a scan is several times a second.
  const handleOpenAlbum = useCallback((albumId: string) => {
    setOpenArtistId(undefined);
    setOpenAlbumId(albumId);
  }, []);
  const handleOpenArtist = useCallback((artistId: string) => {
    setOpenAlbumId(undefined);
    setOpenArtistId(artistId);
  }, []);
  const handleBack = useCallback(() => {
    setOpenAlbumId(undefined);
    setOpenArtistId(undefined);
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
    if (browseMode === 'video') {
      return videoFolderGroups(visibleTracks).flatMap((group) =>
        group.tracks.map((track) => track.id),
      );
    }
    return visibleTracks.map((track) => track.id);
  }, [index.tracks, openAlbumId, openArtistId, browseMode, visibleTracks]);

  // The one real destination every view's click hands off to. A track this
  // build cannot decode (`isPlayable === false`) is still handed to
  // `playTracks` rather than swallowed here — `LibraryPlayerContext` loads it,
  // marks it unplayable and `NowPlayingBar` says so with a disabled Play
  // button, which is the honest answer to a click that cannot do anything:
  // visible feedback, not a silent no-op.
  const handlePlayTrack = useCallback(
    (trackId: string) => {
      playTracks(
        queueTrackIds.includes(trackId) ? queueTrackIds : [trackId],
        trackId,
      );
    },
    [queueTrackIds, playTracks],
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

  return (
    <section
      className={`library-workspace workspace-tab-panel workspace-tab-panel--library${
        isHidden ? ' is-hidden' : ''
      }${isDragOver ? ' is-drag-over' : ''}`}
      aria-label={t('tabs.library')}
      aria-hidden={isHidden}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
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
      {/* An empty library has exactly one useful next step, and the empty
          state below is the whole screen for it — a toolbar of browse/view/
          sort/search controls with nothing yet to act on, beside a second
          "Add folder" button, undercuts that. Once a root exists there is
          something to steer and something else worth adding, so the row
          appears from then on. */}
      {index.roots.length > 0 && (
        <div className="library-toolbar-row">
          <LibraryToolbar
            browseMode={browseMode}
            viewMode={viewMode}
            sort={sort}
            sortDirection={sortDirection}
            query={query}
            onBrowseMode={handleBrowseMode}
            onViewMode={setViewMode}
            // Withheld while a drill-in is open — see the toolbar's own prop
            // comment. Inside an album the order is that table's, not this
            // bar's.
            onSort={isDrilledIn ? undefined : setSort}
            onSortDirection={isDrilledIn ? undefined : handleSortDirection}
            // Never withheld. This box was taken off the bar inside a
            // drill-in, back when a query here narrowed a list that was not
            // on screen and so appeared to do nothing — but a search that
            // vanishes is worse than one that is merely narrow. It stays, and
            // it stays in force: `LibraryDetail` applies it to its table and
            // its own filter narrows what is left. Two searches that compose,
            // rather than one that disappears.
            onQuery={setQuery}
          />
          {/* Only meaningful for a flat run of songs — album and artist rows
              are already groupings, and the video shelf groups by folder
              inherently. Rendered beside the toolbar rather than inside it so
              `LibraryToolbar` keeps the pure prop contract its own test
              pins. */}
          {viewMode === 'list' && browseMode === 'song' && (
            <button
              type="button"
              className={`library-toolbar__chip${
                groupByFolder ? ' is-active' : ''
              }`}
              aria-pressed={groupByFolder}
              title={t('library.groupByFolder')}
              onClick={() => setGroupByFolder((current) => !current)}
            >
              <MenuIcon
                name="folder"
                className="library-toolbar__action-icon"
              />
              <span>{t('library.groupByFolder')}</span>
            </button>
          )}
          <LibraryFolderActions
            roots={index.roots}
            isScanning={isScanning}
            onAddFolder={handleAddFolder}
            onRescan={handleRescan}
            onForceRescan={handleForceRescan}
            onRemoveRoot={handleRemoveRoot}
          />
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
      {/* Takes the whole body the moment the queue's current track is a
          video, regardless of which browse mode the toolbar is sitting on —
          the stage answers "what is loaded", not "what is browsed". Every
          view below is gated on its absence for exactly that reason: the two
          are never shown at once, the same way the drill-in below replaces
          the browse views rather than sitting over them. */}
      {index.tracks.length > 0 && videoTrackId && <LibraryVideoStage />}
      {/* Where the reader is standing, on the shelves that are not the tree.
          Without it the library simply looks smaller than it is: the albums
          shown are the albums in this folder, and nothing on screen would say
          so or offer the way out. The Folders shelf has its own panel and
          says it there. */}
      {openFolderPath !== undefined && browseMode !== 'folder' && (
        <div className="library-workspace__scope">
          {/* The drill-in's own Back, markup and all, so the way out of a
              folder is the same control wherever it is met. */}
          <button
            type="button"
            className="library-toolbar__chip library-detail__back"
            onClick={handleBack}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10 3L5 8l5 5" />
            </svg>
            <span>{t('library.back')}</span>
          </button>
          <span className="library-workspace__scope-path">
            {openFolderPath}
          </span>
        </div>
      )}
      {/* Videos have no album or artist to drill into — routed here on its
          own rather than through the three views below, which never see
          `browseMode === 'video'` at all. The view-mode toggle (list/grid/
          Cover Flow) has nothing to say about a shelf grouped by folder, so
          it is ignored while this is what is browsed. */}
      {index.tracks.length > 0 && !videoTrackId && browseMode === 'video' && (
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
            // Only the Folders shelf draws a folder as a panel. On the other
            // three the same folder is the place the shelf is being read in,
            // and the panel would be a second answer to a question the list
            // below is already answering.
            folderPath={browseMode === 'folder' ? openFolderPath : undefined}
            onBack={handleBack}
            onPlayTrack={handlePlayTrack}
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
            onOpenFolder={handleOpenFolder}
            onPlayTrack={handlePlayTrack}
            offlineRootIds={offlineRootIds}
            folderRoots={index.roots}
            sort={viewSort}
            sortDirection={sortDirection}
            onSort={handleSort}
            groupByFolder={groupByFolder}
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
            onOpenFolder={handleOpenFolder}
            onPlayTrack={handlePlayTrack}
            offlineRootIds={offlineRootIds}
            folderRoots={index.roots}
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
            playingTrackId={playingMarkId}
            revealTrack={revealTrack}
            query={query}
            openId={openAlbumId ?? openArtistId ?? openFolderPath}
            onOpenChange={handleCoverFlowOpen}
          />
        )}
    </section>
  );
};

export default LibraryWorkspace;
