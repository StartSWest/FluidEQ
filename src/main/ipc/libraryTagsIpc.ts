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
  BrowserWindow,
  dialog,
  ipcMain,
  type OpenDialogOptions,
} from 'electron';
import fs from 'fs';
import path from 'path';
import {
  type ITagFolderFacts,
  MAX_COVER_BYTES,
  type TTagCoverPick,
  type TTagItemAnswer,
  type TTagReadResult,
} from '../../common/library/tagFields';
import type { ILibraryStore } from '../library/libraryStore';
import { storeArtwork } from '../library/libraryArtwork';
import { readFolderCover, readFolderFacts } from '../library/tagFolderFacts';
import type { ITagJobs } from '../library/tagJobs';
import mainText from '../mainText';

/** Songs one read may ask for; the window reads a folder in pages. */
const MAX_READ_IDS = 50;

/** Songs one folder-facts ask may name: the most a folder editor opens on. */
const MAX_FOLDER_IDS = 5000;

const ANSWERS: readonly TTagItemAnswer[] = ['retry', 'skip', 'make-writable'];

export interface ILibraryTagsIpcDeps {
  userDataDir: string;
  store: ILibraryStore;
  getMainWindow: () => BrowserWindow | null;
  announce: () => void;
}

const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 512;

type TTagEngine = typeof import('../library/tagEngine');

/**
 * The tag editor's calls: songs' tags read, a write started, its files
 * answered for, and Undo.
 *
 * BY ID ONLY, like every Library call: the window names songs the store
 * knows and the values to give them; main finds the files, checks every
 * value (`tagRequestGuard.ts`) and writes through a copy renamed into place
 * (`tagWrite.ts`). Progress comes back on `library-tags-job`.
 *
 * The engine itself loads on the first call (`tagEngine.ts`).
 */
export const registerLibraryTagsIpc = ({
  userDataDir,
  store,
  getMainWindow,
  announce,
}: ILibraryTagsIpcDeps): void => {
  let engine: Promise<TTagEngine> | undefined;
  let jobs: ITagJobs | undefined;

  const loadEngine = (): Promise<TTagEngine> => {
    engine = engine ?? import('../library/tagEngine');
    return engine;
  };

  const loadJobs = async (): Promise<ITagJobs> => {
    const { createTagJobs } = await loadEngine();
    jobs =
      jobs ??
      createTagJobs({
        store,
        undoRoot: path.join(userDataDir, 'library-tag-undo'),
        storeArtwork: (bytes) => storeArtwork(userDataDir, bytes),
        announce,
        send: (state) =>
          getMainWindow()?.webContents.send('library-tags-job', state),
      });
    return jobs;
  };

  ipcMain.handle('library-tags-read', async (_event, rawIds: unknown) => {
    if (!Array.isArray(rawIds) || rawIds.length > MAX_READ_IDS) {
      return [];
    }
    const { readTrackTagSheet } = await loadEngine();
    return rawIds.map((rawId): TTagReadResult => {
      if (!isId(rawId)) {
        return { state: 'missing' };
      }
      const track = store.track(rawId);
      if (track === undefined) {
        return { state: 'missing' };
      }
      if (track.kind !== 'audio') {
        return { state: 'unsupported' };
      }
      return readTrackTagSheet(track.id, track.path);
    });
  });

  ipcMain.handle('library-tags-write', async (_event, rawRequest: unknown) => {
    const { guardTagWriteRequest } = await loadEngine();
    const request = guardTagWriteRequest(rawRequest, store.track);
    if (request === undefined) {
      return undefined;
    }
    return (await loadJobs()).start(request.items, request.heldTrackIds);
  });

  // Answers for a job only exist once a job does, so these never load the
  // engine themselves.
  ipcMain.handle('library-tags-cancel', (_event, rawJobId: unknown) => {
    if (isId(rawJobId)) {
      jobs?.cancel(rawJobId);
    }
  });

  ipcMain.handle(
    'library-tags-answer',
    (_event, rawJobId: unknown, rawTrackId: unknown, rawAnswer: unknown) => {
      const answer = ANSWERS.find((candidate) => candidate === rawAnswer);
      if (isId(rawJobId) && isId(rawTrackId) && answer !== undefined) {
        jobs?.answer(rawJobId, rawTrackId, answer);
      }
    },
  );

  ipcMain.handle(
    'library-tags-release',
    (_event, rawJobId: unknown, rawTrackId: unknown) => {
      if (isId(rawJobId) && isId(rawTrackId)) {
        jobs?.release(rawJobId, rawTrackId);
      }
    },
  );

  ipcMain.handle('library-tags-undo', (_event, rawJobId: unknown) =>
    isId(rawJobId) ? jobs?.undo(rawJobId) : undefined,
  );

  // What the songs' album folders hold for Fix tags: a CUE sheet and a
  // picture. Folders are found from the songs, one read each, in turn.
  ipcMain.handle(
    'library-tags-folder-facts',
    async (_event, rawIds: unknown): Promise<ITagFolderFacts[]> => {
      if (!Array.isArray(rawIds) || rawIds.length > MAX_FOLDER_IDS) {
        return [];
      }
      const folders = new Set<string>();
      rawIds.forEach((rawId) => {
        const track = isId(rawId) ? store.track(rawId) : undefined;
        if (track?.kind === 'audio') {
          folders.add(path.dirname(track.path));
        }
      });
      // One folder at a time: a folder of a hundred albums is a hundred
      // listings one after another, not a hundred at once.
      return [...folders].reduce<Promise<ITagFolderFacts[]>>(
        async (done, folder) => [
          ...(await done),
          await readFolderFacts(folder),
        ],
        Promise.resolve([]),
      );
    },
  );

  ipcMain.handle(
    'library-tags-folder-cover',
    async (_event, rawTrackId: unknown): Promise<TTagCoverPick> => {
      const track = isId(rawTrackId) ? store.track(rawTrackId) : undefined;
      return track
        ? readFolderCover(path.dirname(track.path))
        : { state: 'refused' };
    },
  );

  // Choose… for a cover opens in the song's own folder, where an album's
  // folder.jpg or front.jpg already sits (Ivan, 2026-11-16: "make sure this
  // explorer opens on the album folder"). A file input cannot be told where
  // to start, so the dialog is main's, and main reads the file it returns.
  ipcMain.handle(
    'library-tags-cover-pick',
    async (_event, rawTrackId: unknown): Promise<TTagCoverPick> => {
      const track = isId(rawTrackId) ? store.track(rawTrackId) : undefined;
      const window = getMainWindow();
      const options: OpenDialogOptions = {
        defaultPath: track ? path.dirname(track.path) : undefined,
        properties: ['openFile'],
        filters: [
          {
            name: mainText('files.type.pictures'),
            extensions: ['jpg', 'jpeg', 'png'],
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
        const { size } = await fs.promises.stat(file);
        if (size === 0 || size > MAX_COVER_BYTES) {
          return { state: 'refused' };
        }
        return {
          state: 'ok',
          bytes: new Uint8Array(await fs.promises.readFile(file)),
        };
      } catch (error) {
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; the window says the picture could not be used
        console.error(`Could not read the picked cover ${file}`, error);
        return { state: 'refused' };
      }
    },
  );
};
