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

export const searchTracks = (
  tracks: readonly ILibraryTrack[],
  query: string,
): ILibraryTrack[] => {
  const needle = normalizeForSearch(query);
  if (!needle) {
    return [...tracks];
  }
  return tracks.filter((track) =>
    normalizeForSearch(
      [track.title, track.artist, track.albumArtist, track.album]
        .filter((part): part is string => Boolean(part))
        .join(' '),
    ).includes(needle),
  );
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
