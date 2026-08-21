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

import { ILibraryTrack, TLibrarySort, TLibrarySortDirection } from './types';

export interface ILibraryAlbum {
  id: string;
  title: string;
  artist: string;
  year?: number;
  artId?: string;
  /** In disc, then track, then title order. */
  trackIds: string[];
  durationMs: number;
  /** The newest `addedAt` among its tracks — an album counts as recently
   * added when the latest thing in it is, not the earliest. */
  addedAt: number;
  /** True only while every track in this grouping is still `isPending` — the
   * whole album is a folder-name guess with not one tagged track in it yet.
   * The moment a single member resolves, the group stops being provisional
   * even though other members may not have caught up; it already has a real
   * fact in it, which a folder guess alone never did. */
  isPending: boolean;
}

export interface ILibraryArtist {
  id: string;
  name: string;
  albumCount: number;
  trackCount: number;
  artId?: string;
  /** The newest `addedAt` among their tracks, for the same reason an album
   * carries one. */
  addedAt: number;
  /** Same rule as `ILibraryAlbum.isPending`: true only while every track
   * grouped under this artist is still unread. */
  isPending: boolean;
}

// Combining Diacritical Marks block: every accent `NFKD` can split a base
// letter from. Built from the numeric code points through `RegExp` and
// `String.fromCharCode` rather than a character-class escape or, worse, the
// literal Unicode characters themselves in source: a raw combining mark
// pasted into a source file is invisible in most editors and in a diff, and
// this exact file has already once been silently turned into a binary
// revision on this branch by exactly that hazard.
const COMBINING_MARKS_FIRST = 0x0300; // COMBINING GRAVE ACCENT
const COMBINING_MARKS_LAST = 0x036f; // COMBINING LATIN SMALL LETTER X
const COMBINING_MARKS_PATTERN = new RegExp(
  `[${String.fromCharCode(COMBINING_MARKS_FIRST)}-${String.fromCharCode(COMBINING_MARKS_LAST)}]`,
  'g',
);

/** Accent-folded and lowercased, for comparison only — never for display. */
export const normalizeForSearch = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(COMBINING_MARKS_PATTERN, '')
    .toLowerCase()
    .trim();

/**
 * The album an artist made, not the album with that name.
 *
 * `albumArtist` wins where it exists, which is what holds a compilation
 * together: every track on it has a different `artist`, and keying on that
 * shatters one album into fifteen.
 */
export const albumKey = (track: ILibraryTrack): string => {
  const artist = track.albumArtist ?? track.artist ?? '';
  return `${normalizeForSearch(album(track))}\u0000${normalizeForSearch(artist)}`;
};

const album = (track: ILibraryTrack): string => track.album ?? '';

/**
 * Which artist a track belongs to, for grouping and for filtering alike —
 * the single rule `groupIntoArtists` below, `LibraryWorkspace`'s artist
 * queue and `LibraryDetail`'s artist drill-in all have to agree on. Three
 * separate copies of this once meant a change to the rule here left the
 * artist page listing the right songs while the queue it built played the
 * wrong ones.
 */
export const artistKey = (track: ILibraryTrack): string =>
  normalizeForSearch(track.albumArtist ?? track.artist ?? '');

const compareTracksInAlbum = (
  left: ILibraryTrack,
  right: ILibraryTrack,
): number =>
  (left.discNo ?? 1) - (right.discNo ?? 1) ||
  (left.trackNo ?? 0) - (right.trackNo ?? 0) ||
  left.title.localeCompare(right.title);

export const groupIntoAlbums = (
  tracks: readonly ILibraryTrack[],
): ILibraryAlbum[] => {
  const grouped = new Map<string, ILibraryTrack[]>();
  tracks.forEach((track) => {
    const key = albumKey(track);
    const existing = grouped.get(key);
    if (existing) {
      existing.push(track);
    } else {
      grouped.set(key, [track]);
    }
  });
  return Array.from(grouped.entries()).map(([id, members]) => {
    const ordered = [...members].sort(compareTracksInAlbum);
    const first = ordered[0];
    return {
      id,
      title: first.album ?? '',
      artist: first.albumArtist ?? first.artist ?? '',
      year: ordered.find((entry) => entry.year !== undefined)?.year,
      artId: ordered.find((entry) => entry.artId !== undefined)?.artId,
      trackIds: ordered.map((entry) => entry.id),
      durationMs: ordered.reduce(
        (total, entry) => total + (entry.durationMs ?? 0),
        0,
      ),
      addedAt: ordered.reduce(
        (newest, entry) => Math.max(newest, entry.addedAt),
        0,
      ),
      isPending: ordered.every((entry) => entry.isPending === true),
    };
  });
};

export const groupIntoArtists = (
  tracks: readonly ILibraryTrack[],
): ILibraryArtist[] => {
  const grouped = new Map<
    string,
    {
      name: string;
      albums: Set<string>;
      tracks: number;
      artId?: string;
      addedAt: number;
      isPending: boolean;
    }
  >();
  tracks.forEach((track) => {
    const name = track.albumArtist ?? track.artist ?? '';
    const id = artistKey(track);
    const existing = grouped.get(id);
    if (existing) {
      existing.albums.add(normalizeForSearch(album(track)));
      existing.tracks += 1;
      existing.artId = existing.artId ?? track.artId;
      existing.addedAt = Math.max(existing.addedAt, track.addedAt);
      existing.isPending = existing.isPending && track.isPending === true;
    } else {
      grouped.set(id, {
        name,
        albums: new Set([normalizeForSearch(album(track))]),
        tracks: 1,
        artId: track.artId,
        addedAt: track.addedAt,
        isPending: track.isPending === true,
      });
    }
  });
  return Array.from(grouped.entries()).map(([id, entry]) => ({
    id,
    name: entry.name,
    albumCount: entry.albums.size,
    trackCount: entry.tracks,
    addedAt: entry.addedAt,
    isPending: entry.isPending,
    artId: entry.artId,
  }));
};

export interface ILibraryFolder {
  /** The directory itself, exactly as it appears in the tracks' paths — the
   * id and the thing to open, both. */
  id: string;
  /** Its last segment, which is what a reader recognises. */
  name: string;
  trackCount: number;
  artId?: string;
  addedAt: number;
  isPending: boolean;
}

/** The directory a file sits in, separator-agnostic. A path arrives as
 * Windows text but nothing guarantees every one was written with a
 * backslash — an index carried over from another machine, or a root added by
 * hand, can hold either. */
export const trackFolderPath = (filePath: string): string => {
  const normalised = filePath.replace(/\\/g, '/');
  const cut = normalised.lastIndexOf('/');
  return cut > 0 ? normalised.slice(0, cut) : normalised;
};

/** Its last segment — the folder's own name, without the tree above it. */
export const folderDisplayName = (folderPath: string): string => {
  const parts = folderPath.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : folderPath;
};

/**
 * The library as it actually sits on disk.
 *
 * The one view that owes nothing to a tag: a folder is a folder whether or
 * not a single file in it has been read yet, which makes this the honest way
 * to look at a library mid-scan — and the way to find the album whose tags
 * all say "Unknown".
 */
export const groupIntoFolders = (
  tracks: readonly ILibraryTrack[],
): ILibraryFolder[] => {
  const grouped = new Map<
    string,
    { count: number; artId?: string; addedAt: number; isPending: boolean }
  >();
  tracks.forEach((track) => {
    const id = trackFolderPath(track.path);
    const existing = grouped.get(id);
    if (existing) {
      existing.count += 1;
      existing.artId = existing.artId ?? track.artId;
      existing.addedAt = Math.max(existing.addedAt, track.addedAt);
      existing.isPending = existing.isPending && track.isPending === true;
    } else {
      grouped.set(id, {
        count: 1,
        artId: track.artId,
        addedAt: track.addedAt,
        isPending: track.isPending === true,
      });
    }
  });
  return Array.from(grouped.entries()).map(([id, entry]) => ({
    id,
    name: folderDisplayName(id),
    trackCount: entry.count,
    artId: entry.artId,
    addedAt: entry.addedAt,
    isPending: entry.isPending,
  }));
};

/** Everything at or below this directory, separator-agnostic. */
const isBeneath = (filePath: string, folderPath: string): boolean => {
  const dir = trackFolderPath(filePath);
  return dir === folderPath || dir.startsWith(`${folderPath}/`);
};

/** One folder entry, summed from whatever is beneath it. */
const summarise = (
  id: string,
  beneath: readonly ILibraryTrack[],
): ILibraryFolder => ({
  id,
  name: folderDisplayName(id),
  trackCount: beneath.length,
  artId: beneath.find((track) => track.artId !== undefined)?.artId,
  addedAt: beneath.reduce(
    (latest, track) => Math.max(latest, track.addedAt),
    0,
  ),
  isPending:
    beneath.length > 0 && beneath.every((track) => track.isPending === true),
});

/** A path as this module compares them: forward slashes, no trailing one. */
export const normaliseFolderPath = (path: string): string =>
  path.replace(/\\/g, '/').replace(/\/+$/, '');

/**
 * The top of the tree: the folders somebody actually added.
 *
 * The other way to look at this — every directory that holds a file, flat and
 * all at once — is still there and is still worth having: it is the fastest
 * way to find a folder whose name you know. But as the only way in it made a
 * library of forty albums forty rows deep with a full path under each, and no
 * way to see that thirty of them sat inside one place. This is what a file
 * manager gives instead: the roots, and you walk in.
 *
 * A root with nothing in it is still listed. It is a folder somebody chose,
 * and an empty one usually means a drive that is not plugged in — worth
 * seeing rather than quietly missing.
 *
 * The count is everything beneath rather than what is loose in the root
 * itself: "Music (614)" answers what is in there, where "Music (0)" for a
 * root whose files all live a level down is true and useless.
 */
export const rootFolders = (
  tracks: readonly ILibraryTrack[],
  roots: readonly { path: string }[],
): ILibraryFolder[] =>
  roots.map((root) => {
    const id = normaliseFolderPath(root.path);
    return summarise(
      id,
      tracks.filter((track) => isBeneath(track.path, id)),
    );
  });

/**
 * What sits directly inside one folder, one level down and no further.
 *
 * The subfolders only: the files in the folder itself are the list the
 * drill-in has always shown, and they are drawn under these.
 *
 * A folder several levels above its music still appears with everything
 * beneath it counted — walk into `Music` and `Artist (37)` is one row, not
 * thirty-seven spread over the albums below it.
 */
export const folderChildren = (
  tracks: readonly ILibraryTrack[],
  parentPath: string,
): ILibraryFolder[] => {
  const prefix = `${parentPath}/`;
  const grouped = new Map<string, ILibraryTrack[]>();
  tracks.forEach((track) => {
    const dir = trackFolderPath(track.path);
    if (!dir.startsWith(prefix)) {
      return;
    }
    const child = dir.slice(prefix.length).split('/')[0];
    if (!child) {
      return;
    }
    const id = `${prefix}${child}`;
    const existing = grouped.get(id);
    if (existing) {
      existing.push(track);
      return;
    }
    grouped.set(id, [track]);
  });
  return Array.from(grouped.entries()).map(([id, beneath]) =>
    summarise(id, beneath),
  );
};

/**
 * The folder one level up, or nothing when this is already a root.
 *
 * Nothing rather than the drive: the tree somebody is walking is the one they
 * added, and stepping out of it into `D:/` offers a folder the library knows
 * nothing about and cannot fill.
 */
export const parentFolderPath = (
  folderPath: string,
  roots: readonly { path: string }[],
): string | undefined => {
  const normalisedRoots = roots.map((root) => normaliseFolderPath(root.path));
  if (normalisedRoots.includes(folderPath)) {
    return undefined;
  }
  const cut = folderPath.lastIndexOf('/');
  if (cut <= 0) {
    return undefined;
  }
  const parent = folderPath.slice(0, cut);
  return normalisedRoots.some(
    (root) => parent === root || parent.startsWith(`${root}/`),
  )
    ? parent
    : undefined;
};

export const sortFolders = (
  folders: readonly ILibraryFolder[],
  sort: TLibrarySort,
  direction: TLibrarySortDirection = 'asc',
): ILibraryFolder[] => {
  const compare = (left: ILibraryFolder, right: ILibraryFolder): number => {
    if (sort === 'added') {
      return right.addedAt - left.addedAt;
    }
    if (sort === 'year') {
      // A folder has no year. How much is in it is the next most useful
      // order, and is at least a real answer — same choice `sortArtists`
      // makes for the same reason.
      return right.trackCount - left.trackCount;
    }
    return left.name.localeCompare(right.name);
  };
  const sorted = [...folders].sort(compare);
  return direction === 'desc' ? sorted.reverse() : sorted;
};

/**
 * How well one track answers a query — higher is better, zero is no match.
 *
 * Which field matched matters as much as whether one did. Somebody typing
 * "leo" wants the artist Leo Dan before a track called "Leones" on somebody
 * else's record, and a title that *starts* with what they typed before one
 * that merely contains it. Without this every search returned its hits in
 * whatever order the library happened to be in, which for a query that
 * matches four thousand files is no order at all.
 */
const MATCH_TITLE_EXACT = 100;
const MATCH_TITLE_PREFIX = 80;
const MATCH_ARTIST_PREFIX = 70;
const MATCH_ALBUM_PREFIX = 60;
const MATCH_TITLE_ANYWHERE = 40;
const MATCH_ARTIST_ANYWHERE = 30;
const MATCH_ALBUM_ANYWHERE = 20;

const scoreField = (
  value: string | undefined,
  needle: string,
  exact: number,
  prefix: number,
  anywhere: number,
): number => {
  if (!value) {
    return 0;
  }
  const folded = normalizeForSearch(value);
  if (folded === needle) {
    return exact;
  }
  if (folded.startsWith(needle)) {
    return prefix;
  }
  return folded.includes(needle) ? anywhere : 0;
};

export const searchScore = (track: ILibraryTrack, needle: string): number => {
  if (!needle) {
    return 1;
  }
  return Math.max(
    scoreField(
      track.title,
      needle,
      MATCH_TITLE_EXACT,
      MATCH_TITLE_PREFIX,
      MATCH_TITLE_ANYWHERE,
    ),
    scoreField(
      track.artist,
      needle,
      MATCH_ARTIST_PREFIX,
      MATCH_ARTIST_PREFIX,
      MATCH_ARTIST_ANYWHERE,
    ),
    scoreField(
      track.albumArtist,
      needle,
      MATCH_ARTIST_PREFIX,
      MATCH_ARTIST_PREFIX,
      MATCH_ARTIST_ANYWHERE,
    ),
    scoreField(
      track.album,
      needle,
      MATCH_ALBUM_PREFIX,
      MATCH_ALBUM_PREFIX,
      MATCH_ALBUM_ANYWHERE,
    ),
  );
};

/**
 * The matches, best first.
 *
 * Ranked rather than merely filtered — see `searchScore`. Ties keep the order
 * they arrived in, so a search inside an album still reads down the track
 * listing rather than being reshuffled by a scoring accident.
 */
export const searchTracks = (
  tracks: readonly ILibraryTrack[],
  query: string,
): ILibraryTrack[] => {
  const needle = normalizeForSearch(query);
  if (!needle) {
    return [...tracks];
  }
  return tracks
    .map((track, index) => ({
      track,
      index,
      score: searchScore(track, needle),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.track);
};

/**
 * Ascending unless asked otherwise.
 *
 * `'added'` reads newest-first when ascending, because "recently added" is the
 * only sort whose plain-language name already implies its direction — asking
 * for it and getting the oldest file first would be the surprising answer.
 * Reversing it therefore gives oldest-first, which is what a second click on
 * that column should do.
 */
export const sortTracks = (
  tracks: readonly ILibraryTrack[],
  sort: TLibrarySort,
  direction: TLibrarySortDirection = 'asc',
): ILibraryTrack[] => {
  const compare = (left: ILibraryTrack, right: ILibraryTrack): number => {
    if (sort === 'artist') {
      return (
        (left.artist ?? '').localeCompare(right.artist ?? '') ||
        left.title.localeCompare(right.title)
      );
    }
    if (sort === 'album') {
      return (
        (left.album ?? '').localeCompare(right.album ?? '') ||
        compareTracksInAlbum(left, right)
      );
    }
    if (sort === 'year') {
      return (left.year ?? 0) - (right.year ?? 0);
    }
    if (sort === 'added') {
      return right.addedAt - left.addedAt;
    }
    return left.title.localeCompare(right.title);
  };
  const sorted = [...tracks].sort(compare);
  return direction === 'desc' ? sorted.reverse() : sorted;
};

/**
 * The same sort, applied to what a grouping actually has.
 *
 * Sorting the tracks was never enough: `groupIntoAlbums` and
 * `groupIntoArtists` hand back their groups in the order the Map happened to
 * build them, so choosing "Year" while browsing Albums reordered nothing a
 * reader could see. These put the choice back where it was made.
 *
 * A grouping has no title/artist/album/year/added the way a track does, so the
 * mapping is deliberate rather than mechanical: an album sorts by its own
 * title, by its artist, by its year, or by how recently anything in it was
 * added; an artist has only a name and a size, so anything that is not a count
 * falls to the name. Asking for something a group does not have should give
 * its most obvious order, not an arbitrary one.
 */
export const sortAlbums = (
  albums: readonly ILibraryAlbum[],
  sort: TLibrarySort,
  direction: TLibrarySortDirection = 'asc',
): ILibraryAlbum[] => {
  const compare = (left: ILibraryAlbum, right: ILibraryAlbum): number => {
    if (sort === 'artist') {
      return (
        left.artist.localeCompare(right.artist) ||
        left.title.localeCompare(right.title)
      );
    }
    if (sort === 'year') {
      return (left.year ?? 0) - (right.year ?? 0);
    }
    if (sort === 'added') {
      return right.addedAt - left.addedAt;
    }
    // 'title' and 'album' are the same question for an album.
    return left.title.localeCompare(right.title);
  };
  const sorted = [...albums].sort(compare);
  return direction === 'desc' ? sorted.reverse() : sorted;
};

export const sortArtists = (
  artists: readonly ILibraryArtist[],
  sort: TLibrarySort,
  direction: TLibrarySortDirection = 'asc',
): ILibraryArtist[] => {
  const compare = (left: ILibraryArtist, right: ILibraryArtist): number => {
    if (sort === 'added') {
      return right.addedAt - left.addedAt;
    }
    if (sort === 'year') {
      // Nothing else an artist carries is a year; how much of them there is
      // is the next most useful order, and is at least a real answer.
      return right.trackCount - left.trackCount;
    }
    return left.name.localeCompare(right.name);
  };
  const sorted = [...artists].sort(compare);
  return direction === 'desc' ? sorted.reverse() : sorted;
};
