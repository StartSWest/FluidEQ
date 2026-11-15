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
import path from 'path';
import {
  asLyricsRemoveTarget,
  type TLyricsImportResult,
  type TLyricsPickResult,
  type TLyricsRemoveResult,
} from '../../common/library/lyricsImport';
import { readTrackLyrics } from '../library/libraryLyrics';
import {
  importTrackLyrics,
  readPickedLyrics,
} from '../library/libraryLyricsImport';
import { removeTrackLyrics } from '../library/libraryLyricsRemove';
import { LYRICS_STORE_FOLDER } from '../library/libraryLyricsPlaces';
import mainText from '../mainText';

export interface ILibraryLyricsIpcDeps {
  userDataDir: string;
  getMainWindow: () => BrowserWindow | null;
  /** The file a track id names, from the library's store. */
  trackPath: (trackId: string) => string | undefined;
}

/** A length no lyrics text the window may send can pass: the checker cuts
 * at the file cap in bytes, and this only keeps a far larger string from
 * being encoded to find that out. */
const MAX_IMPORT_CHARS = 1024 * 1024;

/**
 * The Lyrics tab's four calls: a song's words, the open dialog for a lyrics
 * file, keeping lyrics with a song, and removing a lyrics file kept with it.
 *
 * BY ID ONLY. The window names a song by its library id and main finds the
 * file in the store, so neither the reader, the writer nor the remover can be pointed at
 * a path that is not a library song's own lyrics file, or FluidEQ's copy of
 * one.
 */
export const registerLibraryLyricsIpc = ({
  userDataDir,
  getMainWindow,
  trackPath,
}: ILibraryLyricsIpcDeps): void => {
  const storeDir = path.join(userDataDir, LYRICS_STORE_FOLDER);

  const songOf = (rawTrackId: unknown): string | undefined =>
    typeof rawTrackId === 'string' && rawTrackId.length <= 512
      ? trackPath(rawTrackId)
      : undefined;

  ipcMain.handle(
    'library-track-lyrics',
    async (_event, rawTrackId: unknown) => {
      const song = songOf(rawTrackId);
      return song === undefined ? undefined : readTrackLyrics(song, storeDir);
    },
  );

  // Opens in Downloads, where a file fetched from a lyrics site lands. The
  // file is read here and handed back as text, so the window imports it the
  // same way as a dropped file or pasted words — and can ask before
  // replacing one without the dialog having to open again.
  ipcMain.handle(
    'library-lyrics-pick',
    async (): Promise<TLyricsPickResult> => {
      const window = getMainWindow();
      const options: OpenDialogOptions = {
        defaultPath: app.getPath('downloads'),
        properties: ['openFile'],
        filters: [
          { name: mainText('files.type.lyrics'), extensions: ['lrc', 'txt'] },
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
        return await readPickedLyrics(file);
      } catch (error) {
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; the window says the file could not be read
        console.error(`Could not read the lyrics file ${file}`, error);
        return { state: 'refused', reason: 'notText' };
      }
    },
  );

  ipcMain.handle(
    'library-lyrics-import',
    (
      _event,
      rawTrackId: unknown,
      rawText: unknown,
      rawReplace: unknown,
    ): TLyricsImportResult | undefined => {
      const song = songOf(rawTrackId);
      if (song === undefined || typeof rawText !== 'string') {
        return undefined;
      }
      if (rawText.length > MAX_IMPORT_CHARS) {
        return { state: 'refused', reason: 'tooBig' };
      }
      return importTrackLyrics({
        trackPath: song,
        storeDir,
        text: rawText,
        replace: rawReplace === true,
      });
    },
  );

  ipcMain.handle(
    'library-lyrics-remove',
    (
      _event,
      rawTrackId: unknown,
      rawTarget: unknown,
    ): TLyricsRemoveResult | undefined => {
      const song = songOf(rawTrackId);
      const target = asLyricsRemoveTarget(rawTarget);
      if (song === undefined || target === undefined) {
        return undefined;
      }
      return removeTrackLyrics({ trackPath: song, storeDir, target });
    },
  );
};
