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

import { CSSProperties, DragEvent } from 'react';
import {
  droppedFilePath,
  UP_NEXT_MAX,
  UP_NEXT_MIN,
  UP_NEXT_WIDTH_KEY,
  writePersistedText,
} from './libraryWorkspacePrefs';
import LibraryVideoStage from './player/LibraryVideoStage';
import LibraryToolbar from './LibraryToolbar';
import LibraryFolderActions from './LibraryFolderActions';
import LibraryUpNext, { LibraryUpNextChip, upNextTotal } from './LibraryUpNext';
import LibraryScanProgress from './LibraryScanProgress';
import LibraryEmptyState from './LibraryEmptyState';
import Spinner from '../icons/Spinner';
import LibraryPlaceBar from './LibraryPlaceBar';
import LibraryVideoSection from './LibraryVideoSection';
import LibraryDetail from './LibraryDetail';
import LibraryListView from './LibraryListView';
import LibraryGridView from './LibraryGridView';
import LibraryCoverFlow from './LibraryCoverFlow';
import KaraokePaneSplitter from '../karaoke/KaraokePaneSplitter';
import { type ILibraryWorkspaceProps } from './LibraryWorkspace';
import { type TLibraryWorkspaceShelf } from './useLibraryWorkspaceShelf';
import { type TLibraryWorkspaceNavigation } from './useLibraryWorkspaceNavigation';

type TLibraryWorkspaceViewProps = Pick<
  ILibraryWorkspaceProps,
  'isFullScreen' | 'isHidden' | 'onToggleFullScreen'
> &
  Required<Pick<ILibraryWorkspaceProps, 'isGraphBackdrop'>> & {
    shelf: TLibraryWorkspaceShelf;
    navigation: TLibraryWorkspaceNavigation;
  };

/**
 * The Library workspace's markup: the toolbar and place bar, the shelf in
 * its view, the detail of what is open, Up next beside it, the roots and
 * the drop target. Holds no state and runs no hooks; everything it shows
 * comes from the shelf and the navigation.
 */
const LibraryWorkspaceView = ({
  shelf,
  navigation,
  isFullScreen,
  isGraphBackdrop,
  isHidden,
  onToggleFullScreen,
}: TLibraryWorkspaceViewProps) => {
  const {
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
    playlistsWereReset,
    appendToQueue,
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
    playingMarkId,
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
    openAlbumId,
    openArtistId,
    openGenreId,
    openPlaylistId,
    revealTrack,
    karaokeSkippedCount,
    offlineRootIds,
    isSearching,
    viewSort,
    listResetKey,
    shelfList,
    playingItemId,
  } = shelf;
  const {
    handleSort,
    handleBrowseMode,
    handleOpenFolder,
    handleOpenPlaylist,
    handleCoverFlowOpen,
    shelfGenreId,
    shelfPlaylistId,
    hasOpenRecord,
    isDrilledIn,
    placeRecord,
    handleQuery,
    handleSortDirection,
    handlePickSort,
    handleOpenAlbum,
    handleOpenArtist,
    handleOpenGenre,
    handleBack,
    handleAllMusic,
    handlePlaceFolder,
    upNextRestTotal,
    handlePlayTrack,
    transportRef,
    transportAtPressRef,
    handleRestartTrack,
  } = navigation;
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
        isUpNextDrawer ? ' has-up-next-floating' : ''
      }${
        // The picture owns the screen: what `LibraryVideoStage` marks
        // `is-fullscreen`, said on the card so the stylesheet need not ask
        // the card's whole subtree with `:has()` (see `isResizingUpNext`).
        videoTrackId && isFullScreen ? ' is-video-full' : ''
      }${
        // Only while the splitter is there to be dragged, as the handle's
        // own `is-dragging` was.
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

          AND OVER A VIDEO TOO, which it did not used to be. It was withheld
          while one played, on the argument that the picture should have the
          whole tab — and what that produced was a tab with no way back to
          the library except the one button drawn on the picture, and no
          search, no browse and no view while a video was up. The row keeps
          its place at the top and the picture takes what is left under it
          (see `has-video` in Library.scss, which orders the two), so
          leaving a video is the same gesture as leaving anything else. */}
          {roots.length > 0 && (
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
                //
                // Withheld on Playlists too, for the reason all three shelf
                // views already give in their own code: a playlist is put in
                // order by `sortPlaylists` — Favourites first, then by name —
                // and none of them reads this. The dropdown was on screen
                // there, opened, and changed nothing, which is exactly the
                // control the list view refuses to draw a header for.
                onSort={
                  (isDrilledIn && viewMode !== 'coverflow') ||
                  browseMode === 'playlist'
                    ? undefined
                    : handlePickSort
                }
                onSortDirection={
                  (isDrilledIn && viewMode !== 'coverflow') ||
                  browseMode === 'playlist'
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
                  roots={roots}
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
          {/* WHERE THE READER IS STANDING, over every shelf and every view,
          and the one Back in the Library (`LibraryPlaceBar`). It used to be
          two things: a Back on an opened album's panel, and one on Videos.
          Every other screen a folder narrowed had neither — Genres, Songs,
          Playlists, an Albums shelf whose folder held only folders, Cover
          Flow after its panel closed — and the library read as a fraction of
          itself with no word why and no way out (Ivan, 2026-09-23). Drawn
          whenever anything narrows the shelf, a folder or an open record. */}
          {trackCount > 0 &&
            !videoTrackId &&
            (openFolderPath !== undefined || hasOpenRecord) && (
              <LibraryPlaceBar
                folderPath={openFolderPath}
                roots={roots}
                record={placeRecord}
                onBack={handleBack}
                onAllMusic={handleAllMusic}
                onOpenFolder={handlePlaceFolder}
              />
            )}
          {/* Videos have no album or artist to drill into — routed here on its
          own rather than through the three views below, which never see
          `browseMode === 'video'` at all. The view-mode toggle (list/grid/
          Cover Flow) has nothing to say about a shelf grouped by folder, so
          it is ignored while this is what is browsed. */}
          {trackCount > 0 && !videoTrackId && browseMode === 'video' && (
            <LibraryVideoSection
              list={shelfList}
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
          {trackCount > 0 &&
            !videoTrackId &&
            browseMode !== 'video' &&
            viewMode !== 'coverflow' &&
            isDrilledIn && (
              <LibraryDetail
                albumId={openAlbumId}
                artistId={openArtistId}
                genreId={browseMode === 'genre' ? openGenreId : undefined}
                // Only the Folders shelf draws a folder as a panel. On the other
                // three the same folder is the place the shelf is being read in,
                // and the panel would be a second answer to a question the list
                // below is already answering.
                folderPath={
                  browseMode === 'folder' && !isSearching
                    ? openFolderPath
                    : undefined
                }
                playlistId={
                  browseMode === 'playlist' ? openPlaylistId : undefined
                }
                onBack={handleBack}
                onPlayTrack={handlePlayTrack}
                onRestartTrack={handleRestartTrack}
                onQueueTracks={appendToQueue}
                offlineRootIds={offlineRootIds}
                onOpenFolder={handleOpenFolder}
                viewMode={viewMode}
                playingTrackId={playingMarkId}
                revealTrack={revealTrack}
                query={query}
              />
            )}
          {trackCount > 0 &&
            !videoTrackId &&
            browseMode !== 'video' &&
            !isDrilledIn &&
            viewMode === 'list' && (
              <LibraryListView
                list={shelfList}
                browseMode={browseMode}
                onOpenAlbum={handleOpenAlbum}
                onOpenArtist={handleOpenArtist}
                onOpenGenre={handleOpenGenre}
                onOpenFolder={handleOpenFolder}
                onOpenPlaylist={handleOpenPlaylist}
                onPlayTrack={handlePlayTrack}
                onRestartTrack={handleRestartTrack}
                // The Songs shelf has no drill-in header to queue from, so the
                // row menu is the only way into the queue here at all.
                onQueueTracks={appendToQueue}
                offlineRootIds={offlineRootIds}
                sort={viewSort}
                sortDirection={sortDirection}
                onSort={handleSort}
                playingTrackId={playingMarkId}
                revealTrack={revealTrack}
                resetKey={listResetKey}
              />
            )}
          {trackCount > 0 &&
            !videoTrackId &&
            browseMode !== 'video' &&
            !isDrilledIn &&
            viewMode === 'grid' && (
              <LibraryGridView
                list={shelfList}
                browseMode={browseMode}
                onOpenAlbum={handleOpenAlbum}
                onOpenArtist={handleOpenArtist}
                onOpenGenre={handleOpenGenre}
                onOpenFolder={handleOpenFolder}
                onOpenPlaylist={handleOpenPlaylist}
                onPlayTrack={handlePlayTrack}
                onRestartTrack={handleRestartTrack}
                offlineRootIds={offlineRootIds}
                playingItemId={playingItemId}
                revealTrack={revealTrack}
                resetKey={listResetKey}
              />
            )}
          {/* Not gated on `isDrilledIn` like the other two: this view shows the
          drill-in itself, under its own row. Switching to it from an open
          album carries that album across -- `openId` centres it and opens it
          -- rather than dropping the reader at the top of an unrelated
          carousel with what they were reading closed. */}
          {trackCount > 0 &&
            !videoTrackId &&
            browseMode !== 'video' &&
            viewMode === 'coverflow' && (
              <LibraryCoverFlow
                list={shelfList}
                browseMode={browseMode}
                onPlayTrack={handlePlayTrack}
                onRestartTrack={handleRestartTrack}
                folderRoots={roots}
                playingTrackId={playingMarkId}
                playingItemId={playingItemId}
                revealTrack={revealTrack}
                // What is open ON THIS SHELF, and nothing else. It was the
                // first of all five, so over Albums a folder's path came
                // through as the album to open: no cover answered to it, no
                // panel opened, and the shelf sat narrowed with no Back.
                openId={
                  {
                    album: openAlbumId,
                    artist: openArtistId,
                    genre: shelfGenreId,
                    playlist: shelfPlaylistId,
                    folder: openFolderPath,
                    song: undefined,
                    video: undefined,
                  }[browseMode]
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
          {/* Mounted folded as well, so it can close and open on the Plus
          rail's motion (`Library.scss`) instead of vanishing in one frame. */}
          <LibraryUpNext
            isCollapsed={isUpNextCollapsed}
            onCollapsedChange={setIsUpNextCollapsed}
            restTotal={upNextRestTotal}
          />
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
        </>
      )}
    </section>
  );
};

export default LibraryWorkspaceView;
