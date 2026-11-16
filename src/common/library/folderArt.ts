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

import { libraryBaseName, libraryFileExtension } from './files';

/**
 * The folder picture the Library shows for songs whose tags carry none,
 * shared here so that Fix tags offers exactly the picture the Library
 * already draws (Ivan, 2026-11-16: "why it doesn't show the cover art pic
 * if already exists ... I can see it in the album"). Moved from
 * `main/library/libraryMetadata.ts` unchanged.
 */

/** Conventional cover-art file names, in the order a folder is searched. */
export const FOLDER_ART_NAMES = [
  'cover',
  'folder',
  'front',
  'album',
  'artwork',
] as const;

export const FOLDER_ART_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

/**
 * Finds a cover image beside a track, for files whose tags carry none.
 *
 * Walks `FOLDER_ART_NAMES` in order and returns the first directory entry
 * that matches — order of the names decides, not order of the listing. A
 * directory listing's order is the filesystem's business and differs between
 * machines, so a folder with both `folder.jpg` and `cover.jpg` must not pick
 * a different one depending on which computer scans it.
 */
export const findFolderArt = (
  entries: readonly string[],
): string | undefined => {
  const matchForName = (name: string): string | undefined =>
    entries.find(
      (entry) =>
        libraryBaseName(entry) === name &&
        FOLDER_ART_EXTENSIONS.includes(libraryFileExtension(entry)),
    );
  const matches = FOLDER_ART_NAMES.map(matchForName);
  return matches.find((match): match is string => match !== undefined);
};
