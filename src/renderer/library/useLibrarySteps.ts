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

/**
 * The reader's moves through the Library, each one a step Back can undo.
 *
 * The navigation hook owns what a move DOES; this wraps every move a person
 * makes on purpose — a shelf in the rail, a folder in the tree, a crumb, a
 * row or a cover opened — so the place it leaves is remembered first
 * (`useLibraryHistory`). A panel closing itself (an orphaned album, a deleted
 * playlist) is not a move and keeps the bare handler: remembered, Back would
 * walk the reader back onto a record that no longer exists.
 */

import { useCallback, useMemo } from 'react';
import type { TLibraryBrowseMode } from '../../common/library/types';
import { parentFolderPath } from '../../common/library/grouping';
import { type ILibraryPlace, useLibraryHistory } from './useLibraryHistory';
import { type TLibraryWorkspaceShelf } from './useLibraryWorkspaceShelf';
import { type TLibraryWorkspaceNavigation } from './useLibraryWorkspaceNavigation';

/** `fn`, with the place it leaves remembered before it moves. */
const stepping =
  <A extends unknown[]>(remember: () => void, fn: (...args: A) => void) =>
  (...args: A) => {
    remember();
    fn(...args);
  };

const useLibrarySteps = (
  shelf: TLibraryWorkspaceShelf,
  navigation: TLibraryWorkspaceNavigation,
) => {
  const {
    roots,
    browseMode,
    setBrowseMode,
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
    setIsFolderOpened,
    drillInDrivenMode,
  } = shelf;
  const {
    handleBrowseMode,
    handleOpenFolder,
    handleOpenPlaylist,
    handleCoverFlowOpen,
    handleOpenAlbum,
    handleOpenArtist,
    handleOpenGenre,
    handleBack,
    handleAllMusic,
    handlePlaceFolder,
    hasOpenRecord,
    isResultFolderOpen,
  } = navigation;

  const current = useMemo(
    (): ILibraryPlace => ({
      browseMode,
      folderPath: openFolderPath,
      albumId: openAlbumId,
      artistId: openArtistId,
      genreId: openGenreId,
      playlistId: openPlaylistId,
      // What it does on screen, never the bare flag: outside a search the
      // flag changes nothing, and a step that differs only by it would cost
      // Back a press that moves nothing.
      isFolderOpened: isResultFolderOpen,
    }),
    [
      browseMode,
      openFolderPath,
      openAlbumId,
      openArtistId,
      openGenreId,
      openPlaylistId,
      isResultFolderOpen,
    ],
  );

  /**
   * A remembered place, put back whole. A shelf change marks itself as
   * bringing its own drill-in (`drillInDrivenMode`), or the effect that
   * closes a drill-in on every other shelf change would throw away the very
   * record being restored.
   */
  const restore = useCallback(
    (place: ILibraryPlace) => {
      if (place.browseMode !== browseMode) {
        drillInDrivenMode.current = place.browseMode;
        setBrowseMode(place.browseMode);
      }
      setOpenFolderPath(place.folderPath);
      setOpenAlbumId(place.albumId);
      setOpenArtistId(place.artistId);
      setOpenGenreId(place.genreId);
      setOpenPlaylistId(place.playlistId);
      setIsFolderOpened(place.isFolderOpened);
    },
    [
      browseMode,
      drillInDrivenMode,
      setBrowseMode,
      setIsFolderOpened,
      setOpenAlbumId,
      setOpenArtistId,
      setOpenFolderPath,
      setOpenGenreId,
      setOpenPlaylistId,
    ],
  );

  const history = useLibraryHistory({ current, restore });
  const { remember, goBack, goForward } = history;

  /**
   * A playlist named in the rail: the Playlists shelf with that one open, in
   * one pass, from whichever shelf the reader was on.
   */
  const showPlaylist = useCallback(
    (playlistId: string) => {
      if (browseMode !== 'playlist') {
        drillInDrivenMode.current = 'playlist';
        setBrowseMode('playlist');
      }
      handleOpenPlaylist(playlistId);
    },
    [browseMode, drillInDrivenMode, handleOpenPlaylist, setBrowseMode],
  );

  /**
   * An artist's name pressed, or an album on an artist's page: the shelf
   * that lists them with that one open, in one pass, from wherever the
   * reader was (`libraryRecordLinks.ts`). Out of the folder the reader stood
   * in, as "show what is playing" steps out of it: an artist's page is not
   * narrowed to a folder, and the place bar would otherwise name a folder
   * over a record that is mostly elsewhere. Back puts the folder back.
   */
  const showRecord = useCallback(
    (mode: 'album' | 'artist', open: () => void) => {
      if (browseMode !== mode) {
        drillInDrivenMode.current = mode;
        setBrowseMode(mode);
      }
      setOpenFolderPath(undefined);
      setIsFolderOpened(false);
      setOpenPlaylistId(undefined);
      open();
    },
    [
      browseMode,
      drillInDrivenMode,
      setBrowseMode,
      setIsFolderOpened,
      setOpenFolderPath,
      setOpenPlaylistId,
    ],
  );
  const showArtist = useCallback(
    (artistId: string) =>
      showRecord('artist', () => handleOpenArtist(artistId)),
    [handleOpenArtist, showRecord],
  );
  const showAlbum = useCallback(
    (albumId: string) => showRecord('album', () => handleOpenAlbum(albumId)),
    [handleOpenAlbum, showRecord],
  );

  /** Somewhere to step up to when there is no history behind the reader:
   * the record open, or the folder they stand in. */
  const isNarrowed = hasOpenRecord || openFolderPath !== undefined;

  /**
   * Back: the place before the last move, and with none — a launch that
   * restored a folder, say — one step up the trail, as the place bar's Back
   * always was, so a narrowed shelf is never without a way out.
   */
  const handleGoBack = useCallback(() => {
    if (goBack()) {
      return;
    }
    if (hasOpenRecord) {
      handleBack();
      return;
    }
    setOpenFolderPath((path) =>
      path === undefined ? undefined : parentFolderPath(path, roots),
    );
  }, [goBack, handleBack, hasOpenRecord, roots, setOpenFolderPath]);

  const handleGoForward = useCallback(() => {
    goForward();
  }, [goForward]);

  // The moves keep their identities while only the arrows' state changes:
  // they reach memoised rows and covers, which should not redraw because a
  // step was taken somewhere else.
  const moves = useMemo(
    () => ({
      handleBrowseMode: stepping<[TLibraryBrowseMode]>(
        remember,
        handleBrowseMode,
      ),
      handleOpenFolder: stepping(remember, handleOpenFolder),
      handleShowPlaylist: stepping(remember, showPlaylist),
      handleOpenPlaylist: stepping(remember, handleOpenPlaylist),
      handleCoverFlowOpen: stepping(remember, handleCoverFlowOpen),
      handleOpenAlbum: stepping(remember, handleOpenAlbum),
      handleOpenArtist: stepping(remember, handleOpenArtist),
      handleOpenGenre: stepping(remember, handleOpenGenre),
      handleAllMusic: stepping(remember, handleAllMusic),
      handlePlaceFolder: stepping(remember, handlePlaceFolder),
      handleShowArtist: stepping(remember, showArtist),
      handleShowAlbum: stepping(remember, showAlbum),
    }),
    [
      remember,
      showArtist,
      showAlbum,
      handleBrowseMode,
      handleOpenFolder,
      showPlaylist,
      handleOpenPlaylist,
      handleCoverFlowOpen,
      handleOpenAlbum,
      handleOpenArtist,
      handleOpenGenre,
      handleAllMusic,
      handlePlaceFolder,
    ],
  );

  return {
    ...moves,
    canGoBack: history.canGoBack || isNarrowed,
    canGoForward: history.canGoForward,
    handleGoBack,
    handleGoForward,
  };
};

export type TLibrarySteps = ReturnType<typeof useLibrarySteps>;

export default useLibrarySteps;
