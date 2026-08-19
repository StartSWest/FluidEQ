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
      existing.isPending = existing.isPending && track.isPending === true;
    } else {
      grouped.set(id, {
        name,
        albums: new Set([normalizeForSearch(album(track))]),
        tracks: 1,
        artId: track.artId,
        isPending: track.isPending === true,
      });
    }
  });
  return Array.from(grouped.entries()).map(([id, entry]) => ({
    id,
    name: entry.name,
    albumCount: entry.albums.size,
    trackCount: entry.tracks,
    isPending: entry.isPending,
    artId: entry.artId,
  }));
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
