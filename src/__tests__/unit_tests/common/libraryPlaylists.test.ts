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

import {
  FAVORITES_PLAYLIST_ID,
  ILibraryPlaylist,
  MAX_PLAYLIST_NAME_LENGTH,
  addTracksToPlaylist,
  emptyLibraryPlaylists,
  favoritesPlaylist,
  findPlaylist,
  isTrackInPlaylist,
  normalizePlaylistName,
  parseLibraryPlaylists,
  removeTracksFromPlaylist,
  sortPlaylists,
} from '../../../common/library/playlists';

const playlist = (over: Partial<ILibraryPlaylist>): ILibraryPlaylist => ({
  id: over.name ?? 'pl-1',
  name: 'Untitled',
  trackIds: [],
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

describe('what a playlist file may hold', () => {
  it('starts with Favourites and nothing else', () => {
    const { playlists } = emptyLibraryPlaylists();
    expect(playlists).toHaveLength(1);
    expect(playlists[0].id).toBe(FAVORITES_PLAYLIST_ID);
    expect(playlists[0].isBuiltIn).toBe(true);
  });

  it('reads back a file it wrote', () => {
    const written = {
      version: 1,
      playlists: [favoritesPlaylist(), playlist({ name: 'Drive', id: 'pl-a' })],
    };
    const parsed = parseLibraryPlaylists(JSON.parse(JSON.stringify(written)));
    expect(parsed?.playlists.map((entry) => entry.id)).toEqual([
      FAVORITES_PLAYLIST_ID,
      'pl-a',
    ]);
  });

  // The whole point of the strict parse: a file with one unreadable entry is
  // corrupt, not a smaller valid file. Trimming it silently would look
  // exactly like playlists the user made having quietly disappeared.
  it('refuses a file with an entry it cannot read rather than dropping it', () => {
    expect(
      parseLibraryPlaylists({
        version: 1,
        playlists: [favoritesPlaylist(), { id: 'pl-a', name: 'Drive' }],
      }),
    ).toBeUndefined();
  });

  it('refuses two playlists claiming one id', () => {
    expect(
      parseLibraryPlaylists({
        version: 1,
        playlists: [
          playlist({ id: 'pl-a', name: 'One' }),
          playlist({ id: 'pl-a', name: 'Two' }),
        ],
      }),
    ).toBeUndefined();
  });

  it('refuses a version it does not know', () => {
    expect(
      parseLibraryPlaylists({ version: 2, playlists: [] }),
    ).toBeUndefined();
  });

  // A file from before Favourites existed, or one whose owner deleted it by
  // hand. Putting it back is a repair; refusing the file would throw away
  // every playlist beside it for the sake of one that is regenerable.
  it('puts Favourites back into a file that parses without it', () => {
    const parsed = parseLibraryPlaylists({
      version: 1,
      playlists: [playlist({ id: 'pl-a', name: 'Drive' })],
    });
    expect(parsed?.playlists[0].id).toBe(FAVORITES_PLAYLIST_ID);
    expect(parsed?.playlists).toHaveLength(2);
  });
});

describe('putting songs into a playlist', () => {
  it('appends in the order they were added', () => {
    const next = addTracksToPlaylist(
      [playlist({ id: 'pl-a', trackIds: ['one'] })],
      'pl-a',
      ['two', 'three'],
    );
    expect(next[0].trackIds).toEqual(['one', 'two', 'three']);
  });

  // A playlist is a set with an order. Pressing the menu item twice is the
  // ordinary way this happens and it must not leave the song in there twice.
  it('never lists the same song twice', () => {
    const next = addTracksToPlaylist(
      [playlist({ id: 'pl-a', trackIds: ['one'] })],
      'pl-a',
      ['one'],
    );
    expect(next[0].trackIds).toEqual(['one']);
  });

  it('de-duplicates within one call as well', () => {
    const next = addTracksToPlaylist([playlist({ id: 'pl-a' })], 'pl-a', [
      'one',
      'one',
      'two',
    ]);
    expect(next[0].trackIds).toEqual(['one', 'two']);
  });

  // A POSITIVE CONTROL FOR THE TWO ABOVE. Without it, an implementation that
  // returned the playlist untouched for every input would pass them both —
  // "found nothing" would be indistinguishable from "changed nothing ever".
  it('does move `updatedAt` when something actually went in', () => {
    const before = playlist({ id: 'pl-a', updatedAt: 1 });
    const added = addTracksToPlaylist([before], 'pl-a', ['one'])[0];
    const unchanged = addTracksToPlaylist([added], 'pl-a', ['one'])[0];
    expect(added.updatedAt).toBeGreaterThan(1);
    expect(unchanged).toBe(added);
  });

  it('leaves every other playlist alone', () => {
    const next = addTracksToPlaylist(
      [playlist({ id: 'pl-a' }), playlist({ id: 'pl-b' })],
      'pl-a',
      ['one'],
    );
    expect(next[1].trackIds).toEqual([]);
  });

  it('takes songs back out and leaves the rest in order', () => {
    const next = removeTracksFromPlaylist(
      [playlist({ id: 'pl-a', trackIds: ['one', 'two', 'three'] })],
      'pl-a',
      ['two'],
    );
    expect(next[0].trackIds).toEqual(['one', 'three']);
  });

  it('answers whether a song is in one', () => {
    const entry = playlist({ id: 'pl-a', trackIds: ['one'] });
    expect(isTrackInPlaylist(entry, 'one')).toBe(true);
    expect(isTrackInPlaylist(entry, 'two')).toBe(false);
    expect(isTrackInPlaylist(undefined, 'one')).toBe(false);
  });

  // `find`, not a lookup object: an id that arrives from the renderer could
  // read 'constructor' and come back with an inherited function.
  it('does not resolve an id that names something on Object.prototype', () => {
    expect(findPlaylist([playlist({ id: 'pl-a' })], 'constructor')).toBe(
      undefined,
    );
  });
});

describe('naming a playlist', () => {
  it('trims what was typed', () => {
    expect(normalizePlaylistName('  Drive  ')).toBe('Drive');
  });

  it('answers nothing for a name that is only spaces', () => {
    expect(normalizePlaylistName('   ')).toBeUndefined();
    expect(normalizePlaylistName('')).toBeUndefined();
    expect(normalizePlaylistName(undefined)).toBeUndefined();
    expect(normalizePlaylistName(42)).toBeUndefined();
  });

  it('cuts an essay down rather than refusing it', () => {
    const long = 'a'.repeat(MAX_PLAYLIST_NAME_LENGTH + 40);
    expect(normalizePlaylistName(long)).toHaveLength(MAX_PLAYLIST_NAME_LENGTH);
  });
});

describe('the order every surface shows them in', () => {
  it('puts Favourites first and the rest by name', () => {
    const sorted = sortPlaylists([
      playlist({ id: 'pl-z', name: 'Zither' }),
      favoritesPlaylist(),
      playlist({ id: 'pl-a', name: 'Arcade' }),
    ]);
    expect(sorted.map((entry) => entry.name)).toEqual([
      'Favorites',
      'Arcade',
      'Zither',
    ]);
  });

  it('does not reorder the array it was given', () => {
    const original = [
      playlist({ id: 'pl-z', name: 'Zither' }),
      favoritesPlaylist(),
    ];
    sortPlaylists(original);
    expect(original[0].name).toBe('Zither');
  });
});
