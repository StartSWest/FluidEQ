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

import { normalizeForGrouping } from './grouping';
import { ILibraryTrack, TLibrarySort, TLibrarySortDirection } from './types';

/**
 * The bucket for everything with no genre tag at all.
 *
 * A real id is `normalizeForGrouping` output, which keeps only letters,
 * digits and spaces — so the question mark is what makes this one
 * unreachable by any tag anybody can write. It is deliberately an ordinary
 * visible character rather than a NUL: writing this file once with a real
 * NUL in the literal turned it into a binary revision that no diff would
 * show, which is the same trap `grouping.ts` documents above its combining
 * -marks pattern.
 *
 * The name is empty rather than "Unknown": this module has no i18n and the
 * shelf that draws it does, the same division `FAVORITES_PLAYLIST_ID`
 * already uses.
 */
export const UNKNOWN_GENRE_ID = '?unknown';

export interface ILibraryGenre {
  id: string;
  /** The first spelling seen among its tracks — tags disagree about case and
   * punctuation, and `id` is what decides sameness. Empty for the unknown
   * bucket, which the view names. */
  name: string;
  trackCount: number;
  /** How many distinct artists it covers. An artist tile answers "how many
   * records"; the useful size of a genre is how much of the library it is,
   * and one band with sixty tracks is a smaller genre than twenty bands. */
  artistCount: number;
  artId?: string;
  /** The newest `addedAt` among its tracks, for the same reason an album
   * carries one. */
  addedAt: number;
  /** Same rule as `ILibraryAlbum.isPending`: true only while every track in
   * the bucket is still unread. Genre is a tag, so a shelf built mid-scan is
   * mostly Unknown until the parse phase catches up — the badge is what says
   * so rather than the shelf silently lying. */
  isPending: boolean;
}

/**
 * ONE TAG CAN NAME SEVERAL GENRES, AND ONLY TWO SEPARATORS ARE SAFE.
 *
 * `;` is what ID3v2.4 and every tagger that follows it writes between
 * values, and NUL is the raw ID3 multi-value separator that reaches us
 * whenever a frame arrives unsplit.
 *
 * A comma is NOT one: "Folk, World, & Country" is a single Discogs genre and
 * splitting it invents three shelves nobody has music in. Neither is a
 * slash: iTunes writes "Hip-Hop/Rap" as one genre, and cutting it there puts
 * the same records on two half-empty shelves under names iTunes never used.
 *
 * Built through `String.fromCharCode` rather than written out, for the
 * reason `UNKNOWN_GENRE_ID` above is not a NUL either.
 */
const NUL = String.fromCharCode(0);
const GENRE_SEPARATORS = new RegExp(`[;${NUL}]`);

/** The genres a file claims, as written. Empty when it claims none. */
export const genreNames = (track: ILibraryTrack): string[] =>
  (track.genre ?? '')
    .split(GENRE_SEPARATORS)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

/**
 * A HYPHEN IS A SPACE IN A GENRE, WHICH IS NOT TRUE ANYWHERE ELSE HERE.
 *
 * `normalizeForGrouping` DELETES punctuation rather than replacing it, and
 * that is right for the names it was written for: `N'Sync` and `NSYNC` are
 * one band, and folding the apostrophe to a space would make them two.
 *
 * Genres are written the other way round. "Hip-Hop" and "Hip Hop" are the
 * same shelf and every real library holds both spellings, so deleting the
 * hyphen gives `hiphop` against `hip hop` — two shelves, each holding half
 * the records, which is the exact failure this whole normalisation exists to
 * prevent. Same for `Trip-Hop`, `Post-Rock`, `Drum_and_Bass`.
 *
 * The slash comes too, so `Hip-Hop/Rap` keys as `hip hop rap`. It stays its
 * own shelf either way — `genreNames` deliberately does not split on a slash
 * — this only stops the key being the unreadable `hip hoprap`.
 */
const GENRE_WORD_BREAKS = /[-_/]+/g;

/**
 * What counts as the same genre, so "Hip Hop", "hip-hop" and "Hip  Hop" are
 * one shelf rather than three.
 *
 * A name made entirely of punctuation normalizes to nothing and lands in the
 * unknown bucket. That is the right answer: a shelf with no name on it is
 * indistinguishable from no shelf.
 */
export const genreKey = (name: string): string =>
  normalizeForGrouping(name.replace(GENRE_WORD_BREAKS, ' ')) ||
  UNKNOWN_GENRE_ID;

/** Every genre bucket a track belongs to. Never empty — an untagged file
 * belongs to exactly one, and it is the unknown one. */
export const trackGenreIds = (track: ILibraryTrack): string[] => {
  const names = genreNames(track);
  if (names.length === 0) {
    return [UNKNOWN_GENRE_ID];
  }
  return Array.from(new Set(names.map(genreKey)));
};

/**
 * The shelf. A track tagged "Rock; Pop" is on BOTH, which is the whole
 * reason this does not reuse `groupIntoArtists`' shape of one key per track:
 * a genre is the one grouping in this library where membership is genuinely
 * many-to-many, and keeping only the first value would hide half of a
 * cross-tagged collection.
 */
export const groupIntoGenres = (
  tracks: readonly ILibraryTrack[],
): ILibraryGenre[] => {
  const grouped = new Map<
    string,
    {
      name: string;
      artists: Set<string>;
      tracks: number;
      artId?: string;
      addedAt: number;
      isPending: boolean;
    }
  >();
  tracks.forEach((track) => {
    const names = genreNames(track);
    const entries: { id: string; name: string }[] =
      names.length === 0
        ? [{ id: UNKNOWN_GENRE_ID, name: '' }]
        : names.map((name) => ({ id: genreKey(name), name }));
    const artist = normalizeForGrouping(
      track.albumArtist ?? track.artist ?? '',
    );
    entries.forEach(({ id, name }) => {
      const existing = grouped.get(id);
      if (existing) {
        existing.artists.add(artist);
        existing.tracks += 1;
        existing.artId = existing.artId ?? track.artId;
        existing.addedAt = Math.max(existing.addedAt, track.addedAt);
        existing.isPending = existing.isPending && track.isPending === true;
        return;
      }
      grouped.set(id, {
        name,
        artists: new Set([artist]),
        tracks: 1,
        artId: track.artId,
        addedAt: track.addedAt,
        isPending: track.isPending === true,
      });
    });
  });
  return Array.from(grouped.entries()).map(([id, entry]) => ({
    id,
    name: entry.name,
    artistCount: entry.artists.size,
    trackCount: entry.tracks,
    artId: entry.artId,
    addedAt: entry.addedAt,
    isPending: entry.isPending,
  }));
};

/** Mirrors `sortArtists`: a genre has a name and a size and nothing else, so
 * anything that is not one of those falls to the name. */
export const sortGenres = (
  genres: readonly ILibraryGenre[],
  sort: TLibrarySort,
  direction: TLibrarySortDirection = 'asc',
): ILibraryGenre[] => {
  const compare = (left: ILibraryGenre, right: ILibraryGenre): number => {
    if (sort === 'added') {
      return right.addedAt - left.addedAt;
    }
    if (sort === 'year') {
      // No year exists here; how much of the library it is at least answers
      // something, the way the artist shelf answers with its track count.
      return right.trackCount - left.trackCount;
    }
    return left.name.localeCompare(right.name);
  };
  const sorted = [...genres].sort(compare);
  return direction === 'desc' ? sorted.reverse() : sorted;
};
