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
 * Lyrics the listener no longer wants with a song — imported or pasted by
 * mistake — removed from one of the two places the Lyrics tab reads files
 * from (`libraryLyricsPlaces.ts`): the song's own `.lrc` or `.txt` beside it,
 * or FluidEQ's copy in its lyrics folder.
 *
 * Only ever those two names, built here from the song's path in the store;
 * the window names a place and an extension and nothing else. And only a
 * plain file: a link or a junction under the lyrics file's name is left
 * where it is, because removing it is removing somebody else's file, or
 * deleting through it something that is not lyrics at all.
 */

import fs from 'fs';
import type {
  ILyricsRemoveTarget,
  TLyricsRemoveResult,
} from '../../common/library/lyricsImport';
import { sidecarPath, storedLyricsPath } from './libraryLyricsPlaces';

export interface ILyricsRemoveRequest {
  /** The song's file, from the library's store — never from the window. */
  trackPath: string;
  /** FluidEQ's own lyrics folder (`LYRICS_STORE_FOLDER` under user data). */
  storeDir: string;
  target: ILyricsRemoveTarget;
}

export const removeTrackLyrics = ({
  trackPath,
  storeDir,
  target,
}: ILyricsRemoveRequest): TLyricsRemoveResult => {
  const file =
    target.place === 'beside'
      ? sidecarPath(trackPath, target.extension)
      : storedLyricsPath(storeDir, trackPath, target.extension);
  let stats: fs.Stats;
  try {
    // `lstat`, not `stat`: a link answers as a link, not as what it points at.
    stats = fs.lstatSync(file);
  } catch {
    return { state: 'missing' };
  }
  if (!stats.isFile()) {
    return { state: 'refused' };
  }
  try {
    fs.unlinkSync(file);
    return { state: 'removed' };
  } catch (error) {
    // eslint-disable-next-line no-console -- context-rich error before it is dropped; the tab says the lyrics were not removed
    console.error(`Could not remove the lyrics file ${file}`, error);
    return { state: 'failed' };
  }
};
