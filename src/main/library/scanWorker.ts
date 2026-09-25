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
import type { ILibraryTrack } from '../../common/library/types';
import {
  IScanWorkerRequest,
  IScanWorkerResponse,
  postToHost,
  onHostMessage,
} from './scanWorkerProtocol';
import { scanLibraryRoot, type IKnownTrack } from './libraryScanner';
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

/**
 * The result as the host needs it back: the tracks this walk read, and every
 * known one it carried forward named by its place in the request.
 *
 * The host sent only the few fields a walk reads (`IKnownTrack`) and keeps
 * the tracks themselves, so a place is all it needs to put its own object
 * back — and getting its own object back is how it sees that nothing changed.
 * Sent whole, the result was the whole root cloned into main again after
 * every scan: 45-180 ms of V8 deserialising on main for fourteen thousand
 * tracks (measured on a synthetic root; the high end is tracks carrying noise
 * profiles), almost all of it for tracks that had not moved.
 */
const encodeResult = (
  tracks: ReadonlyArray<ILibraryTrack | IKnownTrack>,
  known: readonly IKnownTrack[],
): { tracks: ILibraryTrack[]; knownAt: number[] } => {
  const placeOf = new Map<IKnownTrack, number>(
    known.map((track, place) => [track, place]),
  );
  // Anything the walk returns that it was not given, it built.
  const isRead = (track: ILibraryTrack | IKnownTrack): track is ILibraryTrack =>
    !placeOf.has(track);
  return {
    tracks: tracks.filter(isRead),
    knownAt: tracks.map((track) => placeOf.get(track) ?? -1),
  };
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
  const { known } = message;
  const gate = gateScanProgress((progress) =>
    send({ type: 'progress', progress }),
  );
  scanLibraryRoot({
    rootId: message.rootId,
    rootPath: message.rootPath,
    userDataDir: message.userDataDir,
    known,
    storeArtwork: storeArtworkInHost,
    onProgress: gate.progress,
    onTracks: (tracks) => {
      send({ type: 'tracks', tracks });
      gate.tracksSent();
    },
    isCancelled: () => cancelRequested,
  })
    .then((result) =>
      send({
        type: 'done',
        ...encodeResult(result.tracks, known),
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
