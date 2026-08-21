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

/**
 * Named runs of track ids, and the rules that hold for all of them.
 *
 * Pure and dependency-free, so main can validate a file with the same code
 * the renderer reasons about the result of — the split `mediaUrl.ts` makes
 * for the same reason, and for the same webpack reason.
 *
 * A playlist holds ids, never paths and never tracks. The index is the only
 * thing that knows what an id resolves to, and it is allowed to stop knowing:
 * an unplugged drive takes its tracks out of the index and puts them back
 * when it returns. Resolution therefore happens at render, which is what lets
 * a playlist survive the drive being out.
 */

/** The one playlist that always exists and cannot be removed. */
export const FAVORITES_PLAYLIST_ID = 'favorites';

/** Long enough for a sentence, short enough to draw. Trimmed, never cut. */
export const MAX_PLAYLIST_NAME_LENGTH = 80;

export interface ILibraryPlaylist {
  id: string;
  /**
   * What to call it, and for Favorites a fallback rather than the answer.
   *
   * The built-in is drawn from `library.playlist.favorites`, so it follows
   * the interface language instead of freezing whichever locale happened to
   * be set the first time the app ran. This field still carries a name for
   * it, because anything reading the file without a translation table — a
   * bug report, a person with a text editor — deserves better than an id.
   */
  name: string;
  /** Favorites, and nothing else. Rename and delete both refuse it. */
  isBuiltIn?: true;
  /** Playlist order, which is the order they were added unless moved. */
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ILibraryPlaylists {
  version: 1;
  playlists: ILibraryPlaylist[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

const isPlaylist = (value: unknown): value is ILibraryPlaylist =>
  isObject(value) &&
  typeof value.id === 'string' &&
  value.id.length > 0 &&
  typeof value.name === 'string' &&
  (value.isBuiltIn === undefined || value.isBuiltIn === true) &&
  isStringArray(value.trackIds) &&
  typeof value.createdAt === 'number' &&
  typeof value.updatedAt === 'number';

export const favoritesPlaylist = (): ILibraryPlaylist => ({
  id: FAVORITES_PLAYLIST_ID,
  // English, and only ever seen by something with no translation table. The
  // interface asks `t('library.playlist.favorites')` instead.
  name: 'Favorites',
  isBuiltIn: true,
  trackIds: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export const emptyLibraryPlaylists = (): ILibraryPlaylists => ({
  version: 1,
  playlists: [favoritesPlaylist()],
});

/**
 * Favorites first, then everything else by name.
 *
 * Applied everywhere the set is shown rather than to the stored order,
 * because the stored order is creation order and that is worth keeping: it is
 * what a future "recently made" reading would need, and sorting on write
 * would destroy it.
 */
export const sortPlaylists = (
  playlists: readonly ILibraryPlaylist[],
): ILibraryPlaylist[] =>
  [...playlists].sort((left, right) => {
    if (left.isBuiltIn !== right.isBuiltIn) {
      return left.isBuiltIn ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });

/**
 * Whatever was typed, or nothing.
 *
 * Undefined for a name that is only whitespace — the caller shows the field
 * again rather than creating "   ". Truncation is deliberate rather than a
 * rejection: somebody who pastes an essay in meant the first line of it.
 */
export const normalizePlaylistName = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.trim().slice(0, MAX_PLAYLIST_NAME_LENGTH).trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

/**
 * A file this version of FluidEQ did not write, or one it did.
 *
 * Undefined for anything that fails, entry by entry — the same strictness
 * `parseLibraryIndex` applies and for the same reason: silently dropping the
 * entries that did not parse turns a corrupt file into a smaller valid one,
 * and here that reads as playlists the user made having quietly disappeared.
 *
 * Favorites is the one repair made rather than refused. A file that parses
 * cleanly but has no built-in in it is a file from before it existed, or one
 * whose owner deleted it by hand; either way the answer is to put it back,
 * not to throw away every playlist beside it.
 */
export const parseLibraryPlaylists = (
  raw: unknown,
): ILibraryPlaylists | undefined => {
  if (!isObject(raw) || raw.version !== 1 || !Array.isArray(raw.playlists)) {
    return undefined;
  }
  const playlists = raw.playlists.filter(isPlaylist);
  if (playlists.length !== raw.playlists.length) {
    return undefined;
  }
  // Two playlists claiming one id would make every lookup below depend on
  // which one `find` reached first, so the file is corrupt rather than
  // ambiguous.
  const ids = new Set(playlists.map((playlist) => playlist.id));
  if (ids.size !== playlists.length) {
    return undefined;
  }
  return {
    version: 1,
    playlists: ids.has(FAVORITES_PLAYLIST_ID)
      ? playlists
      : [favoritesPlaylist(), ...playlists],
  };
};

const touch = (
  playlist: ILibraryPlaylist,
  trackIds: string[],
): ILibraryPlaylist => ({ ...playlist, trackIds, updatedAt: Date.now() });

const replace = (
  playlists: readonly ILibraryPlaylist[],
  id: string,
  change: (playlist: ILibraryPlaylist) => ILibraryPlaylist,
): ILibraryPlaylist[] =>
  playlists.map((playlist) =>
    playlist.id === id ? change(playlist) : playlist,
  );

/**
 * Appended, and never twice.
 *
 * A playlist is a set with an order, not a bag: adding a song that is already
 * in it leaves it where it is rather than putting a second copy at the end.
 * Somebody who wants it twice can say so once reordering exists; somebody who
 * pressed the menu item twice did not.
 */
export const addTracksToPlaylist = (
  playlists: readonly ILibraryPlaylist[],
  id: string,
  trackIds: readonly string[],
): ILibraryPlaylist[] =>
  replace(playlists, id, (playlist) => {
    const present = new Set(playlist.trackIds);
    const added = trackIds.filter((trackId) => {
      if (present.has(trackId)) {
        return false;
      }
      present.add(trackId);
      return true;
    });
    return added.length === 0
      ? playlist
      : touch(playlist, [...playlist.trackIds, ...added]);
  });

export const removeTracksFromPlaylist = (
  playlists: readonly ILibraryPlaylist[],
  id: string,
  trackIds: readonly string[],
): ILibraryPlaylist[] =>
  replace(playlists, id, (playlist) => {
    const removing = new Set(trackIds);
    const kept = playlist.trackIds.filter((trackId) => !removing.has(trackId));
    return kept.length === playlist.trackIds.length
      ? playlist
      : touch(playlist, kept);
  });

export const isTrackInPlaylist = (
  playlist: ILibraryPlaylist | undefined,
  trackId: string,
): boolean => playlist?.trackIds.includes(trackId) === true;

export const findPlaylist = (
  playlists: readonly ILibraryPlaylist[],
  id: string,
): ILibraryPlaylist | undefined =>
  // Not a lookup object, for the reason `trackPathById` is not one: an id
  // that arrives from the renderer could read 'constructor' and come back
  // with an inherited function instead of undefined.
  playlists.find((playlist) => playlist.id === id);
