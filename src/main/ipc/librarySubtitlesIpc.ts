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
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  type OpenDialogOptions,
} from 'electron';
import { libraryFileKind } from '../../common/library/files';
import type { TSubtitleImportResult } from '../../common/library/subtitleImport';
import {
  type ILibrarySubtitlesAnswer,
  SUBTITLE_EXTENSIONS,
} from '../../common/library/subtitles';
import {
  importPickedSubtitles,
  importVideoSubtitles,
  readTrackSubtitles,
} from '../library/librarySubtitles';
import mainText from '../mainText';

export interface ILibrarySubtitlesIpcDeps {
  getMainWindow: () => BrowserWindow | null;
  /** The file a track id names, from the library's store. */
  trackPath: (trackId: string) => string | undefined;
}

/** Languages the window may name as preferred; more is not a preference. */
const MAX_PREFERRED = 8;

/** Far over any language tag (BCP 47 allows 35 characters in practice). */
const MAX_TAG_CHARS = 35;

/** A text no subtitle file under the reader's cap can exceed, checked
 * before it is encoded to find its bytes. */
const MAX_IMPORT_CHARS = 4 * 1024 * 1024;

const isText = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length <= max;

/**
 * The Subtitles tab's three calls: a video's subtitles, keeping a file
 * picked in the open dialog beside it, and keeping a dropped one.
 *
 * BY ID ONLY, as the Lyrics tab's calls: main finds the video in the store,
 * a subtitle file is read only when it is one found beside that video, and
 * one is written only there. An id that names a song answers as a video
 * with no subtitles, and keeps nothing.
 */
export const registerLibrarySubtitlesIpc = ({
  getMainWindow,
  trackPath,
}: ILibrarySubtitlesIpcDeps): void => {
  const videoOf = (rawTrackId: unknown): string | undefined => {
    const file = isText(rawTrackId, 512) ? trackPath(rawTrackId) : undefined;
    return file !== undefined && libraryFileKind(file) === 'video'
      ? file
      : undefined;
  };

  ipcMain.handle(
    'library-track-subtitles',
    async (
      _event,
      rawTrackId: unknown,
      rawWanted: unknown,
      rawPreferred: unknown,
    ): Promise<ILibrarySubtitlesAnswer | undefined> => {
      const video = videoOf(rawTrackId);
      if (video === undefined) {
        return undefined;
      }
      const preferred = Array.isArray(rawPreferred)
        ? rawPreferred
            .filter((tag): tag is string => isText(tag, MAX_TAG_CHARS))
            .slice(0, MAX_PREFERRED)
        : [];
      return readTrackSubtitles(
        video,
        isText(rawWanted, 512) ? rawWanted : undefined,
        preferred,
      );
    },
  );

  // Opens in Downloads, where a file fetched from a subtitle site lands.
  ipcMain.handle(
    'library-subtitles-pick',
    async (_event, rawTrackId: unknown): Promise<TSubtitleImportResult> => {
      const video = videoOf(rawTrackId);
      if (video === undefined) {
        return { state: 'failed' };
      }
      const window = getMainWindow();
      const options: OpenDialogOptions = {
        defaultPath: app.getPath('downloads'),
        properties: ['openFile'],
        filters: [
          {
            name: mainText('files.type.subtitles'),
            extensions: [...SUBTITLE_EXTENSIONS],
          },
        ],
      };
      const result = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options);
      const [file] = result.filePaths;
      if (result.canceled || file === undefined) {
        return { state: 'canceled' };
      }
      try {
        return await importPickedSubtitles(video, file);
      } catch (error) {
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; the window says the file could not be read
        console.error(`Could not read the subtitle file ${file}`, error);
        return { state: 'refused', reason: 'notText' };
      }
    },
  );

  ipcMain.handle(
    'library-subtitles-import',
    async (
      _event,
      rawTrackId: unknown,
      rawSourceName: unknown,
      rawText: unknown,
    ): Promise<TSubtitleImportResult> => {
      const video = videoOf(rawTrackId);
      if (
        video === undefined ||
        !isText(rawSourceName, 512) ||
        typeof rawText !== 'string'
      ) {
        return { state: 'failed' };
      }
      if (rawText.length > MAX_IMPORT_CHARS) {
        return { state: 'refused', reason: 'tooBig' };
      }
      return importVideoSubtitles({
        videoPath: video,
        sourceName: rawSourceName,
        text: rawText,
      });
    },
  );
};
