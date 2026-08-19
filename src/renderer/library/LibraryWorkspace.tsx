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
  artistKey,
  groupIntoAlbums,
  searchTracks,
  sortTracks,
} from '../../common/library/grouping';
import type {
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
import LibraryEmptyState from './LibraryEmptyState';
import LibraryFolderActions from './LibraryFolderActions';
import LibraryGridView from './LibraryGridView';
import LibraryListView from './LibraryListView';
import LibraryScanProgress from './LibraryScanProgress';
import MenuIcon from '../icons/MenuIcon';
import LibraryToolbar from './LibraryToolbar';
import LibraryVideoSection, { videoFolderGroups } from './LibraryVideoSection';
import '../styles/Library.scss';

const BROWSE_MODE_KEY = 'fluideq.library.browseMode';
const VIEW_MODE_KEY = 'fluideq.library.viewMode';
const SORT_KEY = 'fluideq.library.sort';
const SORT_DIRECTION_KEY = 'fluideq.library.sortDirection';
const GROUP_BY_FOLDER_KEY = 'fluideq.library.groupByFolder';

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

interface ILibraryWorkspaceProps {
  /** Hidden instead of unmounted, matching KaraokeWorkspace and VideoBrowser:
   * once a track is playing here, leaving the tab must not stop it. */
  isHidden: boolean;
  /** An album to open, asked for from outside — the now-playing bar pressing
   * "show me what is playing". Carries a nonce rather than an id alone so that
   * asking twice for the SAME album still reopens it after the user has
   * navigated away; an id-only prop would look unchanged and do nothing. */
  revealRequest?: { albumId: string; nonce: number };
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
    isScanning,
    progress,
    addFolder,
    addFolderPaths,
    rescan,
    forceRescan,
    cancelScan,
    removeRoot,
  } = useLibrary();
  const { playTracks, videoTrackId, track: playingTrack } = useLibraryPlayer();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isResetNoticeDismissed, setIsResetNoticeDismissed] = useState(false);

  // The toolbar's own state. Held here rather than inside `LibraryToolbar` so
  // that component stays a pure controlled view, testable without a
  // `LibraryProvider` above it.
  const [browseMode, setBrowseMode] = useState<TLibraryBrowseMode>(() =>
    readPersistedMode(BROWSE_MODE_KEY, BROWSE_MODES, 'album'),
  );
  const [viewMode, setViewMode] = useState<TLibraryViewMode>(() =>
    readPersistedMode(VIEW_MODE_KEY, VIEW_MODES, 'grid'),
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

  // The drill-in behind a grid tile or a list row. Not persisted: an album
  // id from a previous launch means nothing once the library has been
  // rescanned, so this always starts closed.
  const [openFolderPath, setOpenFolderPath] = useState<string | undefined>(
    undefined,
  );
  const [openAlbumId, setOpenAlbumId] = useState<string | undefined>(undefined);
  const [openArtistId, setOpenArtistId] = useState<string | undefined>(
    undefined,
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

  // Set by a reveal so the browse-mode effect below can tell a mode change it
  // caused itself from one the user made. See that effect for why.
  const revealDrivenMode = useRef<TLibraryBrowseMode | undefined>(undefined);

  // "Show me what is playing", asked for by the now-playing bar. Browsing has
  // to move to albums first: the drill-in only exists in that mode, and the
  // browse-mode effect below closes any open album when the mode changes, so
  // setting both here in one pass is what makes the album survive the switch.
  // Keyed on the nonce so pressing it twice for the same album still works.
  const revealNonce = revealRequest?.nonce;
  const revealAlbumId = revealRequest?.albumId;
  useEffect(() => {
    if (revealAlbumId === undefined) {
      return;
    }
    revealDrivenMode.current = 'album';
    setBrowseMode('album');
    setOpenArtistId(undefined);
    setOpenAlbumId(revealAlbumId);
  }, [revealAlbumId, revealNonce]);

  // An album id means nothing while artists are listed, and the reverse —
  // switching what is being browsed closes whatever was open.
  //
  // Except when the switch was itself part of opening something: a reveal
  // moves to album mode *in order to* open an album, and this effect fires on
  // that same commit. The ref lets it recognise a mode change it caused
  // itself and leave the drill-in alone; every other mode change still closes
  // it. A boolean would not do — two reveals in a row must both survive.
  useEffect(() => {
    if (revealDrivenMode.current === browseMode) {
      revealDrivenMode.current = undefined;
      return;
    }
    setOpenAlbumId(undefined);
    setOpenArtistId(undefined);
    setOpenFolderPath(undefined);
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
  const visibleTracks = useMemo(
    () => sortTracks(searchTracks(index.tracks, query), sort, sortDirection),
    [index.tracks, query, sort, sortDirection],
  );

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
   * A browse chip was pressed.
   *
   * Closing the drill-in is the whole point. Pressing "Songs" from inside an
   * album used to set the mode behind a detail view that stayed on screen, so
   * the chip lit up and nothing happened — the control looked broken from the
   * one place a reader is most likely to want out of.
   */
  const handleBrowseMode = useCallback((mode: TLibraryBrowseMode) => {
    setOpenAlbumId(undefined);
    setOpenArtistId(undefined);
    setOpenFolderPath(undefined);
    setBrowseMode(mode);
  }, []);

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
      setOpenAlbumId(openId);
    },
    [browseMode],
  );

  /** A drill-in is open, so the list the toolbar steers is not the thing on
   * screen. */
  const isDrilledIn = Boolean(openAlbumId || openArtistId || openFolderPath);

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
    setOpenFolderPath(undefined);
  }, []);
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
      {index.tracks.length === 0 && (
        <LibraryEmptyState
          karaokeSkippedCount={karaokeSkippedCount}
          onAddFolder={handleAddFolder}
        />
      )}
      {/* Takes the whole body the moment the queue's current track is a
          video, regardless of which browse mode the toolbar is sitting on —
          the stage answers "what is loaded", not "what is browsed". Every
          view below is gated on its absence for exactly that reason: the two
          are never shown at once, the same way the drill-in below replaces
          the browse views rather than sitting over them. */}
      {index.tracks.length > 0 && videoTrackId && <LibraryVideoStage />}
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
            folderPath={openFolderPath}
            onBack={handleBack}
            onPlayTrack={handlePlayTrack}
            offlineRootIds={offlineRootIds}
            viewMode={viewMode}
            playingTrackId={playingTrack?.id}
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
            sort={sort}
            sortDirection={sortDirection}
            onSort={handleSort}
            groupByFolder={groupByFolder}
            playingTrackId={playingTrack?.id}
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
            sort={sort}
            sortDirection={sortDirection}
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
            sort={sort}
            sortDirection={sortDirection}
            playingTrackId={playingTrack?.id}
            openId={openAlbumId ?? openArtistId}
            onOpenChange={handleCoverFlowOpen}
          />
        )}
    </section>
  );
};

export default LibraryWorkspace;
