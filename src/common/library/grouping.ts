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

import { ILibraryTrack, TLibrarySort } from './types';

export interface ILibraryAlbum {
  id: string;
  title: string;
  artist: string;
  year?: number;
  artId?: string;
  /** In disc, then track, then title order. */
  trackIds: string[];
  durationMs: number;
}

export interface ILibraryArtist {
  id: string;
  name: string;
  albumCount: number;
  trackCount: number;
  artId?: string;
}

/** Accent-folded and lowercased, for comparison only — never for display. */
export const normalizeForSearch = (value: string): string =>
  value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

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
    };
  });
};

export const groupIntoArtists = (
  tracks: readonly ILibraryTrack[],
): ILibraryArtist[] => {
  const grouped = new Map<
    string,
    { name: string; albums: Set<string>; tracks: number; artId?: string }
  >();
  tracks.forEach((track) => {
    const name = track.albumArtist ?? track.artist ?? '';
    const id = normalizeForSearch(name);
    const existing = grouped.get(id);
    if (existing) {
      existing.albums.add(normalizeForSearch(album(track)));
      existing.tracks += 1;
      existing.artId = existing.artId ?? track.artId;
    } else {
      grouped.set(id, {
        name,
        albums: new Set([normalizeForSearch(album(track))]),
        tracks: 1,
        artId: track.artId,
      });
    }
  });
  return Array.from(grouped.entries()).map(([id, entry]) => ({
    id,
    name: entry.name,
    albumCount: entry.albums.size,
    trackCount: entry.tracks,
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

export const sortTracks = (
  tracks: readonly ILibraryTrack[],
  sort: TLibrarySort,
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
  return [...tracks].sort(compare);
};
