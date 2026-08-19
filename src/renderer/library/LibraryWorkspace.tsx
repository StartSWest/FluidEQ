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

import { DragEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  artistKey,
  groupIntoAlbums,
  searchTracks,
  sortTracks,
} from '../../common/library/grouping';
import type {
  TLibraryBrowseMode,
  TLibrarySort,
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
import LibraryToolbar from './LibraryToolbar';
import LibraryVideoSection, { videoFolderGroups } from './LibraryVideoSection';
import '../styles/Library.scss';

const BROWSE_MODE_KEY = 'fluideq.library.browseMode';
const VIEW_MODE_KEY = 'fluideq.library.viewMode';
const SORT_KEY = 'fluideq.library.sort';

const BROWSE_MODES: readonly TLibraryBrowseMode[] = [
  'album',
  'artist',
  'song',
  'video',
];
const VIEW_MODES: readonly TLibraryViewMode[] = ['list', 'grid', 'coverflow'];
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

const LibraryWorkspace = ({ isHidden }: ILibraryWorkspaceProps) => {
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
  const { playTracks, videoTrackId } = useLibraryPlayer();
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
  const [sort, setSort] = useState<TLibrarySort>(() =>
    readPersistedMode(SORT_KEY, SORTS, 'title'),
  );
  const [query, setQuery] = useState('');

  // The drill-in behind a grid tile or a list row. Not persisted: an album
  // id from a previous launch means nothing once the library has been
  // rescanned, so this always starts closed.
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

  // An album id means nothing while artists are listed, and the reverse —
  // switching what is being browsed closes whatever was open.
  useEffect(() => {
    setOpenAlbumId(undefined);
    setOpenArtistId(undefined);
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
    () => sortTracks(searchTracks(index.tracks, query), sort),
    [index.tracks, query, sort],
  );

  // Opening one closes the other — only one drill-in is ever on screen.
  const handleOpenAlbum = (albumId: string) => {
    setOpenArtistId(undefined);
    setOpenAlbumId(albumId);
  };
  const handleOpenArtist = (artistId: string) => {
    setOpenAlbumId(undefined);
    setOpenArtistId(artistId);
  };
  const handleBack = () => {
    setOpenAlbumId(undefined);
    setOpenArtistId(undefined);
  };
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
            query={query}
            onBrowseMode={setBrowseMode}
            onViewMode={setViewMode}
            onSort={setSort}
            onQuery={setQuery}
          />
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
      {index.tracks.length > 0 &&
        !videoTrackId &&
        browseMode !== 'video' &&
        (openAlbumId || openArtistId) && (
          <LibraryDetail
            tracks={index.tracks}
            albumId={openAlbumId}
            artistId={openArtistId}
            onBack={handleBack}
            onPlayTrack={handlePlayTrack}
            offlineRootIds={offlineRootIds}
          />
        )}
      {index.tracks.length > 0 &&
        !videoTrackId &&
        browseMode !== 'video' &&
        !openAlbumId &&
        !openArtistId &&
        viewMode === 'list' && (
          <LibraryListView
            tracks={visibleTracks}
            browseMode={browseMode}
            onOpenAlbum={handleOpenAlbum}
            onOpenArtist={handleOpenArtist}
            onPlayTrack={handlePlayTrack}
            offlineRootIds={offlineRootIds}
          />
        )}
      {index.tracks.length > 0 &&
        !videoTrackId &&
        browseMode !== 'video' &&
        !openAlbumId &&
        !openArtistId &&
        viewMode === 'grid' && (
          <LibraryGridView
            tracks={visibleTracks}
            browseMode={browseMode}
            onOpenAlbum={handleOpenAlbum}
            onOpenArtist={handleOpenArtist}
            onPlayTrack={handlePlayTrack}
            offlineRootIds={offlineRootIds}
          />
        )}
      {index.tracks.length > 0 &&
        !videoTrackId &&
        browseMode !== 'video' &&
        !openAlbumId &&
        !openArtistId &&
        viewMode === 'coverflow' && (
          <LibraryCoverFlow
            tracks={visibleTracks}
            browseMode={browseMode}
            onOpenAlbum={handleOpenAlbum}
            onOpenArtist={handleOpenArtist}
            onPlayTrack={handlePlayTrack}
          />
        )}
    </section>
  );
};

export default LibraryWorkspace;
