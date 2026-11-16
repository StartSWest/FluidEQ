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

import { BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import type {
  TTagItemAnswer,
  TTagReadResult,
} from '../../common/library/tagFields';
import type { ILibraryStore } from '../library/libraryStore';
import { storeArtwork } from '../library/libraryArtwork';
import type { ITagJobs } from '../library/tagJobs';

/** Songs one read may ask for; the window reads a folder in pages. */
const MAX_READ_IDS = 50;

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
};
