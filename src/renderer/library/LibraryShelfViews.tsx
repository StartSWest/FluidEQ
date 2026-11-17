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

import type { MutableRefObject } from 'react';
import LibraryVideoSection from './LibraryVideoSection';
import LibraryDetail from './LibraryDetail';
import LibraryListView from './LibraryListView';
import LibraryGridView from './LibraryGridView';
import LibraryCoverFlow from './LibraryCoverFlow';
import type { ISurpriseStage } from './surpriseDraw/surpriseStage';
import { type TLibraryWorkspaceShelf } from './useLibraryWorkspaceShelf';
import { type TLibraryWorkspaceNavigation } from './useLibraryWorkspaceNavigation';
import { type TLibrarySteps } from './useLibrarySteps';

/**
 * The shelf as it is being read: Videos' own section, the record or folder
 * open, or the shelf in the chosen view. Exactly one of them at a time, and
 * none while a video has the tab. Holds no state; everything comes from the
 * shelf, the navigation and the reader's steps.
 */
const LibraryShelfViews = ({
  shelf,
  navigation,
  steps,
  surpriseStageRef,
}: {
  shelf: TLibraryWorkspaceShelf;
  navigation: TLibraryWorkspaceNavigation;
  steps: TLibrarySteps;
  /** Cover Flow fills it while on screen, so Surprise me spins that row
   * rather than building a second scene over it (`surpriseStage.ts`). */
  surpriseStageRef: MutableRefObject<ISurpriseStage | undefined>;
}) => {
  const {
    trackCount,
    roots,
    appendToQueue,
    videoTrackId,
    playingMarkId,
    browseMode,
    viewMode,
    sortDirection,
    query,
    openFolderPath,
    openAlbumId,
    openArtistId,
    openGenreId,
    openPlaylistId,
    revealTrack,
    offlineRootIds,
    viewSort,
    listResetKey,
    shelfList,
    playingItemId,
    centreRequest,
  } = shelf;
  const {
    handleSort,
    shelfGenreId,
    shelfPlaylistId,
    isDrilledIn,
    isFolderPanel,
    handleBack,
    handlePlayTrack,
    handleRestartTrack,
  } = navigation;
  const {
    handleOpenFolder,
    handleOpenPlaylist,
    handleCoverFlowOpen,
    handleOpenAlbum,
    handleOpenArtist,
    handleOpenGenre,
  } = steps;

  if (trackCount === 0 || videoTrackId) {
    return null;
  }

  // Videos have no album or artist to drill into — routed here on their own
  // rather than through the views below. As a list they are the songs'
  // table under their folders' headings, as a grid the frames; Cover Flow
  // turns them as it turns songs, a press playing the one in the centre.
  if (browseMode === 'video' && viewMode === 'list') {
    return (
      <LibraryListView
        list={shelfList}
        browseMode="song"
        onOpenAlbum={handleOpenAlbum}
        onOpenArtist={handleOpenArtist}
        onPlayTrack={handlePlayTrack}
        onRestartTrack={handleRestartTrack}
        offlineRootIds={offlineRootIds}
        resetKey={listResetKey}
      />
    );
  }
  if (browseMode === 'video' && viewMode !== 'coverflow') {
    return (
      <LibraryVideoSection
        list={shelfList}
        onPlayTrack={handlePlayTrack}
        offlineRootIds={offlineRootIds}
      />
    );
  }

  // Cover Flow draws the record open under its own row, from the same ids:
  // drawn here as well, the same album was on screen twice.
  if (viewMode === 'coverflow') {
    return (
      <LibraryCoverFlow
        list={shelfList}
        browseMode={browseMode}
        onPlayTrack={handlePlayTrack}
        onRestartTrack={handleRestartTrack}
        folderRoots={roots}
        playingTrackId={playingMarkId}
        playingItemId={playingItemId}
        revealTrack={revealTrack}
        // What is open ON THIS SHELF, and nothing else: the first of all five
        // let a folder's path through as the album to open on Albums.
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
        surpriseStageRef={surpriseStageRef}
        centreRequest={centreRequest}
      />
    );
  }

  // The drill-in behind whichever tile or row was opened, in place of the
  // shelf rather than over it — shown whole, not narrowed further by a query
  // that was for finding it in the first place.
  if (isDrilledIn) {
    return (
      <LibraryDetail
        albumId={openAlbumId}
        artistId={openArtistId}
        genreId={browseMode === 'genre' ? openGenreId : undefined}
        // Only the Folders shelf draws a folder as a panel, and under a
        // search only one opened from its results. On the others the same
        // folder is where the shelf is being read, and a panel would be a
        // second answer to what the list is already answering.
        folderPath={isFolderPanel ? openFolderPath : undefined}
        playlistId={browseMode === 'playlist' ? openPlaylistId : undefined}
        // How a panel closes ITSELF (an orphan, a deleted playlist): not a
        // step the reader took, so not one Back should walk back onto.
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
    );
  }

  if (viewMode === 'grid') {
    return (
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
    );
  }

  return (
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
      // The Songs shelf has no drill-in header to queue from, so the row
      // menu is the only way into the queue here at all.
      onQueueTracks={appendToQueue}
      offlineRootIds={offlineRootIds}
      sort={viewSort}
      sortDirection={sortDirection}
      onSort={handleSort}
      playingTrackId={playingMarkId}
      revealTrack={revealTrack}
      resetKey={listResetKey}
    />
  );
};

export default LibraryShelfViews;
