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
 * What the scan host and the scan worker say to each other.
 *
 * Kept in its own module so both ends compile against the same shapes rather
 * than a pair of hand-written casts that agree today and drift apart on the
 * next change. Nothing here imports Electron: the worker runs in a plain Node
 * environment where none of it exists.
 */

import {
  ILibraryScanProgress,
  ILibraryTrack,
} from '../../common/library/types';

export type IScanWorkerRequest =
  | {
      type: 'scan';
      rootId: string;
      rootPath: string;
      userDataDir: string;
      known: ILibraryTrack[];
    }
  | { type: 'cancel' };

export type IScanWorkerResponse =
  | { type: 'progress'; progress: ILibraryScanProgress }
  | { type: 'tracks'; tracks: readonly ILibraryTrack[] }
  | {
      type: 'done';
      tracks: ILibraryTrack[];
      karaokeSkipped: number;
      wasCancelled: boolean;
    }
  | { type: 'failed'; message: string };

/**
 * `utilityProcess` gives the child a `parentPort` on the Node global, which
 * the type definitions shipped with `@types/node` know nothing about — it is
 * Electron's own addition. Narrowed here once, with a real runtime check,
 * rather than cast at every call site.
 */
interface IParentPort {
  postMessage: (message: unknown) => void;
  on: (event: 'message', listener: (message: unknown) => void) => void;
}

const parentPort = (): IParentPort | undefined => {
  const candidate = (globalThis as { parentPort?: unknown }).parentPort;
  if (
    typeof candidate === 'object' &&
    candidate !== null &&
    'postMessage' in candidate &&
    typeof (candidate as IParentPort).postMessage === 'function'
  ) {
    return candidate as IParentPort;
  }
  return undefined;
};

export const postToHost = (message: IScanWorkerResponse): void => {
  parentPort()?.postMessage(message);
};

export const onHostMessage = (
  listener: (message: IScanWorkerRequest) => void,
): void => {
  parentPort()?.on('message', (raw) => {
    // Structured-clone delivers the object as sent, but this is still a
    // message crossing a process boundary: narrow before trusting it.
    if (typeof raw === 'object' && raw !== null && 'type' in raw) {
      listener(raw as IScanWorkerRequest);
    }
  });
};
