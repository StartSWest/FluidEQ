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

import { useCallback, useMemo, useRef } from 'react';
import {
  type ILibraryTrack,
  type TLibraryBrowseMode,
  type TLibrarySort,
} from '../../common/library/types';
import { type ILibraryListQuery } from '../../common/library/query';
import { useLibraryList } from './useLibraryList';
import {
  albumKey,
  artistKey,
  parentFolderPath,
  trackFolderPath,
} from '../../common/library/grouping';
import useLibraryPlaceRecord from './useLibraryPlaceRecord';
import { findPlaylist } from '../../common/library/playlists';
import { shelfTracksQueryFor } from './libraryShelfQuery';
import { useViewQueue } from './useViewQueue';
import { type TLibraryWorkspaceShelf } from './useLibraryWorkspaceShelf';

/**
 * Moving around the Library and playing from it: sorting, switching browse
 * mode, drilling into an album, artist, genre, folder or playlist and back,
 * searching, the queue a press starts, and the transport's restart — built
 * on the shelf and run after its hooks, in the order the workspace always
 * ran them.
 */
const useLibraryWorkspaceNavigation = (shelf: TLibraryWorkspaceShelf) => {
  const {
    isScanning,
    roots,
    playlists,
    playTracks,
    retargetQueue,
    upNext,
    playingTrack,
    isPlaying,
    seek,
    browseMode,
    setBrowseMode,
    setSortDirection,
    setSort,
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
    revealRow,
    isSearching,
    shelfState,
    shelfQuery,
  } = shelf;
  /**
   * A column header was pressed.
   *
   * Pressing the column already sorting reverses it; pressing a different one
   * moves to that column and starts ascending again, rather than inheriting
   * the previous column's direction — carrying a descending order across to a
   * newly chosen column gives an order nobody asked for.
   */
  const handleSort = useCallback(
    (key: TLibrarySort) => {
      // Asking for an order is what ends relevance ranking — see `viewSort`.
      setIsSortChosen(true);
      setSort((currentSort) => {
        setSortDirection((currentDirection) =>
          currentSort === key && currentDirection === 'asc' ? 'desc' : 'asc',
        );
        return key;
      });
    },
    [setIsSortChosen, setSort, setSortDirection],
  );

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
  const anchorQuery = useMemo((): ILibraryListQuery | undefined => {
    if (openAlbumId !== undefined) {
      return {
        shelf: 'tracks',
        scope: { album: openAlbumId },
        natural: 'disc',
        direction: 'asc',
      };
    }
    if (openArtistId !== undefined) {
      return {
        shelf: 'tracks',
        scope: { artist: openArtistId },
        natural: 'album',
        direction: 'asc',
      };
    }
    if (openFolderPath !== undefined) {
      return {
        shelf: 'tracks',
        scope: { folder: openFolderPath },
        natural: 'path',
        direction: 'asc',
      };
    }
    return undefined;
  }, [openAlbumId, openArtistId, openFolderPath]);
  /** The first song of whatever is open, as the store orders it. */
  const firstOfOpen = useLibraryList(anchorQuery).at(0);
  const drillInAnchor = useMemo(() => {
    if (anchorQuery === undefined) {
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
    return firstOfOpen?.kind === 'track' ? firstOfOpen.track : undefined;
  }, [
    anchorQuery,
    firstOfOpen,
    playingTrack,
    openAlbumId,
    openArtistId,
    openFolderPath,
  ]);

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
    [
      drillInAnchor,
      openFolderPath,
      revealRow,
      drillInDrivenMode,
      setBrowseMode,
      setOpenAlbumId,
      setOpenArtistId,
      setOpenFolderPath,
      setOpenPlaylistId,
    ],
  );

  const handleOpenFolder = useCallback(
    (folderPath: string) => {
      setOpenAlbumId(undefined);
      setOpenArtistId(undefined);
      setOpenGenreId(undefined);
      setOpenFolderPath(folderPath);
    },
    [setOpenAlbumId, setOpenArtistId, setOpenFolderPath, setOpenGenreId],
  );

  const handleOpenPlaylist = useCallback(
    (playlistId: string) => {
      setOpenAlbumId(undefined);
      setOpenArtistId(undefined);
      setOpenGenreId(undefined);
      setOpenPlaylistId(playlistId);
    },
    [setOpenAlbumId, setOpenArtistId, setOpenGenreId, setOpenPlaylistId],
  );

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
    [
      browseMode,
      setOpenAlbumId,
      setOpenArtistId,
      setOpenFolderPath,
      setOpenGenreId,
      setOpenPlaylistId,
    ],
  );

  /**
   * The genre and the playlist that are open, only on their own shelves.
   *
   * Gated because the ids are restored from storage independently at launch:
   * a stale genre would otherwise open over the Albums shelf, and a stale
   * playlist put itself on it — both the chip handler and the mode effect
   * clear them, but a restart is neither.
   */
  const shelfGenreId = browseMode === 'genre' ? openGenreId : undefined;
  const shelfPlaylistId =
    browseMode === 'playlist' ? openPlaylistId : undefined;

  /**
   * A record is open beneath wherever the reader stands: an album, an
   * artist, a genre or a playlist. The folder is not one — it is where they
   * stand (`scopedTracks`) — and Back closes a record before it moves them.
   */
  const hasOpenRecord = Boolean(
    openAlbumId ||
    openArtistId ||
    shelfGenreId !== undefined ||
    shelfPlaylistId !== undefined,
  );

  /**
   * A drill-in is open, so the list the toolbar steers is not the thing on
   * screen.
   *
   * A folder counts only on the Folders shelf, and only while nothing is
   * searched. Everywhere else it is not a drill-in at all: it is where the
   * reader is standing, and the shelf goes on drawing albums or artists — the
   * ones inside it. And a search from inside it is answered by the shelf,
   * that folder's matches first and the rest after (`libraryShelfQuery.ts`),
   * not by the folder's own panel, which would show only the first half.
   */
  const isDrilledIn =
    hasOpenRecord ||
    (openFolderPath !== undefined && browseMode === 'folder' && !isSearching);

  const placeRecord = useLibraryPlaceRecord({
    albumId: openAlbumId,
    artistId: openArtistId,
    genreId: shelfGenreId,
    playlistId: shelfPlaylistId,
  });

  /**
   * A search reaches the whole library, and keeps the reader where they are.
   *
   * This box says "search songs, artists, albums" and means the library, not
   * the folder somebody happens to be inside — answering from that folder
   * alone looked like a library with almost nothing in it. It used to step
   * out to the root to get there, which lost the place. Now the folder stays
   * where it is on the place bar, the search reaches everywhere, and what
   * matched in that folder and beneath it comes first, under a heading of its
   * own, with everything else after under another (Ivan, 2026-09-23).
   *
   * A record open beneath the folder — an album, an artist — does close: it
   * is a thing that was opened, the search is for something else, and the
   * shelf is where its answer is drawn.
   */
  const handleQuery = useCallback(
    (next: string) => {
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
    },
    [
      setIsSortChosen,
      setOpenAlbumId,
      setOpenArtistId,
      setOpenGenreId,
      setOpenPlaylistId,
      setQuery,
    ],
  );

  /** The toolbar's arrow: reverses whatever column is already chosen. The
   * dropdown beside it picks the column and leaves the direction alone, so
   * the two together say the same thing a header click says in one press. */
  const handleSortDirection = useCallback(() => {
    setIsSortChosen(true);
    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
  }, [setIsSortChosen, setSortDirection]);

  /** The bar's dropdown: names a column and nothing else. Direction is the
   * arrow beside it, which is why this does not toggle one — unlike
   * `handleSort`, where the header press IS both. */
  const handlePickSort = useCallback(
    (key: TLibrarySort) => {
      setIsSortChosen(true);
      setSort(key);
    },
    [setIsSortChosen, setSort],
  );

  // Opening one closes the other — only one drill-in is ever on screen.
  // Stable identities, all three. A fresh closure each render is a changed
  // prop, a changed prop defeats the rows' own `memo`, and every row in the
  // list then re-renders for a state change none of them care about — which
  // during a scan is several times a second.
  const handleOpenAlbum = useCallback(
    (albumId: string) => {
      setOpenArtistId(undefined);
      setOpenGenreId(undefined);
      setOpenAlbumId(albumId);
    },
    [setOpenAlbumId, setOpenArtistId, setOpenGenreId],
  );
  const handleOpenArtist = useCallback(
    (artistId: string) => {
      setOpenAlbumId(undefined);
      setOpenGenreId(undefined);
      setOpenArtistId(artistId);
    },
    [setOpenAlbumId, setOpenArtistId, setOpenGenreId],
  );
  const handleOpenGenre = useCallback(
    (genreId: string) => {
      setOpenAlbumId(undefined);
      setOpenArtistId(undefined);
      setOpenGenreId(genreId);
    },
    [setOpenAlbumId, setOpenArtistId, setOpenGenreId],
  );
  const closeRecords = useCallback(() => {
    setOpenAlbumId(undefined);
    setOpenArtistId(undefined);
    setOpenGenreId(undefined);
    setOpenPlaylistId(undefined);
  }, [setOpenAlbumId, setOpenArtistId, setOpenGenreId, setOpenPlaylistId]);

  /**
   * ONE STEP UP THE TRAIL THE PLACE BAR DRAWS — the Library's only Back.
   *
   * The record open beneath the folder first, and the folder stays: closing
   * an album used to walk the folder up a level as well, which landed on a
   * shelf narrowed to the parent with no Back left on it (Ivan, 2026-09-23).
   * With no record open, one folder up — back out of `Artist/Album` in a file
   * manager is `Artist` — in both readings, and out of a root into the whole
   * library. It is also how a panel closes itself (an orphan, a deleted
   * playlist), which is the same step.
   */
  const handleBack = useCallback(() => {
    if (hasOpenRecord) {
      closeRecords();
      return;
    }
    setOpenFolderPath((current) =>
      current === undefined ? undefined : parentFolderPath(current, roots),
    );
  }, [closeRecords, hasOpenRecord, roots, setOpenFolderPath]);

  /** The first step of the trail: out of every folder and every record. */
  const handleAllMusic = useCallback(() => {
    closeRecords();
    setOpenFolderPath(undefined);
  }, [closeRecords, setOpenFolderPath]);

  /** A folder step of the trail, pressed: stand there, nothing open in it. */
  const handlePlaceFolder = useCallback(
    (folderPath: string) => {
      closeRecords();
      setOpenFolderPath(folderPath);
    },
    [closeRecords, setOpenFolderPath],
  );
  /**
   * The songs of the record open on screen, in the order its own panel lists
   * them — the album as pressed, an artist or a genre by album, a folder's own
   * files by name, a playlist in its own order — so the order the bar plays
   * through matches the order on screen. Only the songs the library can see:
   * a playlist's song on an unplugged drive is not one the player can be
   * handed.
   */
  const recordQueueQuery = useMemo((): ILibraryListQuery | undefined => {
    if (openPlaylistId !== undefined && browseMode === 'playlist') {
      const playlist = findPlaylist(playlists, openPlaylistId);
      return playlist === undefined
        ? undefined
        : {
            shelf: 'tracks',
            scope: { ids: playlist.trackIds },
            natural: 'ids',
            direction: 'asc',
          };
    }
    if (openAlbumId) {
      return {
        shelf: 'tracks',
        scope: { album: openAlbumId },
        natural: 'disc',
        direction: 'asc',
      };
    }
    if (openArtistId) {
      return {
        shelf: 'tracks',
        scope: { artist: openArtistId },
        natural: 'album',
        direction: 'asc',
      };
    }
    // `trackGenreIds` membership, as the shelf builds genres: a file tagged
    // "Rock; Pop" is on both, and plays from either.
    if (openGenreId !== undefined && browseMode === 'genre') {
      return {
        shelf: 'tracks',
        scope: { genre: openGenreId },
        natural: 'album',
        direction: 'asc',
      };
    }
    // The folder open on its own shelf, exactly as its panel lists it: its
    // own files, in path order, and not the ones in the folders below it.
    if (
      openFolderPath !== undefined &&
      browseMode === 'folder' &&
      !isSearching
    ) {
      return {
        shelf: 'tracks',
        scope: { folder: openFolderPath },
        natural: 'path',
        direction: 'asc',
      };
    }
    return undefined;
  }, [
    openAlbumId,
    openArtistId,
    openGenreId,
    openPlaylistId,
    playlists,
    openFolderPath,
    browseMode,
    isSearching,
  ]);
  const shelfTracksQuery = useMemo(
    () => shelfTracksQueryFor(shelfState, shelfQuery),
    [shelfState, shelfQuery],
  );
  const upNextIds = useMemo(
    () => upNext.map((entry) => entry.trackId),
    [upNext],
  );

  /**
   * What plays next follows what is on screen, and how much of it is still
   * to come — see `useViewQueue`. A track this build cannot decode is still
   * handed to the player rather than swallowed here: the player marks it
   * unplayable and the bar says so, which is the honest answer to a click
   * that cannot do anything.
   */
  const { restTotal: upNextRestTotal, playTrack: handlePlayTrack } =
    useViewQueue({
      recordQuery: recordQueueQuery,
      shelfQuery: shelfTracksQuery,
      playingTrackId: playingTrack?.id,
      upNextIds,
      isScanning,
      playTracks,
      retargetQueue,
    });

  /**
   * A DOUBLE-PRESS ON A SONG STARTS IT AGAIN, as it does in the player's
   * queue (Ivan, 2026-09-23). Every view sends the second press of a
   * double-press here instead of to `handlePlayTrack`.
   *
   * Back to the top only for a song that was ALREADY on the transport when
   * the double-press began (`transportAtPressRef`). A song the first press has
   * just started is at the top already, and seeking it back to nought would
   * replay whatever of its opening had been heard. The song is still asked for
   * whenever it is not sounding: a first press that only turned a cover to the
   * centre has played nothing, and a paused song started again should be
   * heard.
   *
   * Read through a ref rather than depended on, so the handler keeps one
   * identity and the memoised rows are not all drawn again at every play,
   * pause and song change.
   */
  const transportRef = useRef({ trackId: playingTrack?.id, isPlaying });
  transportRef.current = { trackId: playingTrack?.id, isPlaying };
  const transportAtPressRef = useRef<string | undefined>(undefined);
  const handleRestartTrack = useCallback(
    (trackId: string) => {
      const transport = transportRef.current;
      if (transport.trackId !== trackId || !transport.isPlaying) {
        handlePlayTrack(trackId);
      }
      if (transportAtPressRef.current === trackId) {
        seek(0);
      }
    },
    [handlePlayTrack, seek],
  );

  return {
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
  };
};

export type TLibraryWorkspaceNavigation = ReturnType<
  typeof useLibraryWorkspaceNavigation
>;

export default useLibraryWorkspaceNavigation;
