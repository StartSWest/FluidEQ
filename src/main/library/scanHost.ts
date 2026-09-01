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
 * Runs a root's scan in a `utilityProcess` and reports it back as if it had
 * happened here.
 *
 * The signature deliberately matches `scanLibraryRoot`'s, so `ipc/library.ts`
 * calls one or the other without knowing which — and so the in-process path
 * stays a real fallback rather than dead code. It is used whenever the worker
 * bundle cannot be found or the process fails to start: a library that scans
 * slowly is a far better outcome than one that cannot scan at all because a
 * build step did not run.
 */

import fs from 'fs';
import path from 'path';
import { app, utilityProcess } from 'electron';
import { IScanOptions, IScanResult, scanLibraryRoot } from './libraryScanner';
import { IScanWorkerRequest, IScanWorkerResponse } from './scanWorkerProtocol';

/**
 * Where the worker bundle lands in each build.
 *
 * Packaged, it sits beside `main.js` in `dist/main`. In development main runs
 * from source through `ts-node`, and the bundle webpack writes for it goes to
 * `.erb/dll` alongside the preload bridge — the same split, and the same
 * reason, as `mainWindow.ts`'s own preload path.
 */
const workerEntry = (): string | undefined => {
  // `app` and `utilityProcess` are absent anywhere this module is loaded
  // outside a real Electron main process — the IPC tests being the case that
  // found this. Falling through to the in-process scan there is the right
  // answer rather than a mock: the behaviour under test is what the scan
  // produces, not which process produced it.
  if (typeof app?.isPackaged !== 'boolean' || !utilityProcess) {
    return undefined;
  }
  const candidates = app.isPackaged
    ? [path.join(__dirname, 'library-scan-worker.js')]
    : [
        path.join(__dirname, '../../.erb/dll/library-scan-worker.js'),
        path.join(__dirname, 'library-scan-worker.js'),
      ];
  return candidates.find((candidate) => fs.existsSync(candidate));
};

/**
 * True once a scan has already fallen back, so a machine where the worker
 * cannot start does not pay the spawn attempt — and its console.error — on
 * every root of every rescan.
 */
let workerUnavailable = false;

export const scanLibraryRootOffThread = (
  options: IScanOptions,
): Promise<IScanResult> => {
  const entry = workerUnavailable ? undefined : workerEntry();
  if (!entry) {
    return scanLibraryRoot(options);
  }
  return new Promise<IScanResult>((resolve) => {
    let settled = false;
    let fallbackStarted = false;
    const finish = (result: IScanResult) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    let child: ReturnType<typeof utilityProcess.fork>;
    try {
      /**
       * Written for a human reading a process list, not for a grep.
       *
       * Chromium reports this name in its own process listing and in a crash
       * report. Windows Task Manager cannot use it — every Electron child is
       * the same binary and they all share one file description — so the way
       * to tell them apart there is the Details tab's Command line column,
       * where this one arrives as `--utility-sub-type`. The DSP host is the
       * one process in the tree that IS a separate binary, and it names
       * itself: see `OUTPUT_NAME` in `native/CMakeLists.txt`.
       */
      child = utilityProcess.fork(entry, [], {
        serviceName: 'FluidEQ Library Scan',
      });
    } catch (error) {
      workerUnavailable = true;
      // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
      console.error(
        'Could not start the library scan worker; scanning in-process instead',
        error,
      );
      scanLibraryRoot(options).then(finish, () =>
        finish({
          tracks: options.known.slice(),
          karaokeSkipped: 0,
          wasCancelled: true,
        }),
      );
      return;
    }

    // The worker cannot be asked to stop through a return value, so the
    // caller's own `isCancelled` is forwarded as a message. Checked against
    // the worker's own traffic rather than on a timer: it reports every file
    // it touches, so the cancel goes out on the next one — and a scan that
    // has stopped reporting has nothing left to cancel.
    let cancelSent = false;
    const forwardCancel = () => {
      if (cancelSent || !options.isCancelled()) {
        return;
      }
      cancelSent = true;
      const cancel: IScanWorkerRequest = { type: 'cancel' };
      child.postMessage(cancel);
    };

    const stop = () => {
      child.kill();
    };

    /**
     * A utility process that started is not necessarily a worker that worked.
     *
     * The packaged worker once launched with no message listener because it
     * read the wrong `parentPort`. It then exited normally, and the old exit
     * handler returned the known tracks — an empty array for a newly-added
     * root — so the folder picker looked broken even though it had added the
     * folder correctly. Any worker failure now takes the proven in-process
     * path instead. The flag keeps an error followed by an exit from starting
     * two scans of the same root.
     */
    const fallBackToMain = (message: string, error?: unknown) => {
      if (settled || fallbackStarted) {
        return;
      }
      fallbackStarted = true;
      workerUnavailable = true;
      // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
      console.error(message, error);
      stop();
      scanLibraryRoot(options).then(finish, () =>
        finish({
          tracks: options.known.slice(),
          karaokeSkipped: 0,
          wasCancelled: true,
        }),
      );
    };

    child.on('message', (raw: unknown) => {
      if (fallbackStarted) {
        return;
      }
      forwardCancel();
      if (typeof raw !== 'object' || raw === null || !('type' in raw)) {
        return;
      }
      const message = raw as IScanWorkerResponse;
      if (message.type === 'progress') {
        options.onProgress(message.progress);
        return;
      }
      if (message.type === 'tracks') {
        options.onTracks?.(message.tracks);
        return;
      }
      if (message.type === 'done') {
        stop();
        finish({
          tracks: message.tracks,
          karaokeSkipped: message.karaokeSkipped,
          wasCancelled: message.wasCancelled,
        });
        return;
      }
      // `failed`: the worker caught something it could not carry on from.
      fallBackToMain(`Library scan worker failed: ${message.message}`);
    });

    // A worker that dies without saying `done` must not leave the scan
    // pending forever — the renderer derives `isScanning` from the terminal
    // progress event, so a promise that never settles pins the strip on.
    child.on('exit', () => {
      fallBackToMain(
        'Library scan worker exited before finishing; scanning in-process instead',
      );
    });

    const request: IScanWorkerRequest = {
      type: 'scan',
      rootId: options.rootId,
      rootPath: options.rootPath,
      userDataDir: options.userDataDir,
      known: options.known.slice(),
    };
    child.postMessage(request);
  });
};
