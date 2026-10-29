/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { app, net } from 'electron';
import { execFile } from 'child_process';
import fs from 'fs';
import { promisify } from 'util';
import { appVersion } from './appVersion';
import type { IMacSelfUpdateDeps } from './macSelfUpdate';

const execFileAsync = promisify(execFile);

/**
 * The Mac updater's hands: Electron's network stack (which follows GitHub's
 * redirect to its file host), the disk, and three system tools. Kept apart so
 * `macSelfUpdate.ts` can be tested without any of them.
 */
const macSelfUpdateDeps = (
  rest: Pick<
    IMacSelfUpdateDeps,
    'logger' | 'sendStatus' | 'onManualCheckResult' | 'beforeQuit'
  >,
): IMacSelfUpdateDeps => ({
  ...rest,
  executablePath: process.execPath,
  currentVersion: appVersion(),
  isPackaged: app.isPackaged,
  platform: process.platform,
  arch: process.arch,
  fetchText: async (url) => {
    const response = await net.fetch(url);
    if (!response.ok) {
      throw new Error(`${url} answered ${response.status}`);
    }
    return response.text();
  },
  download: async (url, file, onBytes) => {
    const response = await net.fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`${url} answered ${response.status}`);
    }
    const length = Number(response.headers.get('content-length'));
    const total = Number.isFinite(length) && length > 0 ? length : undefined;
    // Each chunk is written before the next is read: no `pipeline`, which
    // crashes Node's HTTP parser when the disk is slower than the socket
    // (CLAUDE.md), and no 200 MB held in memory either.
    const handle = await fs.promises.open(file, 'w');
    try {
      const reader = response.body.getReader();
      let received = 0;
      for (;;) {
        // eslint-disable-next-line no-await-in-loop -- one chunk at a time is the point
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        // eslint-disable-next-line no-await-in-loop -- written before the next is read
        await handle.write(value);
        received += value.byteLength;
        onBytes(received, total);
      }
    } finally {
      await handle.close();
    }
  },
  run: async (file, args) => (await execFileAsync(file, [...args])).stdout,
  canWrite: (target) =>
    fs.promises.access(target, fs.constants.W_OK).then(
      () => true,
      () => false,
    ),
  onQuit: (listener) => app.once('quit', listener),
  relaunch: () => app.relaunch(),
  quit: () => app.quit(),
});

export default macSelfUpdateDeps;
