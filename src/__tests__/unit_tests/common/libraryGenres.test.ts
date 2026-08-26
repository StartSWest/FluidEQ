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

import { ILibraryTrack } from '../../../common/library/types';
import {
  UNKNOWN_GENRE_ID,
  genreKey,
  genreNames,
  groupIntoGenres,
  sortGenres,
  trackGenreIds,
} from '../../../common/library/genres';

const track = (over: Partial<ILibraryTrack>): ILibraryTrack => ({
  id: over.title ?? 'id',
  rootId: 'root',
  path: `C:\\Music\\${over.title ?? 'id'}.mp3`,
  kind: 'audio',
  isPlayable: true,
  title: 'Untitled',
  sizeBytes: 1,
  mtimeMs: 1,
  addedAt: 1,
  ...over,
});

describe('reading the genre off a tag', () => {
  it('splits a semicolon-separated tag into several genres', () => {
    expect(genreNames(track({ genre: 'Rock; Pop' }))).toEqual(['Rock', 'Pop']);
  });

  it('splits on the raw NUL separator ID3 frames arrive with', () => {
    // Built from the code point rather than written out: a literal NUL in a
    // source file is invisible in an editor and in a diff, and writing one
    // into `genres.ts` turned that file into a binary revision once already.
    const raw = `Rock${String.fromCharCode(0)}Jazz`;
    expect(genreNames(track({ genre: raw }))).toEqual(['Rock', 'Jazz']);
  });

  it('leaves a comma alone, because one genre contains commas', () => {
    // "Folk, World, & Country" is a single Discogs genre. Splitting on the
    // comma invents three shelves nobody has any music in.
    expect(genreNames(track({ genre: 'Folk, World, & Country' }))).toEqual([
      'Folk, World, & Country',
    ]);
  });

  it('leaves a slash alone, because iTunes writes one genre with one', () => {
    expect(genreNames(track({ genre: 'Hip-Hop/Rap' }))).toEqual([
      'Hip-Hop/Rap',
    ]);
  });

  it('folds case, spacing and punctuation to one key', () => {
    // The three spellings a real library holds of the same shelf.
    expect(genreKey('Hip Hop')).toBe(genreKey('hip-hop'));
    expect(genreKey('Hip Hop')).toBe(genreKey('Hip  Hop'));
  });

  it('does not fold two different genres onto one key', () => {
    // The positive control for the test above: a normaliser that returned a
    // constant would pass every equality assertion up there and be useless.
    expect(genreKey('Rock')).not.toBe(genreKey('Jazz'));
  });

  it('puts an untagged file in the unknown bucket, not in none', () => {
    expect(trackGenreIds(track({}))).toEqual([UNKNOWN_GENRE_ID]);
    expect(trackGenreIds(track({ genre: '   ' }))).toEqual([UNKNOWN_GENRE_ID]);
  });

  it('puts a name made only of punctuation in the unknown bucket', () => {
    // It normalises to nothing, and a shelf with no name on it is
    // indistinguishable from no shelf.
    expect(genreKey('!!!')).toBe(UNKNOWN_GENRE_ID);
  });

  it('leaves the unknown id unreachable by any tag', () => {
    // The whole reason the id carries a question mark: `normalizeForGrouping`
    // keeps only letters, digits and spaces, so nothing a tagger can write
    // collides with it. Somebody who literally tags a file "?unknown" gets
    // the shelf called "unknown", which is a real name, not this bucket.
    expect(genreKey('?unknown')).not.toBe(UNKNOWN_GENRE_ID);
  });
});

describe('the genre shelf', () => {
  it('puts a cross-tagged track on every shelf it names', () => {
    // The failure this prevents: keying on the first value alone hides the
    // whole Pop shelf of a library that tags everything twice.
    const genres = groupIntoGenres([
      track({ title: 'A', genre: 'Rock; Pop', artist: 'One' }),
      track({ title: 'B', genre: 'Rock', artist: 'Two' }),
    ]);
    const byId = new Map(genres.map((genre) => [genre.id, genre]));
    expect(byId.get(genreKey('Rock'))?.trackCount).toBe(2);
    expect(byId.get(genreKey('Pop'))?.trackCount).toBe(1);
  });

  it('counts artists rather than tracks, so one prolific band is one', () => {
    const [rock] = groupIntoGenres([
      track({ title: 'A', genre: 'Rock', artist: 'One' }),
      track({ title: 'B', genre: 'Rock', artist: 'One' }),
      track({ title: 'C', genre: 'Rock', artist: 'Two' }),
    ]);
    expect(rock.trackCount).toBe(3);
    expect(rock.artistCount).toBe(2);
  });

  it('groups the album artist, not the track artist, on a compilation', () => {
    // Same rule the album shelf uses: keying on `artist` shatters a
    // compilation into one artist per track and reports the genre as far
    // more varied than it is.
    const [genre] = groupIntoGenres([
      track({ title: 'A', genre: 'Rock', artist: 'One', albumArtist: 'V/A' }),
      track({ title: 'B', genre: 'Rock', artist: 'Two', albumArtist: 'V/A' }),
    ]);
    expect(genre.artistCount).toBe(1);
  });

  it('leaves the unknown bucket unnamed, for the view to name in a locale', () => {
    const [unknown] = groupIntoGenres([track({ title: 'A' })]);
    expect(unknown.id).toBe(UNKNOWN_GENRE_ID);
    expect(unknown.name).toBe('');
  });

  it('stays provisional only while every track in it is still unread', () => {
    const [genre] = groupIntoGenres([
      track({ title: 'A', genre: 'Rock', isPending: true }),
      track({ title: 'B', genre: 'Rock' }),
    ]);
    expect(genre.isPending).toBe(false);
  });

  it('sorts by name, and by size when asked for a year it has not got', () => {
    const genres = groupIntoGenres([
      track({ title: 'A', genre: 'Rock', artist: 'One' }),
      track({ title: 'B', genre: 'Rock', artist: 'Two' }),
      track({ title: 'C', genre: 'Ambient', artist: 'Three' }),
    ]);
    expect(sortGenres(genres, 'title').map((entry) => entry.name)).toEqual([
      'Ambient',
      'Rock',
    ]);
    // A genre has no year; the honest fallback is how much of the library it
    // is, largest first — the same answer the artist shelf gives.
    expect(sortGenres(genres, 'year').map((entry) => entry.name)).toEqual([
      'Rock',
      'Ambient',
    ]);
  });
});
