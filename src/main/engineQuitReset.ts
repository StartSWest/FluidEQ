/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * Nothing FluidEQ set stays on any output once FluidEQ has quit.
 *
 * Both engines run inside Windows' own audio service and go on applying
 * whatever they last read, so the EQ used to outlive the app: quit FluidEQ and
 * every output kept its bands, its preamp and its DSP rack, with no window left
 * to take them off. Now a quit gives the engine in use the root that means
 * "nothing to do" and takes away its rack file — the same two things a switch
 * does to the engine being left — and the next launch writes the saved EQ
 * back, because the startup read finds no `Device:` block in that root to
 * adopt over the saved state.
 *
 * Only the engine in use: the other one was put to sleep when it was switched
 * away from (`engineNeutralise.ts`), and nothing has written to it since.
 *
 * Two entry points, because Windows ends a session differently from a quit.
 * Electron emits no `before-quit` when Windows shuts down or logs off — only
 * the window's `session-end`, after which the process can be ended at any
 * moment — so that path does its two file operations synchronously and at
 * once. A crash or End Task reaches neither, and the EQ stays until FluidEQ
 * next opens and writes it again.
 */

import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import {
  FLUID_ENGINE_DSP_FILENAME,
  FLUID_ENGINE_PROGRAMME_FILENAME,
} from '../common/audioEngine';
import { flushPendingWrites, sealDirectory, writeFileNow } from './asyncWriter';
import { DISABLED_ROOT_TEXT } from './deviceProfiles';
import { FLUIDEQ_CONFIG_FILENAME } from './flush';

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const rootPath = (configDirPath: string) =>
  path.join(configDirPath, FLUIDEQ_CONFIG_FILENAME);

/**
 * Only the FluidEQ Engine reads a rack, and it reads it outside every
 * `Device:` guard, so the neutral root alone would leave the maximizer and
 * the rest of the rack running. A missing rack file is read as no rack.
 */
const rackPath = (configDirPath: string) =>
  path.join(configDirPath, FLUID_ENGINE_DSP_FILENAME);

/**
 * Which song was playing. The engine ignores it without FluidEQ running, so
 * this is tidiness rather than safety: a song identity from a closed app has
 * nothing left to describe.
 */
const programmePath = (configDirPath: string) =>
  path.join(configDirPath, FLUID_ENGINE_PROGRAMME_FILENAME);

/**
 * For a quit from inside the app: the tray's Quit, an update restarting it.
 *
 * Seal, then drain, then write. A write asked for after the seal is refused,
 * and one already on its way lands before the reset rather than after it —
 * the order the other way round is an EQ that comes back a moment after it
 * was taken off, on an output nobody is left to fix.
 */
export const resetEngineForQuit = async (
  configDirPath: string,
): Promise<void> => {
  sealDirectory(configDirPath);
  // A write that failed is the reset's business only if the reset fails too.
  await flushPendingWrites().catch(() => undefined);
  try {
    await writeFileNow(rootPath(configDirPath), DISABLED_ROOT_TEXT);
  } catch (error) {
    log.error(
      `Could not turn the audio engine off in ${configDirPath} on quit: ${describe(
        error,
      )}`,
    );
  }
  try {
    await fs.promises.rm(rackPath(configDirPath), { force: true });
  } catch (error) {
    log.error(
      `Could not remove the DSP rack from ${configDirPath} on quit: ${describe(
        error,
      )}`,
    );
  }
  try {
    await fs.promises.rm(programmePath(configDirPath), { force: true });
  } catch (error) {
    log.error(
      `Could not remove the playing song from ${configDirPath} on quit: ${describe(
        error,
      )}`,
    );
  }
};

/**
 * For Windows shutting down or logging off, where nothing asynchronous can be
 * waited for. A write already in flight at that instant can still land after
 * this one; everything asked for later is refused by the seal.
 */
export const resetEngineAtSessionEnd = (configDirPath: string): void => {
  sealDirectory(configDirPath);
  try {
    fs.writeFileSync(rootPath(configDirPath), DISABLED_ROOT_TEXT, 'utf8');
  } catch (error) {
    log.error(
      `Could not turn the audio engine off in ${configDirPath} at session end: ${describe(
        error,
      )}`,
    );
  }
  try {
    fs.rmSync(rackPath(configDirPath), { force: true });
  } catch (error) {
    log.error(
      `Could not remove the DSP rack from ${configDirPath} at session end: ${describe(
        error,
      )}`,
    );
  }
  try {
    fs.rmSync(programmePath(configDirPath), { force: true });
  } catch (error) {
    log.error(
      `Could not remove the playing song from ${configDirPath} at session end: ${describe(
        error,
      )}`,
    );
  }
};
