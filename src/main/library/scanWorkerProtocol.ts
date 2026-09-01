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
  | { type: 'cancel' }
  | {
      /** Reply to one `store-artwork` request from the worker. */
      type: 'artwork-stored';
      requestId: number;
      artId?: string;
    };

export type IScanWorkerResponse =
  | { type: 'progress'; progress: ILibraryScanProgress }
  | { type: 'tracks'; tracks: readonly ILibraryTrack[] }
  | {
      type: 'done';
      tracks: ILibraryTrack[];
      karaokeSkipped: number;
      wasCancelled: boolean;
    }
  | {
      /**
       * Raw cover bytes for the Electron host to resize and cache. A utility
       * process is a Node environment and cannot call `nativeImage` itself.
       */
      type: 'store-artwork';
      requestId: number;
      bytes: Uint8Array;
    }
  | { type: 'failed'; message: string };

/**
 * `utilityProcess` gives the child a `parentPort` on Electron's extended
 * `process` object, which the type definitions shipped with `@types/node` know
 * nothing about. This used to read `globalThis.parentPort`; that property does
 * not exist in an Electron utility process, so the packaged worker registered
 * no listener, exited, and every folder scan completed with zero tracks.
 * Narrowed here once, with a real runtime check, rather than cast at every call
 * site.
 */
interface IParentPort {
  postMessage: (message: unknown) => void;
  on: (
    event: 'message',
    listener: (messageEvent: { data: unknown }) => void,
  ) => void;
}

const parentPort = (): IParentPort | undefined => {
  const candidate = (process as NodeJS.Process & { parentPort?: unknown })
    .parentPort;
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
  parentPort()?.on('message', (event) => {
    /**
     * `ParentPort` is a MessagePort, not a child-process IPC channel.
     *
     * Electron wraps every incoming value in a MessageEvent and puts the
     * structured-cloned request in `data`. Reading the event itself appeared
     * plausible because it is also an object, but it has no request `type`.
     * The worker therefore ignored every scan command and stayed alive
     * forever: the root was saved, no tracks appeared, no terminal progress
     * arrived, and no exit existed for the host's fallback to notice.
     */
    const raw = event.data;
    if (typeof raw === 'object' && raw !== null && 'type' in raw) {
      listener(raw as IScanWorkerRequest);
    }
  });
};
