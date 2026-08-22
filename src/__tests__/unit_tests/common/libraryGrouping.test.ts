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
  artistKey,
  groupIntoAlbums,
  groupIntoArtists,
  normalizeForSearch,
  searchTracks,
  sortAlbums,
  sortArtists,
  sortTracks,
} from '../../../common/library/grouping';

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

describe('grouping a flat track list', () => {
  it('collects an album and keeps its tracks in disc and track order', () => {
    const albums = groupIntoAlbums([
      track({ title: 'B', album: 'Kind of Blue', artist: 'Miles', trackNo: 2 }),
      track({ title: 'A', album: 'Kind of Blue', artist: 'Miles', trackNo: 1 }),
    ]);
    expect(albums).toHaveLength(1);
    expect(albums[0].title).toBe('Kind of Blue');
    expect(albums[0].trackIds).toEqual(['A', 'B']);
  });

  it('keeps two albums of the same name by different artists apart', () => {
    // "Greatest Hits" is the case that breaks a title-only key, and there is
    // one in almost every real library.
    const albums = groupIntoAlbums([
      track({ title: 'X', album: 'Greatest Hits', artist: 'Queen' }),
      track({ title: 'Y', album: 'Greatest Hits', artist: 'ABBA' }),
    ]);
    expect(albums).toHaveLength(2);
  });

  it('holds a compilation together under its album artist', () => {
    // Every track has a different artist; without albumArtist winning, this
    // shatters into one album per song.
    const albums = groupIntoAlbums([
      track({
        title: 'X',
        album: 'Now 42',
        artist: 'A',
        albumArtist: 'Various',
      }),
      track({
        title: 'Y',
        album: 'Now 42',
        artist: 'B',
        albumArtist: 'Various',
      }),
    ]);
    expect(albums).toHaveLength(1);
    expect(albums[0].artist).toBe('Various');
  });

  it('files untagged tracks under one unknown album rather than many', () => {
    const albums = groupIntoAlbums([
      track({ title: 'X' }),
      track({ title: 'Y' }),
    ]);
    expect(albums).toHaveLength(1);
    expect(albums[0].trackIds).toEqual(['X', 'Y']);
  });

  it('counts an artist by albums and tracks', () => {
    const artists = groupIntoArtists([
      track({ title: 'X', album: 'One', artist: 'Miles' }),
      track({ title: 'Y', album: 'One', artist: 'Miles' }),
      track({ title: 'Z', album: 'Two', artist: 'Miles' }),
    ]);
    expect(artists).toHaveLength(1);
    expect(artists[0]).toMatchObject({
      name: 'Miles',
      albumCount: 2,
      trackCount: 3,
    });
  });
});

describe('searching', () => {
  it('ignores case and accents', () => {
    const tracks = [track({ title: 'Café del Mar', artist: 'Energy 52' })];
    expect(searchTracks(tracks, 'cafe')).toHaveLength(1);
    expect(searchTracks(tracks, 'CAFÉ')).toHaveLength(1);
  });

  it('matches on artist and album as well as title', () => {
    const tracks = [
      track({ title: 'X', artist: 'Miles', album: 'Kind of Blue' }),
    ];
    expect(searchTracks(tracks, 'miles')).toHaveLength(1);
    expect(searchTracks(tracks, 'blue')).toHaveLength(1);
  });

  it('returns everything for an empty query', () => {
    // The positive control for the two above: a filter that matched nothing
    // would pass a "finds no rubbish" test and empty the library.
    const tracks = [track({ title: 'X' }), track({ title: 'Y' })];
    expect(searchTracks(tracks, '')).toHaveLength(2);
    expect(searchTracks(tracks, '   ')).toHaveLength(2);
    expect(searchTracks(tracks, 'zzzz')).toHaveLength(0);
  });

  it('normalises for comparison without destroying the display string', () => {
    expect(normalizeForSearch('Björk')).toBe('bjork');
  });
});

describe('artistKey (follow-up 10)', () => {
  // The one rule `groupIntoArtists`, `LibraryWorkspace`'s artist queue and
  // `LibraryDetail`'s artist drill-in all now share instead of each keeping
  // its own copy — a changed rule here used to leave the artist page
  // listing the right songs while the queue it built played the wrong ones.
  it('prefers the album artist over the track artist, matching groupIntoArtists', () => {
    const compilationTrack = track({
      title: 'Track',
      artist: 'Guest Vocalist',
      albumArtist: 'Various Artists',
    });
    expect(artistKey(compilationTrack)).toBe(
      normalizeForSearch('Various Artists'),
    );
    const [artist] = groupIntoArtists([compilationTrack]);
    expect(artist.id).toBe(artistKey(compilationTrack));
  });

  it('folds case and accents the same way normalizeForSearch does', () => {
    expect(artistKey(track({ title: 'X', artist: 'Björk' }))).toBe('bjork');
  });
});

describe('sorting', () => {
  it('sorts by title, then artist, then year', () => {
    const tracks = [
      track({ title: 'B', artist: 'Z', year: 1999 }),
      track({ title: 'A', artist: 'Y', year: 2001 }),
    ];
    expect(sortTracks(tracks, 'title').map((entry) => entry.title)).toEqual([
      'A',
      'B',
    ]);
    expect(sortTracks(tracks, 'artist').map((entry) => entry.title)).toEqual([
      'A',
      'B',
    ]);
    expect(sortTracks(tracks, 'year').map((entry) => entry.title)).toEqual([
      'B',
      'A',
    ]);
  });

  it('does not mutate its input', () => {
    const tracks = [track({ title: 'B' }), track({ title: 'A' })];
    sortTracks(tracks, 'title');
    expect(tracks.map((entry) => entry.title)).toEqual(['B', 'A']);
  });

  it('puts a record back in the order it was pressed in', () => {
    // The order off the tags, which is the one an album is meant to be heard
    // in and the only one no other column can give.
    const tracks = [
      track({ title: 'Third', album: 'One', trackNo: 3 }),
      track({ title: 'First', album: 'One', trackNo: 1 }),
      track({ title: 'Second', album: 'One', trackNo: 2 }),
    ];
    expect(sortTracks(tracks, 'track').map((entry) => entry.title)).toEqual([
      'First',
      'Second',
      'Third',
    ]);
  });

  it('keeps two records apart when sorting by track number', () => {
    // Number alone would interleave every album's track one, then every
    // album's track two — a shelf of first tracks, which is nobody's idea of
    // "sort by number". The album comes first and the number orders within it.
    const tracks = [
      track({ title: 'B1', album: 'Beta', trackNo: 1 }),
      track({ title: 'A2', album: 'Alpha', trackNo: 2 }),
      track({ title: 'B2', album: 'Beta', trackNo: 2 }),
      track({ title: 'A1', album: 'Alpha', trackNo: 1 }),
    ];
    expect(sortTracks(tracks, 'track').map((entry) => entry.title)).toEqual([
      'A1',
      'A2',
      'B1',
      'B2',
    ]);
  });

  it('orders by disc before track number', () => {
    const tracks = [
      track({ title: 'Two-one', album: 'One', discNo: 2, trackNo: 1 }),
      track({ title: 'One-two', album: 'One', discNo: 1, trackNo: 2 }),
    ];
    expect(sortTracks(tracks, 'track').map((entry) => entry.title)).toEqual([
      'One-two',
      'Two-one',
    ]);
  });
});

describe('sorting what a grouping shows', () => {
  // Sorting the tracks was never enough. `groupIntoAlbums` returns its groups
  // in the order the Map happened to build them, so every sort control was
  // dead in the album and artist browse modes: the order out was the order
  // in, whatever was asked for.
  const zebra = track({
    title: 'Z',
    album: 'Zebra',
    artist: 'Aaron',
    year: 1999,
    addedAt: 10,
  });
  const apple = track({
    title: 'A',
    album: 'Apple',
    artist: 'Zoe',
    year: 2020,
    addedAt: 50,
  });

  it('orders albums by whichever field was asked for, not by insertion', () => {
    const albums = groupIntoAlbums([zebra, apple]);
    // The control: as grouped, Zebra comes first purely because it was first
    // in. Every expectation below is a departure from this order or from its
    // reverse, so none of them can pass by accident.
    expect(albums.map((entry) => entry.title)).toEqual(['Zebra', 'Apple']);

    expect(sortAlbums(albums, 'title').map((entry) => entry.title)).toEqual([
      'Apple',
      'Zebra',
    ]);
    // By artist the answer flips back to Zebra first — Aaron before Zoe — so
    // this is not the title sort under another name.
    expect(sortAlbums(albums, 'artist').map((entry) => entry.title)).toEqual([
      'Zebra',
      'Apple',
    ]);
    expect(sortAlbums(albums, 'year').map((entry) => entry.year)).toEqual([
      1999, 2020,
    ]);
    // 'added' reads newest first, which is the only sort whose name already
    // implies its direction.
    expect(sortAlbums(albums, 'added').map((entry) => entry.title)).toEqual([
      'Apple',
      'Zebra',
    ]);
    expect(
      sortAlbums(albums, 'title', 'desc').map((entry) => entry.title),
    ).toEqual(['Zebra', 'Apple']);
  });

  it('carries an album its newest addedAt, not its oldest', () => {
    // An album counts as recently added when the latest thing in it is.
    const albums = groupIntoAlbums([
      track({ title: 'old', album: 'Mixed', artist: 'X', addedAt: 5 }),
      track({ title: 'new', album: 'Mixed', artist: 'X', addedAt: 900 }),
    ]);
    expect(albums[0].addedAt).toBe(900);
  });

  it('orders artists by name or by how much of them there is', () => {
    const artists = groupIntoArtists([zebra, apple, apple]);
    expect(artists.map((entry) => entry.name)).toEqual(['Aaron', 'Zoe']);

    expect(sortArtists(artists, 'title').map((entry) => entry.name)).toEqual([
      'Aaron',
      'Zoe',
    ]);
    // Nothing an artist carries is a year, so 'year' falls to the count —
    // Zoe has two tracks to Aaron's one, and leads.
    expect(sortArtists(artists, 'year').map((entry) => entry.name)).toEqual([
      'Zoe',
      'Aaron',
    ]);
    expect(sortArtists(artists, 'added').map((entry) => entry.name)).toEqual([
      'Zoe',
      'Aaron',
    ]);
  });

  it('does not mutate the array it was handed', () => {
    const albums = groupIntoAlbums([zebra, apple]);
    sortAlbums(albums, 'title');
    expect(albums.map((entry) => entry.title)).toEqual(['Zebra', 'Apple']);
  });
});
