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
 * Where the playlists live, which is beside the index and not inside it.
 *
 * A separate file on purpose. The index is rewritten wholesale at the end of
 * every scan and can be thrown away and rebuilt by walking the disk again;
 * playlists cannot be rebuilt from anything, so a corrupt index must never be
 * able to take them with it.
 *
 * Everything else here is `libraryIndex.ts`'s treatment, deliberately
 * identical: read strictly, back up what will not parse rather than delete
 * it, and write through a temporary file so a write that dies partway leaves
 * the damage in the `.tmp` and not in the only copy of somebody's playlists.
 */

import fs from 'fs';
import path from 'path';
import {
  ILibraryPlaylists,
  emptyLibraryPlaylists,
  parseLibraryPlaylists,
} from '../../common/library/playlists';

const PLAYLISTS_FILENAME = 'library-playlists.json';

export const libraryPlaylistsPath = (userDataDir: string): string =>
  path.join(userDataDir, PLAYLISTS_FILENAME);

const backupUnreadablePlaylists = (target: string): void => {
  try {
    // Overwrites any previous `.bak`, like the index's own: only the most
    // recent corruption is worth keeping, and it is kept rather than deleted
    // because it is still the only record of what the playlists held.
    fs.renameSync(target, `${target}.bak`);
  } catch (error) {
    // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
    console.error(
      `Could not preserve the unreadable library playlists at ${target}`,
      error,
    );
  }
};

/**
 * `wasReset` is true only for a file that existed and could not be read.
 *
 * A first run has no file and nothing was lost, so it is false there — the
 * renderer uses this to say "your playlists could not be read", which would
 * be a lie to somebody who never had any.
 */
export const loadLibraryPlaylists = (
  userDataDir: string,
): { playlists: ILibraryPlaylists; wasReset: boolean } => {
  const target = libraryPlaylistsPath(userDataDir);
  if (!fs.existsSync(target)) {
    return { playlists: emptyLibraryPlaylists(), wasReset: false };
  }
  let parsed: ILibraryPlaylists | undefined;
  try {
    parsed = parseLibraryPlaylists(JSON.parse(fs.readFileSync(target, 'utf8')));
  } catch {
    parsed = undefined;
  }
  if (parsed) {
    return { playlists: parsed, wasReset: false };
  }
  backupUnreadablePlaylists(target);
  return { playlists: emptyLibraryPlaylists(), wasReset: true };
};

export const saveLibraryPlaylists = (
  userDataDir: string,
  playlists: ILibraryPlaylists,
): void => {
  fs.mkdirSync(userDataDir, { recursive: true });
  const target = libraryPlaylistsPath(userDataDir);
  const temporary = `${target}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(playlists, null, 2), 'utf8');
  // Atomic on NTFS and on the POSIX filesystems this app ships on.
  fs.renameSync(temporary, target);
};
