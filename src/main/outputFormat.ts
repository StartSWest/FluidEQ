/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One output's shared-mode format: read, set to 7.1 for the Room, put back.
 *
 * Windows sends a game's or a film's surround channels only to an output
 * whose format has that many, so the Room on a headphone output is the front
 * stage until the output is a 7.1 one. `windows-audio-format.ps1` does the
 * asking and the setting through the interface Sound settings itself uses,
 * with no administrator; this remembers what the output was before, per
 * output, in the app's data folder, so Undo puts back exactly that and not a
 * guess at "stereo".
 */

import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import log from 'electron-log';
import { POWERSHELL_PATH } from './powershell';

const execFileAsync = promisify(execFile);

export interface IOutputFormat {
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  /** Whether the driver takes a 7.1 format; null when it would not say. */
  takesEightChannels: boolean | null;
  /** Whether a format from before a press is remembered for Undo. */
  restorable: boolean;
}

export interface IOutputFormatChange {
  ok: boolean;
  channels?: number;
  error?: string;
}

const MEMORY_FILE = 'output-formats.json';

/** Runs the script and answers its one JSON object. */
export type TRunFormatScript = (
  args: string[],
) => Promise<Record<string, unknown>>;

const scriptPath = (): string => {
  const packaged = path.join(
    process.resourcesPath,
    'assets',
    'windows-audio-format.ps1',
  );
  const development = path.join(
    __dirname,
    '../../assets/windows-audio-format.ps1',
  );
  return fs.existsSync(packaged) ? packaged : development;
};

export const runFormatScript: TRunFormatScript = async (args) => {
  const { stdout } = await execFileAsync(
    POWERSHELL_PATH,
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath(),
      ...args,
    ],
    { windowsHide: true, timeout: 20000, maxBuffer: 1024 * 1024 },
  );
  const parsed: unknown = JSON.parse(stdout.trim());
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('the format script answered with something not an object');
  }
  return parsed as Record<string, unknown>;
};

type TMemory = Record<string, { previous: string; at: string }>;

const readMemory = (userDataDir: string): TMemory => {
  try {
    const parsed: unknown = JSON.parse(
      fs.readFileSync(path.join(userDataDir, MEMORY_FILE), 'utf8'),
    );
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as TMemory)
      : {};
  } catch {
    return {};
  }
};

const writeMemory = (userDataDir: string, memory: TMemory): void => {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(
    path.join(userDataDir, MEMORY_FILE),
    JSON.stringify(memory, null, 2),
  );
};

const numberOf = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

export const createOutputFormats = (
  userDataDir: string,
  run: TRunFormatScript = runFormatScript,
) => ({
  read: async (deviceId: string): Promise<IOutputFormat> => {
    const answer = await run(['-DeviceId', deviceId]);
    if (answer.ok !== true) {
      throw new Error(
        String(answer.error ?? 'the output format could not be read'),
      );
    }
    return {
      channels: numberOf(answer.channels),
      sampleRate: numberOf(answer.sampleRate),
      bitsPerSample: numberOf(answer.bitsPerSample),
      takesEightChannels:
        typeof answer.takesEightChannels === 'boolean'
          ? answer.takesEightChannels
          : null,
      restorable: deviceId in readMemory(userDataDir),
    };
  },

  /** Sets the output to 7.1, remembering what it was for Undo. */
  setSevenOne: async (deviceId: string): Promise<IOutputFormatChange> => {
    const answer = await run(['-DeviceId', deviceId, '-SetChannels', '8']);
    if (answer.ok !== true) {
      const error = String(answer.error ?? 'Windows did not take the format');
      log.warn(`Output ${deviceId} could not be set to 7.1: ${error}`);
      return { ok: false, error };
    }
    if (typeof answer.previous === 'string' && answer.previous) {
      const memory = readMemory(userDataDir);
      // The first press's "before" is the one Undo returns to: a second
      // press after an Undo remembers again, a second press without one
      // keeps the original.
      if (!(deviceId in memory)) {
        memory[deviceId] = {
          previous: answer.previous,
          at: new Date().toISOString(),
        };
        writeMemory(userDataDir, memory);
      }
    }
    const channels = numberOf(answer.channels);
    log.info(
      `Output ${deviceId} set to 7.1 for the Room (now ${channels} channels; the previous format is kept for Undo)`,
    );
    return { ok: true, channels };
  },

  /** Puts back what the output was before the press. */
  restore: async (deviceId: string): Promise<IOutputFormatChange> => {
    const memory = readMemory(userDataDir);
    const remembered = memory[deviceId];
    if (!remembered) {
      return { ok: false, error: 'nothing remembered for this output' };
    }
    const answer = await run([
      '-DeviceId',
      deviceId,
      '-Restore',
      remembered.previous,
    ]);
    if (answer.ok !== true) {
      const error = String(answer.error ?? 'Windows did not take the format');
      log.warn(`Output ${deviceId} could not be put back: ${error}`);
      return { ok: false, error };
    }
    delete memory[deviceId];
    writeMemory(userDataDir, memory);
    const channels = numberOf(answer.channels);
    log.info(`Output ${deviceId} put back to ${channels} channels`);
    return { ok: true, channels };
  },
});

export type TOutputFormats = ReturnType<typeof createOutputFormats>;
