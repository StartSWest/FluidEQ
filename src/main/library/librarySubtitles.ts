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
 * A video's subtitles, read in main for the Library's Subtitles tab, and
 * subtitles the viewer brings kept beside it (`subtitles.ts`,
 * `subtitleImport.ts`).
 *
 * The video's path comes from the store by its id, never from the window;
 * a file is read only when it is one of the subtitle files found beside
 * that video, and written only there, under the video's own name.
 */

import fs from 'fs';
import path from 'path';
import writeFileAtomically from '../atomicWrite';
import { decodeLyricsBytes } from '../../common/library/lyricsImport';
import {
  checkSubtitleImport,
  subtitleDestinationName,
  type TSubtitleImportResult,
} from '../../common/library/subtitleImport';
import {
  type ILibrarySubtitlesAnswer,
  lookedSubtitleNames,
  MAX_SUBTITLE_FILE_BYTES,
  pickSubtitle,
  subtitleFilesOf,
  subtitleLines,
} from '../../common/library/subtitles';

/** The names in the video's folder; none where it cannot be listed. */
const siblingsOf = async (videoPath: string): Promise<string[]> => {
  try {
    return await fs.promises.readdir(path.dirname(videoPath));
  } catch (error) {
    // eslint-disable-next-line no-console -- context-rich error before it is dropped; the tab says no subtitles were found
    console.error(`Could not list the folder of ${videoPath}`, error);
    return [];
  }
};

/**
 * A subtitle file's text, in whichever encoding it was saved — subtitle
 * tools write UTF-16 as often as UTF-8, and older ones the Windows code page
 * (`decodeLyricsBytes`). Nothing for a file that is gone, is not a plain
 * file, or is bigger than any subtitle file.
 */
export const readSubtitleText = async (
  file: string,
): Promise<string | undefined> => {
  try {
    const stats = await fs.promises.stat(file);
    if (!stats.isFile() || stats.size > MAX_SUBTITLE_FILE_BYTES) {
      return undefined;
    }
    return decodeLyricsBytes(await fs.promises.readFile(file));
  } catch {
    // Gone since the folder was listed, or not readable: nothing to show.
    return undefined;
  }
};

/**
 * Every subtitle file beside the video, and the lines of one: `wanted`
 * where it names one of them, else the one `pickSubtitle` puts first for
 * the viewer's `preferred` languages.
 */
export const readTrackSubtitles = async (
  videoPath: string,
  wanted: string | undefined,
  preferred: readonly string[],
): Promise<ILibrarySubtitlesAnswer> => {
  const videoName = path.basename(videoPath);
  const files = subtitleFilesOf(videoName, await siblingsOf(videoPath));
  const looked = lookedSubtitleNames(videoName);
  const chosen =
    files.find((file) => file.fileName === wanted) ??
    pickSubtitle(files, preferred);
  if (chosen === undefined) {
    return { files, looked };
  }
  const text = await readSubtitleText(
    path.join(path.dirname(videoPath), chosen.fileName),
  );
  return {
    files,
    looked,
    shown: {
      fileName: chosen.fileName,
      lines: text === undefined ? [] : subtitleLines(text, chosen.fileName),
    },
  };
};

/**
 * Keeps a subtitle file beside the video, checked here whatever the window
 * checked, under a name no file has yet (`subtitleDestinationName`) and
 * through a temporary file and a rename, so a player never reads half of
 * one.
 */
export const importVideoSubtitles = async ({
  videoPath,
  sourceName,
  text,
}: {
  videoPath: string;
  sourceName: string;
  text: string;
}): Promise<TSubtitleImportResult> => {
  const check = checkSubtitleImport(text, sourceName);
  if (!check.ok) {
    return { state: 'refused', reason: check.reason };
  }
  const folder = path.dirname(videoPath);
  // Windows and macOS compare names without case: `movie.SRT` takes the
  // place of `Movie.srt` there.
  const taken = new Set(
    (await siblingsOf(videoPath)).map((name) => name.toLowerCase()),
  );
  const fileName = subtitleDestinationName(
    path.basename(videoPath),
    sourceName,
    check.extension,
    (name) => taken.has(name.toLowerCase()),
  );
  if (fileName === undefined) {
    return { state: 'failed' };
  }
  try {
    // The video's folder has to be there already: the writer makes the
    // folders it writes into, and one that vanished with its video is not
    // one to bring back for a subtitle file.
    if (!(await fs.promises.stat(folder)).isDirectory()) {
      return { state: 'failed' };
    }
    writeFileAtomically(path.join(folder, fileName), check.text);
    return { state: 'saved', fileName };
  } catch (error) {
    // eslint-disable-next-line no-console -- context-rich error before it is dropped; the tab says the subtitles were not saved
    console.error(`Could not keep subtitles beside ${videoPath}`, error);
    return { state: 'failed' };
  }
};

/** A subtitle file picked in the open dialog, kept beside the video. */
export const importPickedSubtitles = async (
  videoPath: string,
  file: string,
): Promise<TSubtitleImportResult> => {
  const stats = await fs.promises.stat(file);
  if (!stats.isFile()) {
    return { state: 'refused', reason: 'notText' };
  }
  if (stats.size > MAX_SUBTITLE_FILE_BYTES) {
    return { state: 'refused', reason: 'tooBig' };
  }
  return importVideoSubtitles({
    videoPath,
    sourceName: path.basename(file),
    text: decodeLyricsBytes(await fs.promises.readFile(file)),
  });
};
