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

import { CSSProperties, DragEvent, useRef } from 'react';
import {
  droppedFilePath,
  UP_NEXT_MAX,
  UP_NEXT_MIN,
  UP_NEXT_WIDTH_KEY,
  writePersistedText,
} from './libraryWorkspacePrefs';
import LibraryVideoStage from './player/LibraryVideoStage';
import LibraryTopBar from './LibraryTopBar';
import LibraryShelfRail from './LibraryShelfRail';
import LibraryStatusLine from './LibraryStatusLine';
import LibraryShelfViews from './LibraryShelfViews';
import { LibraryUpNextChip, upNextTotal } from './LibraryUpNext';
import LibraryRightPane from './LibraryRightPane';
import SurpriseDrawLayer from './surpriseDraw/SurpriseDrawLayer';
import type { ISurpriseStage } from './surpriseDraw/surpriseStage';
import LibraryScanProgress from './LibraryScanProgress';
import LibraryEmptyState from './LibraryEmptyState';
import Spinner from '../icons/Spinner';
import LibraryPlaceBar from './LibraryPlaceBar';
import KaraokePaneSplitter from '../karaoke/KaraokePaneSplitter';
import { type ILibraryWorkspaceProps } from './LibraryWorkspace';
import { type TLibraryWorkspaceShelf } from './useLibraryWorkspaceShelf';
import { type TLibraryWorkspaceNavigation } from './useLibraryWorkspaceNavigation';
import { type TLibrarySteps } from './useLibrarySteps';
import { useLibraryAnswer, useShelfCounts } from './useLibraryAnswer';

type TLibraryWorkspaceViewProps = Pick<
  ILibraryWorkspaceProps,
  'isFullScreen' | 'isHidden' | 'onToggleFullScreen'
> &
  Required<Pick<ILibraryWorkspaceProps, 'isGraphBackdrop'>> & {
    shelf: TLibraryWorkspaceShelf;
    navigation: TLibraryWorkspaceNavigation;
    steps: TLibrarySteps;
  };

/** The rail's names for the shelves, which the breadcrumb starts from. */
const SHELF_LABEL_KEYS = {
  album: 'library.browse.album',
  artist: 'library.browse.artist',
  genre: 'library.browse.genre',
  song: 'library.browse.song',
  folder: 'library.browse.folder',
  video: 'library.videos',
  playlist: 'library.browse.playlist',
} as const;

const DismissGlyph = () => (
  <svg viewBox="0 0 12 12" aria-hidden="true">
    <path d="M3 3l6 6M9 3l-6 6" />
  </svg>
);

/**
 * THE LIBRARY, LAID OUT AS ONE STUDIO (Ivan, 2026-11-14: the "A + C"
 * design): the shelves' rail on the left, the place being read in the
 * middle under its top bar and breadcrumb, Up Next beside it, and a quiet
 * status line across the foot. Three columns of one grid, so the rail, the
 * shelf and the queue can never disagree about how much of the tab each has
 * — the queue used to stand absolutely over the card while every other child
 * took a margin to clear it.
 *
 * Holds no state and runs no hooks beyond the two small questions the rail
 * and the status line ask; everything else comes from the shelf, the
 * navigation and the reader's steps.
 */
const LibraryWorkspaceView = ({
  shelf,
  navigation,
  steps,
  isFullScreen,
  isGraphBackdrop,
  isHidden,
  onToggleFullScreen,
}: TLibraryWorkspaceViewProps) => {
  const surpriseStageRef = useRef<ISurpriseStage | undefined>(undefined);
  const {
    t,
    isIndexLoaded,
    isScanning,
    progress,
    isScanNoticeHidden,
    hideScanNotice,
    showScanNotice,
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
    upNext,
    videoTrackId,
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
    isDragOver,
    setIsDragOver,
    isResetNoticeDismissed,
    setIsResetNoticeDismissed,
    isPlaylistNoticeDismissed,
    setIsPlaylistNoticeDismissed,
    browseMode,
    viewMode,
    setViewMode,
    sortDirection,
    sort,
    query,
    openFolderPath,
    openPlaylistId,
    karaokeSkippedCount,
    isSearching,
    showSurprisePick,
  } = shelf;
  const {
    isDrilledIn,
    placeRecord,
    handleQuery,
    handleSortDirection,
    handlePickSort,
    upNextRestTotal,
    shownTracksQuery,
    transportRef,
    transportAtPressRef,
  } = navigation;
  const {
    canGoBack,
    canGoForward,
    handleGoBack,
    handleGoForward,
    handleBrowseMode,
    handleShowPlaylist,
    handleAllMusic,
    handlePlaceFolder,
  } = steps;
  const counts = useShelfCounts();
  const hasLibrary = roots.length > 0;
  const shownTotals = useLibraryAnswer(
    hasLibrary && !isHidden && shownTracksQuery !== undefined
      ? { type: 'totals', query: shownTracksQuery }
      : undefined,
  );

  const handleAddFolder = () => {
    addFolder().catch(() => undefined);
  };

  const onDragOver = (event: DragEvent<HTMLElement>) => {
    // Required for the element to accept the drop at all.
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

  // Audio lives in LibraryPlayerProvider's detached decks. With no video
  // element to keep, an off-tab library needs no workspace DOM at all.
  if (isHidden && !videoTrackId) {
    return null;
  }

  // Withheld while a record is open, because this orders the SHELF and the
  // record replaces it — except in Cover Flow, whose record opens under the
  // row it reorders. Withheld on Playlists, which keep their own order.
  const canSort =
    !(isDrilledIn && viewMode !== 'coverflow') && browseMode !== 'playlist';

  const upNextCount = upNextTotal(upNext, upNextRestTotal);
  /** The picture owns the screen: no bar, no rail, no status line. */
  const isVideoFull = Boolean(videoTrackId) && isFullScreen;

  return (
    <section
      className={`library-workspace workspace-tab-panel workspace-tab-panel--library${
        isHidden ? ' is-hidden' : ''
      }${isGraphBackdrop ? ' is-playback-backdrop' : ''}${
        isDragOver ? ' is-drag-over' : ''
      }${hasLibrary ? ' has-library' : ''}${
        // Only while the panel is drawn: folded, its column gives the width
        // back. Over a video too — the queue stands BESIDE the picture, as
        // karaoke's playlist does, never over a strip of it.
        !isUpNextCollapsed ? ' has-up-next' : ''
      }${isUpNextOverVideo ? ' has-video' : ''}${
        isUpNextDrawer ? ' has-up-next-floating' : ''
      }${
        // The picture owns the screen; said on the card so the stylesheet
        // need not ask the card's subtree with `:has()`.
        isVideoFull ? ' is-video-full' : ''
      }${
        isResizingUpNext && !isHidden && !isUpNextCollapsed
          ? ' is-resizing-up-next'
          : ''
      }`}
      ref={cardRef}
      aria-label={t('tabs.library')}
      aria-hidden={isHidden}
      // The song on the transport as a press begins — captured ahead of the
      // press itself, which may change it. See `handleRestartTrack`.
      onClickCapture={(event) => {
        if (event.detail === 1) {
          transportAtPressRef.current = transportRef.current.trackId;
        }
      }}
      style={
        {
          '--up-next-width': `${upNextWidth}px`,
          // What the surprise draw has to clear inside the main column.
          '--library-chrome-height': `${chromeHeight}px`,
        } as CSSProperties
      }
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* An empty library has one useful next step, and the empty state is
          the whole screen for it; the rail appears with the first root. */}
      {!isHidden && hasLibrary && (
        <LibraryShelfRail
          browseMode={browseMode}
          counts={counts}
          roots={roots}
          playlists={playlists}
          openFolderPath={openFolderPath}
          openPlaylistId={openPlaylistId}
          onBrowseMode={handleBrowseMode}
          onOpenFolder={handlePlaceFolder}
          onShowPlaylist={handleShowPlaylist}
          onAddFolder={handleAddFolder}
          onRemoveRoot={(rootId) => {
            removeRoot(rootId).catch(() => undefined);
          }}
        />
      )}
      <div className="library-main">
        {/* First in the column, so hiding the workspace never remounts a
            playing video: hidden, only this engine and its wrapper stay. */}
        {videoTrackId && (
          <LibraryVideoStage
            isHidden={isHidden}
            isFullScreen={isFullScreen}
            onToggleFullScreen={onToggleFullScreen}
          />
        )}
        {!isHidden && (
          <>
            {/* A library that emptied itself after a bad shutdown, said once
                and dismissibly rather than folded into the empty state. */}
            {wasReset && !isResetNoticeDismissed && (
              <div className="library-workspace__notice" role="status">
                <span>{t('library.indexReset')}</span>
                <button
                  type="button"
                  aria-label={t('app.dismiss')}
                  onClick={() => setIsResetNoticeDismissed(true)}
                >
                  <DismissGlyph />
                </button>
              </div>
            )}
            {/* Worth more than the one above: a rescan puts songs back, and
                nothing puts back a playlist. */}
            {playlistsWereReset && !isPlaylistNoticeDismissed && (
              <div className="library-workspace__notice" role="status">
                <span>{t('library.playlist.reset')}</span>
                <button
                  type="button"
                  aria-label={t('app.dismiss')}
                  onClick={() => setIsPlaylistNoticeDismissed(true)}
                >
                  <DismissGlyph />
                </button>
              </div>
            )}
            {/* Over a video too: the picture takes what is left under the
                bar, so leaving a video is the same gesture as leaving
                anything else (`has-video` orders the two). */}
            {hasLibrary && (
              <div className="library-head" ref={chromeRef}>
                <LibraryTopBar
                  browseMode={browseMode}
                  viewMode={viewMode}
                  sort={sort}
                  sortDirection={sortDirection}
                  onViewMode={setViewMode}
                  onSort={canSort ? handlePickSort : undefined}
                  onSortDirection={canSort ? handleSortDirection : undefined}
                  query={query}
                  onQuery={handleQuery}
                  history={
                    videoTrackId
                      ? undefined
                      : {
                          canGoBack,
                          canGoForward,
                          onGoBack: handleGoBack,
                          onGoForward: handleGoForward,
                        }
                  }
                  tail={
                    !isVideoFull && (
                      <LibraryUpNextChip
                        isOpen={!isUpNextCollapsed}
                        count={upNextCount}
                        onToggle={() => setIsUpNextCollapsed((open) => !open)}
                      />
                    )
                  }
                />
                {/* Where the reader stands, over every shelf and view. On the
                    Folders shelf inside a folder the path is the start, as
                    in a file manager. Not over a video, which has the tab. */}
                {trackCount > 0 && !videoTrackId && (
                  <LibraryPlaceBar
                    shelf={
                      browseMode === 'folder' &&
                      openFolderPath !== undefined &&
                      !isSearching
                        ? undefined
                        : t(SHELF_LABEL_KEYS[browseMode])
                    }
                    folderPath={openFolderPath}
                    roots={roots}
                    record={placeRecord}
                    onAllMusic={handleAllMusic}
                    onOpenFolder={handlePlaceFolder}
                  />
                )}
              </div>
            )}
            {/* Pinned under the bar rather than a modal: the scan is
                backgroundable by leaving the tab. */}
            {isScanning && progress && !isScanNoticeHidden && (
              <LibraryScanProgress
                progress={progress}
                onCancel={cancelScan}
                onHide={hideScanNotice}
              />
            )}
            {/* Only once the index has been read: it starts empty, and gated
                on the count alone this greeted a full library with "no music
                yet" every time the tab opened. */}
            {isIndexLoaded && trackCount === 0 && (
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
            <LibraryShelfViews
              shelf={shelf}
              navigation={navigation}
              steps={steps}
              surpriseStageRef={surpriseStageRef}
            />
            {/* Over whichever shelf is drawn, after every view so it lies
                above them. Never over a video, which has the tab. */}
            <SurpriseDrawLayer
              isShelfShown={trackCount > 0 && !videoTrackId}
              stageRef={surpriseStageRef}
              onPick={showSurprisePick}
            />
            {/* Over a video in full screen only, where the bar holding the
                chip everywhere else is not drawn. */}
            {isUpNextCollapsed && isVideoFull && (
              <LibraryUpNextChip
                className="library-up-next__chip--over-video"
                isOpen={false}
                count={upNextCount}
                onToggle={() => setIsUpNextCollapsed(false)}
              />
            )}
          </>
        )}
      </div>
      {/* The queue belongs to the tab rather than to whichever shelf is
          drawing it: a column of its own. Mounted folded as well, so it
          closes and opens on the Plus rail's motion instead of vanishing. */}
      {!isHidden && (
        <div className="library-side">
          {/* The karaoke panes' splitter, on the column's inner edge.
              Dragging left widens the queue: the panel is anchored right. */}
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
                  setIsResizingUpNext(true);
                }}
                onDrag={(delta) => {
                  const next = Math.min(
                    UP_NEXT_MAX,
                    Math.max(UP_NEXT_MIN, upNextResizeStartRef.current - delta),
                  );
                  upNextDraggedToRef.current = next;
                  setUpNextWidth(next);
                }}
                onEnd={() => {
                  setIsResizingUpNext(false);
                  writePersistedText(
                    UP_NEXT_WIDTH_KEY,
                    String(upNextDraggedToRef.current),
                  );
                }}
              />
            </div>
          )}
          <LibraryRightPane
            isCollapsed={isUpNextCollapsed}
            canSurprise={trackCount > 0 && !videoTrackId}
            head={
              isUpNextDrawer && (
                <LibraryUpNextChip
                  isOpen={!isUpNextCollapsed}
                  count={upNextCount}
                  onToggle={() => setIsUpNextCollapsed(true)}
                />
              )
            }
          />
        </div>
      )}
      {!isHidden && hasLibrary && (
        <LibraryStatusLine
          shown={shownTotals}
          shownKind={browseMode === 'video' ? 'video' : 'song'}
          counts={counts}
          isScanning={isScanning}
          progress={progress}
          isScanNoticeHidden={isScanNoticeHidden}
          onShowScan={showScanNotice}
          onRescan={() => {
            rescan().catch(() => undefined);
          }}
          onForceRescan={() => {
            forceRescan().catch(() => undefined);
          }}
        />
      )}
    </section>
  );
};

export default LibraryWorkspaceView;
