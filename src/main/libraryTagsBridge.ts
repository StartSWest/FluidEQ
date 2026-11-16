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

import { ipcRenderer, IpcRendererEvent } from 'electron';
import type {
  ITagJobState,
  ITagWriteRequest,
  TTagCoverPick,
  TTagItemAnswer,
  TTagReadResult,
} from '../common/library/tagFields';

/**
 * The Library tag editor's calls (`ipc/libraryTagsIpc.ts`): read songs'
 * tags, start a write, answer for the files that refuse, and Undo. Songs
 * are named by id; main finds and checks everything else.
 */

/** Up to fifty songs' tags, in the order asked. */
const readLibraryTags = (trackIds: readonly string[]) =>
  ipcRenderer.invoke('library-tags-read', trackIds) as Promise<
    TTagReadResult[]
  >;

/** Starts a write; answers its job id, or `undefined` when main refused the
 * request as a whole. Progress arrives through `onLibraryTagJob`. */
const writeLibraryTags = (request: ITagWriteRequest) =>
  ipcRenderer.invoke('library-tags-write', request) as Promise<
    string | undefined
  >;

const cancelLibraryTagJob = (jobId: string) =>
  ipcRenderer.invoke('library-tags-cancel', jobId) as Promise<void>;

/** Retry, Skip or Make writable, for a file another program holds or a
 * read-only one. */
const answerLibraryTagItem = (
  jobId: string,
  trackId: string,
  answer: TTagItemAnswer,
) =>
  ipcRenderer.invoke(
    'library-tags-answer',
    jobId,
    trackId,
    answer,
  ) as Promise<void>;

/** The song that was playing has ended: its file can be written now. */
const releaseLibraryTagItem = (jobId: string, trackId: string) =>
  ipcRenderer.invoke('library-tags-release', jobId, trackId) as Promise<void>;

/** Puts back every file the job wrote; answers the undo's own job id. */
const undoLibraryTagJob = (jobId: string) =>
  ipcRenderer.invoke('library-tags-undo', jobId) as Promise<string | undefined>;

/** The system's file dialog for a cover, opened in the song's folder. */
const pickLibraryTagCover = (trackId: string | undefined) =>
  ipcRenderer.invoke(
    'library-tags-cover-pick',
    trackId,
  ) as Promise<TTagCoverPick>;

const onLibraryTagJob = (listener: (state: ITagJobState) => void) => {
  const wrapped = (_event: IpcRendererEvent, state: ITagJobState) =>
    listener(state);
  ipcRenderer.on('library-tags-job', wrapped);
  return () => {
    ipcRenderer.removeListener('library-tags-job', wrapped);
  };
};

const libraryTagsBridge = {
  readLibraryTags,
  writeLibraryTags,
  cancelLibraryTagJob,
  answerLibraryTagItem,
  releaseLibraryTagItem,
  undoLibraryTagJob,
  pickLibraryTagCover,
  onLibraryTagJob,
};

export default libraryTagsBridge;
