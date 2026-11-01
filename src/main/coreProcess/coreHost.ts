/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where the core's sound services run: in their own process when its bundle
 * is there to start, and in main otherwise (`coreClient.ts`).
 *
 * The bundle is found the way the library scan's worker is (`scanHost.ts`):
 * beside `main.js` when packaged, and in `.erb/dll` in development, where
 * the preload builder writes it — and found as each core starts. A test,
 * anywhere Electron's `utilityProcess` is absent, and a platform with no way
 * to hear the output get the services in main: the same code, and the
 * behaviour under test is what they do, not which process does it.
 */
import { app, utilityProcess } from 'electron';
import fs from 'fs';
import path from 'path';
import type { ICoreLog } from '../../core/coreLog';
import { createPlatformSystemSoundSource } from '../../core/platform/systemSoundSource';
import { createCoreServices } from '../../core/process/coreServices';
import {
  createLocalCoreClient,
  createProcessCoreClient,
  type ICoreChild,
  type ICoreClient,
} from './coreClient';

/** How much of a dying core's last words is kept for the log. */
const STDERR_TAIL_CHARS = 2000;

/** Whether this is a real Electron main process that can start one. */
const canStartProcesses = () =>
  typeof app?.isPackaged === 'boolean' && Boolean(utilityProcess);

/**
 * Looked for each time a core starts, never once at launch: in development
 * the bundle is written by the preload builder while main is starting, and a
 * launch that looked first and found nothing ran the core inside main for the
 * whole session.
 */
const coreEntry = (): string | undefined => {
  const candidates = app.isPackaged
    ? [path.join(__dirname, 'core-process.js')]
    : [
        path.join(__dirname, '../../../.erb/dll/core-process.js'),
        path.join(__dirname, 'core-process.js'),
      ];
  return candidates.find((candidate) => fs.existsSync(candidate));
};

const forkCore = (nativeDirs: readonly string[], log: ICoreLog): ICoreChild => {
  const entry = coreEntry();
  if (!entry) {
    throw new Error('the core-process bundle is not built');
  }
  const child = utilityProcess.fork(
    entry,
    nativeDirs.map((dir) => `--native-dir=${dir}`),
    { serviceName: 'FluidEQ Core', stdio: ['ignore', 'ignore', 'pipe'] },
  );
  // What it said on the way out, for the log: a core that throws prints its
  // stack here and nowhere else.
  let said = '';
  child.stderr?.on('data', (chunk: Buffer | string) => {
    said = `${said}${chunk.toString()}`.slice(-STDERR_TAIL_CHARS);
  });
  child.on('exit', (code) => {
    if (code !== 0 && said.trim()) {
      log.warn(`The core's last words: ${said.trim()}`);
    }
  });
  return child;
};

const createCoreClient = ({
  nativeDirs,
  applyTrim,
  log,
}: {
  nativeDirs: string[];
  applyTrim: (trimDb: number) => Promise<boolean>;
  log: ICoreLog;
}): ICoreClient => {
  // A platform with no way to hear the output (no helper built, or none
  // written for it yet) starts no process only to say so: in main the answer
  // is immediate, and the window hears the output itself, as it always has.
  const source = createPlatformSystemSoundSource({ nativeDirs, log });
  if (!canStartProcesses() || !source) {
    return createLocalCoreClient(
      createCoreServices({ source, log, applyTrim }),
    );
  }
  return createProcessCoreClient({
    fork: () => forkCore(nativeDirs, log),
    applyTrim,
    log,
  });
};

export default createCoreClient;
