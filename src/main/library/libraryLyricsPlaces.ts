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
 * The two places a song's lyrics files live, shared by the reader
 * (`libraryLyrics.ts`) and the import (`libraryLyricsImport.ts`) so they can
 * never disagree about a name.
 *
 * Beside the song, under its own name: where every player looks, and where
 * an import goes first. In FluidEQ's own folder, under a hash of the song's
 * path: where an import goes when the song's folder cannot be written — a
 * read-only share, a folder the user has no rights to, a cloud placeholder
 * that refuses a write. The hash is of the path because the path is what the
 * library keys a song by; a song moved elsewhere is a new song to it too.
 */

import { createHash } from 'crypto';
import path from 'path';
import type { TLyricsFileExtension } from '../../common/library/lyricsImport';

/** FluidEQ's own lyrics folder, under the app's data folder. */
export const LYRICS_STORE_FOLDER = 'library-lyrics';

/** The song's own name with another extension, beside it. */
export const sidecarPath = (trackPath: string, extension: string): string => {
  const parsed = path.parse(trackPath);
  return path.join(parsed.dir, `${parsed.name}${extension}`);
};

/**
 * The song's lyrics file in FluidEQ's own folder. Windows paths are compared
 * without case, as Windows compares them, so a rescan that spells a folder
 * differently still finds the same file.
 */
export const storedLyricsPath = (
  storeDir: string,
  trackPath: string,
  extension: TLyricsFileExtension,
): string => {
  const resolved = path.resolve(trackPath);
  const key = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  const digest = createHash('sha256').update(key, 'utf8').digest('hex');
  return path.join(storeDir, `${digest}${extension}`);
};
