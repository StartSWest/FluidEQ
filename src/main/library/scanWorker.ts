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

import crypto from 'crypto';
import {
  IScanWorkerRequest,
  IScanWorkerResponse,
  postToHost,
  onHostMessage,
} from './scanWorkerProtocol';
import { scanLibraryRoot } from './libraryScanner';
import { openLibraryReader } from './libraryStoreOpen';
import { gateScanProgress } from './scanProgressGate';

let cancelRequested = false;
let nextArtworkRequestId = 0;
const artworkReplies = new Map<number, (artId: string | undefined) => void>();
const artworkRequestsByHash = new Map<string, Promise<string | undefined>>();

const send = (message: IScanWorkerResponse) => postToHost(message);

/**
 * Asks the Electron host to do the one part of scanning this Node-only process
 * cannot: decode, resize and cache an image with `nativeImage`.
 */
const storeArtworkInHost = (bytes: Uint8Array): Promise<string | undefined> => {
  // One album can repeat the same embedded picture on every track. Hashing in
  // the worker keeps that from structured-cloning the same megabytes over IPC
  // a dozen times; the host still owns the actual cache and image decode.
  const hash = crypto.createHash('sha1').update(bytes).digest('hex');
  const pending = artworkRequestsByHash.get(hash);
  if (pending) {
    return pending;
  }
  nextArtworkRequestId += 1;
  const requestId = nextArtworkRequestId;
  const request = new Promise<string | undefined>((resolve) => {
    artworkReplies.set(requestId, resolve);
    send({ type: 'store-artwork', requestId, bytes });
  });
  artworkRequestsByHash.set(hash, request);
  return request;
};

onHostMessage((message: IScanWorkerRequest) => {
  if (message.type === 'artwork-stored') {
    const resolve = artworkReplies.get(message.requestId);
    if (resolve) {
      artworkReplies.delete(message.requestId);
      resolve(message.artId);
    }
    return;
  }
  if (message.type === 'cancel') {
    cancelRequested = true;
    return;
  }
  if (message.type !== 'scan') {
    return;
  }
  cancelRequested = false;
  // What the library already holds is asked of the store one path at a time,
  // over a read-only connection main's writes do not block (WAL). A store
  // that will not open here is reported as a failure, which puts the host on
  // its in-process path with main's own connection — never scanned as if
  // the library were empty, which would re-read every file and reset the day
  // each song was added.
  let reader: ReturnType<typeof openLibraryReader>;
  try {
    reader = openLibraryReader(message.userDataDir);
  } catch (error) {
    send({
      type: 'failed',
      message: `Could not open the library store: ${String(error)}`,
    });
    return;
  }
  // Only the reports worth a message go to the host (`scanProgressGate.ts`):
  // the walk reports every file, which was a message per file both ways.
  const gate = gateScanProgress((progress) =>
    send({ type: 'progress', progress }),
  );
  scanLibraryRoot({
    rootId: message.rootId,
    rootPath: message.rootPath,
    userDataDir: message.userDataDir,
    lookupKnown: reader.trackByPath,
    force: message.force,
    storeArtwork: storeArtworkInHost,
    onProgress: gate.progress,
    onTracks: (tracks, confirmed) => {
      send({ type: 'tracks', tracks, confirmed });
      gate.tracksSent();
    },
    onUnchanged: (ids) => send({ type: 'unchanged', ids }),
    isCancelled: () => cancelRequested,
  })
    .then((result) =>
      send({
        type: 'done',
        found: result.found,
        karaokeSkipped: result.karaokeSkipped,
        wasCancelled: result.wasCancelled,
      }),
    )
    .catch((error: unknown) => {
      // The host cannot see this process's stack otherwise, and a scan that
      // ends with nothing said is indistinguishable from one still running.
      send({ type: 'failed', message: String(error) });
    })
    .finally(() => reader.close());
});
