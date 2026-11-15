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
 * Lyrics the listener brought in, kept with the song for good: written as
 * the song's own `.lrc` or `.txt` beside it — the place the Lyrics tab and
 * every other player already read — or, where that folder cannot be
 * written, in FluidEQ's own lyrics folder, which the reader looks in too.
 *
 * NEVER OVER A FILE WITHOUT BEING TOLD TO. A lyrics file already there may
 * be somebody's careful timing; the first ask reports it (`exists`) and
 * writes nothing, and only an ask that says `replace` goes over it.
 *
 * Every write is to a temporary file beside the target and a rename
 * (`writeFileAtomically`), so a crash or a full disk leaves the old file, or
 * none — never half of one where a player would read it.
 */

import fs from 'fs';
import path from 'path';
import writeFileAtomically from '../atomicWrite';
import {
  checkLyricsImport,
  decodeLyricsBytes,
  LYRICS_FILE_EXTENSIONS,
  type TLyricsImportResult,
  type TLyricsPickResult,
} from '../../common/library/lyricsImport';
import { MAX_LYRICS_FILE_BYTES } from '../../common/library/lyrics';
import { sidecarPath, storedLyricsPath } from './libraryLyricsPlaces';

const exists = (file: string): boolean => {
  try {
    fs.lstatSync(file);
    return true;
  } catch {
    return false;
  }
};

const isDirectory = (folder: string): boolean => {
  try {
    return fs.statSync(folder).isDirectory();
  } catch {
    return false;
  }
};

export interface ILyricsImportRequest {
  /** The song's file, from the library's store — never from the window. */
  trackPath: string;
  /** FluidEQ's own lyrics folder (`LYRICS_STORE_FOLDER` under user data). */
  storeDir: string;
  text: string;
  /** The listener said to go over a lyrics file already there. */
  replace: boolean;
}

/**
 * Saves the lyrics beside the song, or in FluidEQ's folder where the song's
 * folder refuses the write. Checked here whatever the window checked.
 */
export const importTrackLyrics = ({
  trackPath,
  storeDir,
  text,
  replace,
}: ILyricsImportRequest): TLyricsImportResult => {
  const check = checkLyricsImport(text);
  if (!check.ok) {
    return { state: 'refused', reason: check.reason };
  }
  const beside = sidecarPath(trackPath, check.extension);
  const besideName = path.basename(beside);
  if (!replace && exists(beside)) {
    return { state: 'exists', place: 'beside', fileName: besideName };
  }

  // The song's folder has to be there already: the atomic writer makes the
  // folders it writes into, and a folder that vanished with its song is not
  // one to bring back for a lyrics file.
  if (isDirectory(path.dirname(beside))) {
    try {
      writeFileAtomically(beside, check.text);
      // FluidEQ's own copy, from a time the folder refused, would now stand
      // beside the listener's newer words and could be read before them.
      LYRICS_FILE_EXTENSIONS.forEach((extension) => {
        fs.rmSync(storedLyricsPath(storeDir, trackPath, extension), {
          force: true,
        });
      });
      return { state: 'saved', place: 'beside', fileName: besideName };
    } catch (error) {
      // A read-only share, a folder without rights, a cloud placeholder that
      // refuses a write: FluidEQ's own folder keeps them instead.
      // eslint-disable-next-line no-console -- context-rich error before it is dropped; the import falls back to FluidEQ's own folder
      console.error(`Could not write lyrics beside ${trackPath}`, error);
    }
  }

  const stored = storedLyricsPath(storeDir, trackPath, check.extension);
  if (!replace && exists(stored)) {
    return { state: 'exists', place: 'store', fileName: besideName };
  }
  try {
    writeFileAtomically(stored, check.text);
    return { state: 'saved', place: 'store', fileName: besideName };
  } catch (error) {
    // eslint-disable-next-line no-console -- context-rich error before it is dropped; the window says the lyrics were not saved
    console.error(`Could not keep lyrics for ${trackPath}`, error);
    return { state: 'failed' };
  }
};

/**
 * A lyrics file the listener picked in the open dialog, as text for the
 * window to import — or why it cannot be. Read whole only once it is known
 * to be no bigger than a lyrics file.
 */
export const readPickedLyrics = async (
  file: string,
): Promise<TLyricsPickResult> => {
  const stats = await fs.promises.stat(file);
  if (!stats.isFile()) {
    return { state: 'refused', reason: 'notText' };
  }
  if (stats.size > MAX_LYRICS_FILE_BYTES) {
    return { state: 'refused', reason: 'tooBig' };
  }
  const text = decodeLyricsBytes(await fs.promises.readFile(file));
  const check = checkLyricsImport(text);
  return check.ok
    ? { state: 'picked', text }
    : { state: 'refused', reason: check.reason };
};
