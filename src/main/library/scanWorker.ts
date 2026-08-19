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
 * The scan, run somewhere that is not the main process.
 *
 * Reading fourteen thousand files' tags is minutes of `readFile` and parsing,
 * and on the main process every one of those is a slice taken from the thread
 * that also answers IPC. The window keeps rendering — that is its own
 * process — but everything it asks the app for waits behind the current file.
 *
 * This runs under Electron's `utilityProcess`, which is a Node environment and
 * NOT an Electron one: `nativeImage` does not exist here. Artwork therefore
 * comes back as raw bytes for the host to resize, and only for covers the
 * cache does not already hold — one per album rather than one per track, since
 * `artworkId` hashes the bytes and every track on a record carries the same
 * picture.
 */

import {
  IScanWorkerRequest,
  IScanWorkerResponse,
  postToHost,
  onHostMessage,
} from './scanWorkerProtocol';
import { scanLibraryRoot } from './libraryScanner';

let cancelRequested = false;

const send = (message: IScanWorkerResponse) => postToHost(message);

onHostMessage((message: IScanWorkerRequest) => {
  if (message.type === 'cancel') {
    cancelRequested = true;
    return;
  }
  if (message.type !== 'scan') {
    return;
  }
  cancelRequested = false;
  scanLibraryRoot({
    rootId: message.rootId,
    rootPath: message.rootPath,
    userDataDir: message.userDataDir,
    known: message.known,
    onProgress: (progress) => send({ type: 'progress', progress }),
    onTracks: (tracks) => send({ type: 'tracks', tracks }),
    isCancelled: () => cancelRequested,
  })
    .then((result) =>
      send({
        type: 'done',
        tracks: result.tracks,
        karaokeSkipped: result.karaokeSkipped,
        wasCancelled: result.wasCancelled,
      }),
    )
    .catch((error: unknown) => {
      // The host cannot see this process's stack otherwise, and a scan that
      // ends with nothing said is indistinguishable from one still running.
      send({ type: 'failed', message: String(error) });
    });
});
