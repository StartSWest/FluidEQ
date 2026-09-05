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
import {
  ILibraryFolder,
  artistKey,
  folderChildren,
  folderDisplayName,
  normalizeForGrouping,
  groupIntoAlbums,
  groupIntoArtists,
  searchTracks,
  sortTracks,
  trackFolderPath,
} from '../../common/library/grouping';
import {
  UNKNOWN_GENRE_ID,
  groupIntoGenres,
  trackGenreIds,
} from '../../common/library/genres';
import {
  ILibraryTrack,
  TLibrarySort,
  TLibrarySortDirection,
  TLibraryViewMode,
} from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import libraryFilterHistory from '../utils/libraryFilterHistory';
import LibraryCoverArt from './LibraryCoverArt';
import LibraryFolderArt from './LibraryFolderArt';
import LibraryGridView from './LibraryGridView';
import LibrarySearchField from './LibrarySearchField';
import LibraryListView from './LibraryListView';
import TextInput from '../widgets/TextInput';
import {
  FAVORITES_PLAYLIST_ID,
  MAX_PLAYLIST_NAME_LENGTH,
  findPlaylist,
} from '../../common/library/playlists';
import { usePlaylists } from './PlaylistContext';
import LibraryTrackMenu from './LibraryTrackMenu';
import { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import { useFolderTree } from './folderTree';

interface ILibraryDetailProps {
  tracks: readonly ILibraryTrack[];
  albumId?: string;
  artistId?: string;
  /** A genre bucket, opened from the Genres shelf. Mutually exclusive with
   * the others the same way they are with each other. */
  genreId?: string;
  /** A physical directory, opened from the folder browse mode. Mutually
   * exclusive with the other two the same way they are with each other. */
  folderPath?: string;
  /** A playlist, opened from the Playlists shelf. Mutually exclusive with
   * the three above the same way they are with each other. */
  playlistId?: string;
  onBack: () => void;
  onPlayTrack: (trackId: string) => void;
  /** Put this panel's whole list at the end of what is already queued.
   * Optional the way the other display-only props here are: a caller with no
   * player behind it simply does not draw the button. */
  onQueueTracks?: (trackIds: readonly string[]) => void;
  /** Forwarded straight to the `LibraryListView` this renders — see that
   * component's own doc comment for why it stays optional. */
  offlineRootIds?: ReadonlySet<string>;
  /** The library roots, so a folder drill-in can list what is inside it and
   * know when it has reached the top — see `folderChildren`. */
  folderRoots?: readonly { path: string }[];
  /** Walk into a folder from this panel. Only the Directories reading ever
   * has one to walk into. */
  onOpenFolder?: (folderPath: string) => void;
  /** Which of the toolbar's three views the reader chose. Honoured here as
   * well as outside, because switching to Grid and then opening an album used
   * to drop them back into a table — the toggle appeared to stop working the
   * moment it had something to show. Cover Flow falls back to the list: a
   * carousel of the twelve tracks on one album is a worse table, not a
   * better one. */
  viewMode?: TLibraryViewMode;
  /** The track the player is on, forwarded to the table below. */
  playingTrackId?: string;
  /** A row to scroll to and mark — forwarded straight through. See
   * `LibraryListView`'s own prop of the same name. */
  revealTrack?: { trackId: string; nonce: number };
  /**
   * The toolbar's search, applied here ONLY when it is not what found this
   * panel — see `listTracks` for the rule and why it has to be a rule.
   */
  query?: string;
}

/**
 * The drill-in behind a grid tile or a list row: a header for the one album
 * or artist, then its songs — `LibraryListView` in `browseMode="song"`
 * rather than a second table, so playability badges, the metadata-error
 * badge, keyboard rows and the reveal menu all still work here.
 *
 * `albumId` and `artistId` are mutually exclusive in practice — the
 * workspace that owns the drill-in state only ever sets one — but both are
 * optional here rather than a discriminated union, matching the interface
 * Task 15's brief specifies.
 */
/** The directory a file sits in. Splits on both separators for the same
 * reason `videoFolderGroups` does: a path arrives as Windows text but nothing
 * guarantees every one of them was written with a backslash. */
const trackFolder = (filePath: string): string => {
  const normalised = filePath.replace(/\\/g, '/');
  const cut = normalised.lastIndexOf('/');
  return cut > 0 ? normalised.slice(0, cut) : normalised;
};

const NO_FOLDER_ROOTS: readonly { path: string }[] = [];
const EMPTY_CHILDREN: readonly ILibraryFolder[] = [];

const LibraryDetail = ({
  tracks,
  albumId,
  artistId,
  genreId,
  folderPath,
  playlistId,
  onBack,
  onPlayTrack,
  onQueueTracks,
  offlineRootIds,
  folderRoots = NO_FOLDER_ROOTS,
  onOpenFolder,
  viewMode = 'list',
  playingTrackId,
  revealTrack,
  query = '',
}: ILibraryDetailProps) => {
  const { t } = useTranslation();
  const asTree = useFolderTree();
  const { playlists, renamePlaylist, deletePlaylist } = usePlaylists();
  /** The header's rename field while it is open; `undefined` when it is not.
   * Empty string is a legitimate half-typed name, so "is it open" cannot be
   * asked of the text. */
  const [draftName, setDraftName] = useState<string | undefined>(undefined);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  // The header's own "more" menu — the row menu, handed the whole record.
  const containerMenuRef = useRef<HTMLButtonElement | null>(null);
  const [isContainerMenuOpen, setIsContainerMenuOpen] = useState(false);

  // Closes on a click elsewhere and on Escape, the same pattern every other
  // `AnchoredMenu` here uses — the portalled menu has to be asked about
  // separately from the trigger, or pressing an item inside it dismisses the
  // menu before the press lands.
  useEffect(() => {
    if (!isContainerMenuOpen) {
      return undefined;
    }
    const onPointerDown = (event: globalThis.MouseEvent) => {
      if (
        !isInsideAnchoredMenu(event.target) &&
        event.target !== containerMenuRef.current
      ) {
        setIsContainerMenuOpen(false);
      }
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsContainerMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isContainerMenuOpen]);

  /**
   * WITHIN A SEARCH, THE TREE IS THE WAY TO THE MATCHES.
   *
   * The folders under this one are computed from whatever track list they are
   * handed, and handing them the whole library drew every subdirectory
   * regardless of the query — so walking into a folder and pressing Back came
   * back to an unfiltered tree, and the search appeared to have been dropped
   * on the way.
   *
   * Narrowed unless the folder standing here is itself what was searched for,
   * which is the same rule the table below uses: name the container and you
   * get all of it, name something inside it and you get the way there.
   */
  const treeTracks = useMemo(() => {
    const needle = normalizeForGrouping(query);
    if (needle === '') {
      return tracks;
    }
    if (
      folderPath &&
      normalizeForGrouping(folderDisplayName(folderPath)).includes(needle)
    ) {
      return tracks;
    }
    return searchTracks(tracks, query);
  }, [folderPath, query, tracks]);

  /** The folders inside this one, and only in the reading that has them. */
  const childFolders = useMemo(
    () =>
      asTree && folderPath
        ? folderChildren(treeTracks, folderPath)
        : EMPTY_CHILDREN,
    [asTree, folderPath, treeTracks],
  );

  /**
   * The column this table is ordered by, or nothing at all.
   *
   * Its own state rather than the toolbar's, because an album's default order
   * is not a column: it is disc-then-track, the order the record was pressed
   * in, and inheriting "Title" from outside would silently alphabetise every
   * album the reader opened. `undefined` means that natural order, and only a
   * header click leaves it.
   */
  const [sort, setSort] = useState<TLibrarySort | undefined>(undefined);
  const [sortDirection, setSortDirection] =
    useState<TLibrarySortDirection>('asc');

  /** Narrows this table and nothing else. Its own state, cleared with the
   * drill-in itself, because it is a question about one album rather than a
   * standing filter the way the toolbar's search is. */
  const [filter, setFilter] = useState('');

  /** Same rule as the workspace's own: the current column reverses, a
   * different one starts ascending rather than inheriting a direction nobody
   * asked it for. */
  const handleSort = useCallback((key: TLibrarySort) => {
    setSort((current) => {
      setSortDirection((direction) =>
        current === key && direction === 'asc' ? 'desc' : 'asc',
      );
      return key;
    });
  }, []);

  // `groupIntoAlbums`/`groupIntoArtists` walk every track in the library.
  // Memoised on the track list and the id actually being opened, so a
  // re-render this drill-in did not ask for does not redo it — see
  // `LibraryGridView`'s identical reasoning.
  const album = useMemo(
    () =>
      albumId
        ? groupIntoAlbums(tracks).find((entry) => entry.id === albumId)
        : undefined,
    [tracks, albumId],
  );
  const artist = useMemo(
    () =>
      artistId
        ? groupIntoArtists(tracks).find((entry) => entry.id === artistId)
        : undefined,
    [tracks, artistId],
  );
  const genre = useMemo(
    () =>
      genreId
        ? groupIntoGenres(tracks).find((entry) => entry.id === genreId)
        : undefined,
    [tracks, genreId],
  );

  /**
   * Everything on this shelf, by album so a genre reads as records rather
   * than as a thousand loose songs.
   *
   * `trackGenreIds` rather than a direct compare on `track.genre`, because a
   * file tagged "Rock; Pop" belongs to both and a string comparison would
   * find it under neither. Same rule as `groupIntoGenres` builds the shelf
   * with — the two have to agree, or the shelf says forty songs and the
   * panel lists nine, which is the failure `artistKey`'s own comment
   * records happening once already.
   */
  const genreTracks = useMemo(
    () =>
      genreId
        ? sortTracks(
            tracks.filter((track) => trackGenreIds(track).includes(genreId)),
            'album',
          )
        : [],
    [tracks, genreId],
  );

  // An id whose album or artist no longer exists — a rescan dropped the
  // folder, or the root itself was removed while this was open. Left alone,
  // the screen below would settle on "Unknown album", a generated tile, a
  // Play button that does nothing, and no way back other than knowing the
  // Back button is there: the blank-screen-with-no-explanation shape this
  // project's rules are written against. Closing automatically, rather than
  // showing that and waiting for the user to notice, is the only answer
  // that does not require them to.
  /** The tracks in one physical directory, in filename order — the order the
   * folder itself is in, which is the whole point of looking at one. */
  const folderTracks = useMemo(() => {
    if (!folderPath) {
      return [];
    }
    return tracks
      .filter((entry) => trackFolderPath(entry.path) === folderPath)
      .sort((left, right) => left.path.localeCompare(right.path));
  }, [tracks, folderPath]);

  // A FOLDER WITH NOTHING LOOSE IN IT IS NOT AN ORPHAN — it is most folders.
  //
  // This closes a drill-in whose subject has gone: a rescan dropped the album,
  // the root was removed while it was open. For a folder it asked whether any
  // track sits *directly* inside, which is exactly false for `D:/Music` when
  // every song lives a level down — so in the tree the first thing anybody
  // pressed opened and shut in the same frame, and the root was the one folder
  // that could not be walked into. What is inside it counts as well; a folder
  // with neither files nor children is the one that is genuinely gone.
  const playlist = useMemo(
    () => (playlistId ? findPlaylist(playlists, playlistId) : undefined),
    [playlists, playlistId],
  );

  /**
   * The playlist's songs, in the playlist's own order.
   *
   * Ids the library cannot resolve are dropped from the listing and counted
   * instead — see `missingCount`. They are NOT dropped from the playlist:
   * an unplugged drive takes its tracks out of the index and gives them
   * back, and a playlist that pruned itself every time a drive was out
   * would empty over a few weeks with nothing ever having gone wrong.
   */
  const playlistTracks = useMemo(() => {
    if (!playlist) {
      return [];
    }
    const byId = new Map(tracks.map((track) => [track.id, track]));
    return playlist.trackIds
      .map((id) => byId.get(id))
      .filter((track): track is ILibraryTrack => track !== undefined);
  }, [playlist, tracks]);

  const missingCount = playlist
    ? playlist.trackIds.length - playlistTracks.length
    : 0;

  // AN EMPTY PLAYLIST IS NOT AN ORPHAN. Favourites starts empty and stays
  // empty until somebody presses the star, so emptiness here has to mean
  // "nothing in it yet" — only an id no playlist answers to is gone.
  const isOrphaned =
    (Boolean(albumId) && !album) ||
    (Boolean(artistId) && !artist) ||
    (Boolean(genreId) && !genre) ||
    (Boolean(playlistId) && !playlist) ||
    (Boolean(folderPath) &&
      folderTracks.length === 0 &&
      childFolders.length === 0);

  useEffect(() => {
    if (isOrphaned) {
      onBack();
    }
  }, [isOrphaned, onBack]);

  // The album's own `trackIds` are already in disc/track/title order; an
  // artist has no such order of its own, so its tracks are grouped by album
  // the same way `LibraryToolbar`'s "Album" sort does.
  const detailTracks = useMemo(() => {
    if (albumId) {
      const byId = new Map(tracks.map((track) => [track.id, track]));
      return (album?.trackIds ?? [])
        .map((id) => byId.get(id))
        .filter((track): track is ILibraryTrack => track !== undefined);
    }
    if (artistId) {
      return sortTracks(
        tracks.filter((track) => artistKey(track) === artistId),
        'album',
      );
    }
    if (genreId) {
      return genreTracks;
    }
    if (playlistId) {
      return playlistTracks;
    }
    return folderTracks;
  }, [
    tracks,
    album,
    albumId,
    artistId,
    genreId,
    genreTracks,
    playlistId,
    playlistTracks,
    folderTracks,
  ]);

  /**
   * The directory this drill-in is standing in, drawn beside Back.
   *
   * There were two Backs on screen for a while — this one, and a second on
   * the workspace above carrying the folder scope's path. They did different
   * things and only one of them said where you were, so the path moved here,
   * onto the control that leaves.
   *
   * A folder drill-in knows its own directory. An album or an artist does
   * not, so it is taken from the first file in the list — which is the folder
   * the reader would find it in, and the only honest answer for a selection
   * that can span several.
   */
  const detailFolder = useMemo(() => {
    if (folderPath) {
      return folderPath;
    }
    // A playlist deliberately has no folder. Its songs come from wherever
    // the reader put them, so the first one's directory is not "where this
    // is" — it is one of them, printed as though it were all of them.
    if (playlistId) {
      return undefined;
    }
    // AND OTHERWISE ONLY WHEN THERE IS ONE ANSWER.
    //
    // A folder drill-in knows its directory. An album usually has one too.
    // An artist very often does not — Nsync is two records in two folders —
    // and taking the first track's folder named one of them over a list
    // holding both, which is a path that is wrong for most of what is under
    // it. Where the tracks disagree the line simply is not drawn: no path is
    // better than a path that points at a third of the table. Same reasoning
    // the playlist case above reaches by a shorter route.
    const [first] = detailTracks;
    if (!first) {
      return undefined;
    }
    const folder = trackFolder(first.path);
    return detailTracks.every((track) => trackFolder(track.path) === folder)
      ? folder
      : undefined;
  }, [detailTracks, folderPath, playlistId]);

  /**
   * Files sitting in the same folders as this album, that the album does not
   * account for.
   *
   * A folder is very often not one clean album: a bonus disc, a couple of
   * loose singles, a live take tagged differently. Showing only the tagged
   * album hides them — the user opened a folder's worth of music and got
   * fewer songs than they know are there, with nothing saying why. Showing
   * them merged into the album would be the opposite lie.
   *
   * So they sit at the end of the same list, each row tagged as belonging to
   * the folder rather than to the album. A second table under its own heading
   * was tried first and read as two unrelated screens stacked up; one list
   * with a mark on the rows that are not part of the album says the same
   * thing without splitting the page in half.
   *
   * Only for an album drill-in: an artist is not a folder, and the same
   * question does not arise.
   */
  const strayTracks = useMemo(() => {
    if (!albumId || detailTracks.length === 0) {
      return [];
    }
    const included = new Set(detailTracks.map((track) => track.id));
    const folders = new Set(
      detailTracks.map((track) => trackFolder(track.path)),
    );
    return sortTracks(
      tracks.filter(
        (track) =>
          !included.has(track.id) && folders.has(trackFolder(track.path)),
      ),
      'title',
    );
  }, [tracks, detailTracks, albumId]);

  /**
   * WHY THIS PANEL CAME UP DECIDES WHAT IT SHOWS.
   *
   * Both readings of the toolbar's search are right, and which one applies
   * depends on what matched:
   *
   *   Searching "nsync" and opening CELEBRITY — the record itself is what the
   *   query named. Narrowing it then showed two of its fourteen tracks under
   *   a heading reading "2 songs", with the album sitting right there on disk.
   *   The whole record is what was asked for.
   *
   *   Searching "nsync" and opening VARIOS — a five-hundred-track compilation
   *   that came up because two songs on it are by that band. Showing all five
   *   hundred answers a question nobody asked; the two are the reason it is
   *   on screen at all.
   *
   * So: if the query names this album, artist or folder, it found the
   * container and the container is shown whole. If it does not, it found
   * tracks inside, and those tracks are what is drawn.
   */
  const isQueryTheContainer = useMemo(() => {
    // Folded the way GROUPING folds, not the way searching does.
    //
    // The search box keeps punctuation on purpose — somebody who types an
    // apostrophe means it — but this question is "is the thing I am looking
    // at the thing that was asked for", and that is the same question
    // `albumKey` answers. With the search normaliser, typing "nsync" over a
    // record whose artist reads `N'Sync` came out as no match, the panel
    // narrowed itself to the two tracks tagged without the apostrophe, and
    // fourteen songs read as two all over again.
    const needle = normalizeForGrouping(query);
    if (needle === '') {
      return true;
    }
    return [
      album?.title,
      album?.artist,
      artist?.name,
      // The genre's own name counts as the container being named: typing
      // "rock" and opening Rock is the search finding this shelf, not a
      // reason to light two of its four hundred songs.
      genre?.name,
      folderPath ? folderDisplayName(folderPath) : undefined,
    ].some(
      (value) =>
        value !== undefined && normalizeForGrouping(value).includes(needle),
    );
  }, [album, artist, genre, folderPath, query]);

  // One list: the album's own tracks, then its folder-mates behind them. The
  // panel's own "filter these songs" is the only thing that ever removes a
  // row from it.
  const baseTracks = useMemo(() => {
    const combined = searchTracks([...detailTracks, ...strayTracks], filter);
    // Untouched until a header is pressed — see `sort`'s own comment on why
    // an album's default order is not a column.
    return sort ? sortTracks(combined, sort, sortDirection) : combined;
  }, [detailTracks, strayTracks, sort, sortDirection, filter]);

  /**
   * The tracks the toolbar's search actually named, when it was not this
   * container it named.
   *
   * MARKED, NOT FILTERED. Hiding the rest was the first answer and it lied by
   * omission: a five-hundred-track compilation that came up because two songs
   * on it are by the band searched for is still a five-hundred-track
   * compilation, and showing two rows under its name says it is an N'Sync
   * record. The whole thing is drawn, the two are lit, and the header says
   * how many of how many — which is the honest answer to "why is this here".
   */
  const matchedIds = useMemo(() => {
    if (isQueryTheContainer || normalizeForGrouping(query) === '') {
      return new Set<string>();
    }
    return new Set(searchTracks(baseTracks, query).map((track) => track.id));
  }, [baseTracks, isQueryTheContainer, query]);

  /**
   * The matches first, then everything else in the order it was already in.
   *
   * A reader who searched for a band and opened a compilation is looking for
   * the two songs, not for row four hundred and six. Putting them at the head
   * of the table is what makes the panel answer the question that opened it,
   * and the colour on those rows is where one group ends and the other
   * begins — no heading needed, because the change of colour IS the heading.
   */
  const listTracks = useMemo(() => {
    if (matchedIds.size === 0) {
      return baseTracks;
    }
    return [
      ...baseTracks.filter((track) => matchedIds.has(track.id)),
      ...baseTracks.filter((track) => !matchedIds.has(track.id)),
    ];
  }, [baseTracks, matchedIds]);
  const folderOnlyIds = useMemo(
    () => new Set(strayTracks.map((track) => track.id)),
    [strayTracks],
  );

  // Nothing to draw once the effect above has asked to leave — one render
  // of "Unknown album" and a dead Play button is exactly the flash this
  // guard exists to skip.
  if (isOrphaned) {
    return null;
  }

  const isAlbum = Boolean(albumId);
  const isFolder = Boolean(folderPath);
  const isGenre = Boolean(genreId);
  const isPlaylist = Boolean(playlistId);
  // Favourites is the one playlist that is not the reader's to rename or
  // remove. Checked against what is stored rather than against the id alone,
  // so a future second built-in needs no change here.
  const isBuiltInPlaylist = playlist?.isBuiltIn === true;
  // A FOLDER WITH NOTHING BUT FOLDERS IN IT IS A WAY THROUGH, NOT A RECORD.
  //
  // The header — a cover the size of a sleeve, the name, a Play button — and
  // the table under it are for something you can listen to. Standing in
  // `Music`, with fourteen thousand songs all of them one level down, that
  // block was a generated tile over an empty table with a Play button between
  // them, and the subfolders you actually came for pushed off the bottom of
  // the screen. Here the panel is the way in and nothing else; the moment a
  // folder has files of its own, its own record appears.
  const isWayThrough =
    isFolder && folderTracks.length === 0 && childFolders.length > 0;
  const folderName = folderPath ? folderDisplayName(folderPath) : '';
  let title = artist?.name || t('library.unknownArtist');
  if (isAlbum) {
    title = album?.title || t('library.unknownAlbum');
  } else if (isFolder) {
    title = folderName;
  } else if (isGenre) {
    title =
      genreId === UNKNOWN_GENRE_ID
        ? t('library.genre.unknown')
        : (genre?.name ?? '');
  } else if (isPlaylist) {
    title =
      playlistId === FAVORITES_PLAYLIST_ID
        ? t('library.playlist.favorites')
        : (playlist?.name ?? '');
  }
  // The full path under a folder's name: its last segment is what the reader
  // recognises, but "CD1" on its own says nothing about which CD1.
  let subtitle = '';
  if (isAlbum) {
    subtitle = album?.artist || t('library.unknownArtist');
  } else if (isFolder) {
    subtitle = folderPath ?? '';
  } else if (isPlaylist && missingCount > 0) {
    // The one thing a playlist's second line is worth saying: the list holds
    // more than the table shows, and the difference is not a bug. Without it
    // an unplugged drive makes a playlist look as though it lost songs.
    subtitle = t('library.playlist.missing', { count: missingCount });
  }
  let counts = `${t('library.albumCount', { count: artist?.albumCount ?? 0 })} · ${t(
    'library.trackCount',
    { count: artist?.trackCount ?? detailTracks.length },
  )}`;
  if (isAlbum || isFolder) {
    // What is in the table, not what the tags agree on.
    //
    // An album's own tracks are the ones tagged for it; the rows below them
    // are the folder-mates the record does not account for — a bonus disc,
    // loose singles, anything tagged differently — and they are drawn in this
    // very table, marked, on purpose. Counting only the tagged ones put "2
    // songs" over a list of fourteen.
    counts = t('library.trackCount', { count: listTracks.length });
  }
  if (isGenre) {
    // How many bands and how many songs — the artist shelf's own pair, with
    // the first count swapped for the one a genre actually has. Albums would
    // be the wrong number here: a genre spanning forty records says nothing
    // about how varied it is, and twenty artists says exactly that.
    counts = `${t('library.artistCount', { count: genre?.artistCount ?? 0 })} · ${t(
      'library.trackCount',
      { count: genre?.trackCount ?? detailTracks.length },
    )}`;
  }
  if (isPlaylist) {
    // What the playlist holds, including the songs the library cannot see
    // right now — the subtitle above says how many of them there are. A
    // count that only totalled what is on screen would make a playlist look
    // as though it had shrunk.
    const held = playlist?.trackIds.length ?? 0;
    counts = t(
      held === 1
        ? 'library.playlist.songCountOne'
        : 'library.playlist.songCount',
      { count: held },
    );
  }
  // A folder with subfolders counts what is under it, not what is loose in
  // it: standing in `Music` and reading "0 songs" while five hundred sit one
  // level down is the kind of true that reads as broken.
  if (isFolder && childFolders.length > 0) {
    counts = t('library.trackCount', {
      count:
        detailTracks.length +
        childFolders.reduce((total, child) => total + child.trackCount, 0),
    });
  }

  // The header's picture. Inside a directory this is whatever cover was found
  // first beneath it and belongs to no record in particular — which is why the
  // folder branch below draws it inside a folder rather than as one.
  const headerArtId =
    (isAlbum || isFolder ? album?.artId : artist?.artId) ??
    detailTracks.find((entry) => entry.artId !== undefined)?.artId;

  const handlePlay = () => {
    // THE FIRST ROW OF THE TABLE UNDER IT, not the first of the whole album.
    //
    // The two differ whenever the reader has typed in the filter or clicked a
    // column: Play started the record from its first track while the list in
    // front of them began somewhere else, which reads as a button that
    // ignored the screen it is on. Falls back to the album's own order for
    // the one case where the table is empty and the header is still up.
    const first = listTracks[0] ?? detailTracks[0];
    if (first) {
      onPlayTrack(first.id);
    }
  };

  return (
    <div className="library-detail">
      {/* Back on the left, the path beside it, one line. The filter used to
          end this row and sat a whole header away from the table it narrows,
          up on the line with the toolbar's own library-wide box — two search
          fields stacked one above the other, neither saying which was which.
          It now stands directly over the list it filters (see the header
          below), which is the only place a filter reads as belonging to
          something. */}
      <div className="library-detail__top">
        <button
          type="button"
          className="library-toolbar__chip library-detail__back"
          onClick={onBack}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3L5 8l5 5" />
          </svg>
          <span>{t('library.back')}</span>
        </button>
        {detailFolder !== undefined && (
          <span className="library-detail__folder" title={detailFolder}>
            {detailFolder}
          </span>
        )}
      </div>
      {!isWayThrough && (
        <div className="library-detail__header">
          {isFolder ? (
            <LibraryFolderArt artId={headerArtId} label={title} size="cover" />
          ) : (
            <LibraryCoverArt artId={headerArtId} label={title} size="cover" />
          )}
          <div className="library-detail__info">
            {/* The name becomes the field it is edited in, in place. A modal
                for one text box would cover the very list that says which
                playlist this is. */}
            {draftName !== undefined ? (
              <div className="library-detail__rename">
                <TextInput
                  value={draftName}
                  ariaLabel={t('library.playlist.newName')}
                  isDisabled={false}
                  errorMessage=""
                  formatInput={(value) =>
                    value.slice(0, MAX_PLAYLIST_NAME_LENGTH)
                  }
                  handleChange={setDraftName}
                  handleSubmit={(value) => {
                    if (playlistId && value.trim()) {
                      renamePlaylist(playlistId, value.trim());
                    }
                    setDraftName(undefined);
                  }}
                  handleEscape={() => setDraftName(undefined)}
                />
                <button
                  type="button"
                  className="button small"
                  disabled={draftName.trim().length === 0}
                  onClick={() => {
                    if (playlistId && draftName.trim()) {
                      renamePlaylist(playlistId, draftName.trim());
                    }
                    setDraftName(undefined);
                  }}
                >
                  {t('library.playlist.rename')}
                </button>
              </div>
            ) : (
              <h2 className="library-detail__title">{title}</h2>
            )}
            {subtitle && <p className="library-detail__subtitle">{subtitle}</p>}
            <p className="library-detail__counts">
              {/* How many of how many, when the search named tracks inside
                  rather than this record: the honest answer to "why is this
                  compilation on screen at all". */}
              {matchedIds.size > 0 && (
                <>
                  <b className="library-detail__matched">{matchedIds.size}</b>
                  <span aria-hidden="true"> / </span>
                </>
              )}
              {counts}
            </p>
            <div className="library-detail__actions">
              {/* Emphasis follows recommendation: this is the one filled
                button on the screen, Back above is the quiet one. Withheld
                for an empty playlist — a Play that starts nothing is the
                click-that-does-nothing this project treats as a bug. */}
              {detailTracks.length > 0 && (
                <button
                  type="button"
                  className="button small library-detail__play"
                  onClick={handlePlay}
                >
                  <MenuIcon name="play" className="library-detail__play-icon" />
                  <span>{t('library.play')}</span>
                </button>
              )}
              {/* The quiet one beside it, because it is the second answer to
                  the same question: play this now, or play it after what is
                  already going. With nothing playing the two do the same
                  thing, and `appendToQueue` says so by starting the list.
                  Withheld when there is nothing to queue, for the reason Play
                  above is. */}
              {onQueueTracks && detailTracks.length > 0 && (
                <button
                  type="button"
                  className="button small subtle library-detail__queue"
                  onClick={() =>
                    onQueueTracks(listTracks.map((track) => track.id))
                  }
                >
                  {t('library.queueAdd')}
                </button>
              )}
              {/* THE WHOLE RECORD, filed in one press.
                  Favouriting an album a song at a time is twelve trips
                  through a row menu, and there was no other way to do it. The
                  same menu a row opens, handed every track on the page —
                  which is why it is the same component: the count is the only
                  difference between filing one song and filing a folder. */}
              {detailTracks.length > 0 && (
                <>
                  <button
                    type="button"
                    ref={containerMenuRef}
                    className="button small subtle library-detail__more"
                    aria-label={t('library.trackMenu')}
                    title={t('library.trackMenu')}
                    aria-haspopup="menu"
                    aria-expanded={isContainerMenuOpen}
                    onClick={() => setIsContainerMenuOpen((open) => !open)}
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <circle cx="3" cy="8" r="1.4" />
                      <circle cx="8" cy="8" r="1.4" />
                      <circle cx="13" cy="8" r="1.4" />
                    </svg>
                  </button>
                  <LibraryTrackMenu
                    anchor={containerMenuRef.current}
                    isOpen={isContainerMenuOpen}
                    tracks={listTracks}
                    openPlaylistId={playlistId}
                    onQueueTracks={onQueueTracks}
                    // Never reached: `LibraryTrackMenu` withholds Show in
                    // Explorer for anything but a single track, and a record
                    // of one is the only way this could fire.
                    onReveal={(trackId) => {
                      window.electron.ipcRenderer
                        .revealLibraryTrack(trackId)
                        .catch(() => undefined);
                      setIsContainerMenuOpen(false);
                    }}
                    onClose={() => setIsContainerMenuOpen(false)}
                  />
                </>
              )}
              {/* Absent for Favourites rather than disabled: it is not a
                thing you may not do to it today, it is a thing that is never
                true of it. The tooltip on the shelf's own star says so. */}
              {isPlaylist && !isBuiltInPlaylist && draftName === undefined && (
                <>
                  <button
                    type="button"
                    className="button small subtle"
                    onClick={() => {
                      setIsConfirmingDelete(false);
                      setDraftName(playlist?.name ?? '');
                    }}
                  >
                    {t('library.playlist.rename')}
                  </button>
                  {isConfirmingDelete ? (
                    <span
                      className="library-detail__confirm"
                      role="alertdialog"
                      aria-label={t('library.playlist.delete')}
                    >
                      <span>
                        {t('library.playlist.deleteConfirm', {
                          name: playlist?.name ?? '',
                        })}
                      </span>
                      {/* The decline wears the quiet style and the action the
                          reader already asked for wears the loud one. */}
                      <button
                        type="button"
                        className="button small"
                        onClick={() => {
                          if (playlistId) {
                            deletePlaylist(playlistId);
                          }
                          setIsConfirmingDelete(false);
                          onBack();
                        }}
                      >
                        {t('library.playlist.delete')}
                      </button>
                      <button
                        type="button"
                        className="button small subtle"
                        onClick={() => setIsConfirmingDelete(false)}
                      >
                        {t('library.playlist.keep')}
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="button small subtle"
                      onClick={() => setIsConfirmingDelete(true)}
                    >
                      {t('library.playlist.delete')}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          {/* Over the table it narrows, and standing on the same line the
              sleeve ends on — the header is as tall as the cover, so an auto
              cross-axis margin is what puts the box's foot exactly there.
              It filters this album, folder or artist and nothing else; the
              toolbar's own box, which searches the whole library, is
              withheld while a drill-in is open, so there is one search on
              screen and it does what the screen it is on suggests. */}
          <div className="library-detail__search">
            <LibrarySearchField
              value={filter}
              onChange={setFilter}
              label={t('library.filterHere')}
              history={libraryFilterHistory}
            />
          </div>
        </div>
      )}
      {/* What is inside this folder, above what is loose in it.
          Drawn by the same two views the panel already uses, so a choice of
          list or grid holds all the way down the tree instead of turning into
          a table the moment somebody walks into something. Only the
          Directories reading has children to draw: the flat one lists every
          folder up front and has nothing below. */}
      {childFolders.length > 0 && onOpenFolder && (
        <div
          className={`library-detail__children${
            isWayThrough ? ' is-only' : ''
          }`}
        >
          {/* Sorted by the same control as everything else on this page.
              These three were the one table in the library whose header did
              nothing: the folder branch has always been able to sort itself —
              `sortFolders` answers for folders what `sortTracks` answers for
              tracks — but a header only becomes a button when a handler is
              handed to it, and this call site never handed one over. */}
          {viewMode === 'grid' ? (
            <LibraryGridView
              tracks={treeTracks}
              browseMode="folder"
              folderRoots={folderRoots}
              folderParent={folderPath}
              onOpenAlbum={() => undefined}
              onOpenArtist={() => undefined}
              onOpenFolder={onOpenFolder}
              onPlayTrack={onPlayTrack}
              offlineRootIds={offlineRootIds}
              sort={sort}
              sortDirection={sortDirection}
              resetKey={`children|${folderPath ?? ''}|${sort ?? ''}|${sortDirection}`}
            />
          ) : (
            <LibraryListView
              tracks={treeTracks}
              browseMode="folder"
              folderRoots={folderRoots}
              folderParent={folderPath}
              onOpenAlbum={() => undefined}
              onOpenArtist={() => undefined}
              onOpenFolder={onOpenFolder}
              onPlayTrack={onPlayTrack}
              offlineRootIds={offlineRootIds}
              sort={sort}
              sortDirection={sortDirection}
              onSort={handleSort}
              resetKey={`children|${folderPath ?? ''}|${sort ?? ''}|${sortDirection}`}
            />
          )}
        </div>
      )}
      {/* A playlist nobody has put anything in yet, and how to. A table of
          five empty column headers says "this is broken"; this says "this is
          new", and names the action that fills it. */}
      {isPlaylist && detailTracks.length === 0 && missingCount === 0 && (
        <div className="library-detail__empty" role="status">
          <p>{t('library.playlist.empty')}</p>
          <p className="library-detail__empty-hint">
            {t('library.playlist.emptyHint')}
          </p>
        </div>
      )}
      {/* And no table where there is nothing in this folder to put in one.
          A folder that has files as well as folders shows both. */}
      {!isWayThrough &&
        !(isPlaylist && detailTracks.length === 0) &&
        (viewMode === 'grid' ? (
          <LibraryGridView
            tracks={listTracks}
            browseMode="song"
            onOpenAlbum={() => undefined}
            onOpenArtist={() => undefined}
            onPlayTrack={onPlayTrack}
            offlineRootIds={offlineRootIds}
            resetKey={`detail|${albumId ?? artistId ?? ''}`}
          />
        ) : (
          <LibraryListView
            tracks={listTracks}
            browseMode="song"
            onOpenAlbum={() => undefined}
            onOpenArtist={() => undefined}
            onPlayTrack={onPlayTrack}
            offlineRootIds={offlineRootIds}
            folderOnlyIds={folderOnlyIds}
            matchedIds={matchedIds}
            playingTrackId={playingTrackId}
            revealTrack={revealTrack}
            // Puts "Remove from this playlist" in each row's menu, and only
            // here — the same table drawn for an album has no such thing to
            // remove a song from.
            openPlaylistId={playlistId}
            // The header queues the whole album, folder or playlist; this is
            // the same action for one song of it.
            onQueueTracks={onQueueTracks}
            sort={sort}
            sortDirection={sortDirection}
            onSort={handleSort}
            resetKey={`detail|${albumId ?? artistId ?? playlistId ?? ''}|${sort ?? ''}|${sortDirection}`}
          />
        ))}
    </div>
  );
};

export default LibraryDetail;
