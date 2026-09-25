/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { BrowserWindow } from 'electron';
import type {
  IScanOptions,
  IScanResult,
} from '../../../main/library/libraryScanner';

/**
 * Electron's `app`, as far as the launch rescan uses it: the emitter that
 * says a window was created. It has no `isPackaged`, so the scan runs
 * in-process, into the scripted walk below.
 */
const appEvents = new EventEmitter();
jest.mock('electron', () => ({
  app: appEvents,
  ipcMain: { handle: () => undefined, on: () => undefined },
  dialog: { showOpenDialog: jest.fn() },
  shell: { showItemInFolder: jest.fn() },
}));

/**
 * Called when the walk starts. The scanner is `import()`ed on first use
 * (`scanHost.ts`), so the walk begins a turn or two after the rescan is asked
 * for; the test waits for this rather than guessing how many.
 */
let onScanStarted: () => void = () => undefined;
const scanLibraryRoot = jest.fn<Promise<IScanResult>, [IScanOptions]>(
  async () => {
    onScanStarted();
    return { tracks: [], karaokeSkipped: 0, wasCancelled: false };
  },
);
jest.mock('../../../main/library/libraryScanner', () => ({
  scanLibraryRoot: (options: IScanOptions) => scanLibraryRoot(options),
}));

/* eslint-disable import/first -- the mocks above must be installed first */
import {
  libraryIndexSnapshot,
  registerLibraryIpc,
} from '../../../main/ipc/library';
import { writeLibraryIndexSoon } from '../../../main/library/libraryIndex';
/* eslint-enable import/first */

/** A window as far as the launch rescan looks at one: it can be shown. */
const windowNotYetShown = (): BrowserWindow =>
  Object.assign(new EventEmitter(), {
    isVisible: () => false,
    webContents: { send: () => undefined },
  }) as unknown as BrowserWindow;

describe('the launch rescan', () => {
  it('starts when the main window is first shown — not on a timer, and not for another window', async () => {
    const userDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'fluideq-launch-data-'),
    );
    const music = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-launch-'));
    await writeLibraryIndexSoon(userDataDir, () => ({
      version: 1,
      roots: [
        { id: 'r1', path: music, addedAt: 1, trackCount: 0, karaokeSkipped: 0 },
      ],
      tracks: [],
    }));

    // Registration runs before any window exists, as it does in `main.ts`.
    let mainWindow: BrowserWindow | null = null;
    registerLibraryIpc({ userDataDir, getMainWindow: () => mainWindow });
    const other = windowNotYetShown();
    const main = windowNotYetShown();
    appEvents.emit('browser-window-created', {}, other);
    appEvents.emit('browser-window-created', {}, main);
    // `main.ts` names its window before it shows it.
    mainWindow = main;

    // Another window shown first -- a video's, the wallpaper's -- starts
    // nothing. Waiting on the index is waiting on everything the rescan
    // would have queued behind it.
    other.emit('show');
    await libraryIndexSnapshot();
    expect(scanLibraryRoot).not.toHaveBeenCalled();
    // Still waiting for the main window: the other one was let go by.
    expect(appEvents.listenerCount('browser-window-created')).toBe(1);

    const started = new Promise<void>((resolve) => {
      onScanStarted = resolve;
    });
    main.emit('show');
    await started;
    expect(scanLibraryRoot).toHaveBeenCalledTimes(1);
    expect(scanLibraryRoot.mock.calls[0][0].rootPath).toBe(music);
    // Once for the life of the process: nothing is left listening.
    expect(appEvents.listenerCount('browser-window-created')).toBe(0);
  });
});
