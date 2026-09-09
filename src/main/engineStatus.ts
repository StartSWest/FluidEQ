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
 * "Is either engine usable, and on which outputs" — the one read-only
 * question the app asks before showing the engine dialog or a blocking
 * error banner.
 *
 * The FluidEQ Engine's half of the answer comes from running the setup
 * helper's `status` command, which the helper itself guarantees never
 * elevates (see `main.cpp`'s `print_status`). Equalizer APO's half comes
 * from the registry probe in `registry.ts`. Neither probe is run unless the
 * caller can actually act on the answer — see `readAudioEngineStatus`.
 */

import { execFile } from 'child_process';
import os from 'os';
import log from 'electron-log';
import {
  IAudioEngineStatus,
  IFluidEngineEndpoint,
  IFluidEngineStatus,
  TAudioEngine,
} from '../common/audioEngine';
import { isEqualizerAPOInstalled } from './registry';
import { getEngineSetupPath } from './engineSetup';

/**
 * Windows 10 build 17134 (version 1803, "April 2018 Update") is the first to
 * carry the System APO plumbing (`AudioProcessingObjects`,
 * `DisableProtectedAudioDG`) the FluidEQ Engine registers itself under.
 * Anything older can install the DLL but Windows will never load it, which
 * would report as a silent "not attached" with no explanation — so this is
 * checked up front instead of being discovered as a mysterious failure.
 *
 * `release` defaults to `os.release()` rather than reading it internally so
 * the parsing here — the part that can be wrong — is testable without
 * mocking `os`.
 */
export const isFluidEngineSupported = (
  release: string = os.release(),
): boolean => {
  if (process.platform !== 'win32') {
    return false;
  }
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(release.trim());
  if (!match) {
    return false;
  }
  const major = Number(match[1]);
  const build = Number(match[3]);
  if (major > 10) {
    return true;
  }
  return major === 10 && build >= 17134;
};

interface IRawStatusEndpoint {
  guid?: unknown;
  name?: unknown;
  attached?: unknown;
  backupExists?: unknown;
}

interface IParsedStatusEndpoint {
  guid: string;
  attached: boolean;
  backupExists: boolean;
}

const isRawStatusEndpoint = (value: unknown): value is IParsedStatusEndpoint =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as IRawStatusEndpoint).guid === 'string' &&
  typeof (value as IRawStatusEndpoint).attached === 'boolean' &&
  typeof (value as IRawStatusEndpoint).backupExists === 'boolean';

const parseStatusEndpoints = (value: unknown): IFluidEngineEndpoint[] =>
  Array.isArray(value)
    ? value.filter(isRawStatusEndpoint).map((endpoint) => ({
        guid: endpoint.guid,
        attached: endpoint.attached,
        backupExists: endpoint.backupExists,
      }))
    : [];

interface IRawStatus {
  installed?: unknown;
  dllPath?: unknown;
  dllVersion?: unknown;
  configDir?: unknown;
  endpoints?: unknown;
  error?: unknown;
}

/**
 * Turns the `status` command's stdout into a status document — pure and
 * total, same reasoning as `parseEngineSetupOutput`.
 *
 * `{"error":"..."}` (the enumeration-failed document, see `print_status`)
 * falls through to the same "not installed" answer as any other unreadable
 * shape without a dedicated branch: it has no `installed` field either, so
 * the ordinary defaulting already gets it right.
 */
export const parseFluidEngineStatus = (stdout: string): IFluidEngineStatus => {
  const notInstalled: IFluidEngineStatus = { installed: false, endpoints: [] };
  const text = stdout.trim();
  if (!text) {
    return notInstalled;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return notInstalled;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return notInstalled;
  }
  const raw = parsed as IRawStatus;
  const status: IFluidEngineStatus = {
    installed: raw.installed === true,
    endpoints: parseStatusEndpoints(raw.endpoints),
  };
  if (typeof raw.dllPath === 'string') {
    status.dllPath = raw.dllPath;
  }
  if (typeof raw.dllVersion === 'string') {
    status.dllVersion = raw.dllVersion;
  }
  if (typeof raw.configDir === 'string') {
    status.configDir = raw.configDir;
  }
  return status;
};

/**
 * Runs the helper's `status` command — never elevates, never throws.
 *
 * A spawn failure (helper missing, e.g. running from a source checkout with
 * no native build) and a helper that ran but reported nothing useful both
 * collapse to the same "not installed" answer a fresh machine would give,
 * because the app cannot tell those two apart from here and must not treat
 * one of them as a reason to stop working.
 */
export const readFluidEngineStatus = (): Promise<IFluidEngineStatus> =>
  new Promise((resolve) => {
    let stdout = '';
    let settled = false;

    const child = execFile(getEngineSetupPath(), ['status'], {
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });

    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.on('error', (error) => {
      if (settled) {
        return;
      }
      settled = true;
      log.error(`FluidEQ Engine status probe could not run: ${error.message}`);
      resolve({ installed: false, endpoints: [] });
    });

    child.on('close', () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(parseFluidEngineStatus(stdout));
    });
  });

/**
 * The one status read the app needs before it can decide what to show: the
 * engine dialog, a blocking install banner, or nothing.
 *
 * The first parameter is accepted (as `_userDataDir`, unread) rather than
 * dropped because every other function in the audio-engine module
 * (`loadAudioEnginePreference`, `saveAudioEnginePreference`) takes a
 * `userDataDir`, and Task 9's IPC handler injects this one alongside them as
 * a same-shaped dependency. This probe genuinely has nothing under it to
 * read: the fluid status comes from the setup helper and the APO status
 * from the registry, neither of which lives under `userData`.
 *
 * The APO registry probe is skipped under `'fluid'`: an EqualizerAPO install
 * that has nothing to do with the chosen engine is not this app's business
 * to report on, and `isEqualizerAPOInstalled` is one more `regedit` round
 * trip the fluid-only path has no reason to pay for.
 */
export const readAudioEngineStatus = async (
  _userDataDir: string,
  engine: TAudioEngine | null,
): Promise<IAudioEngineStatus> => {
  const shouldProbeApo = engine === 'apo' || engine === null;
  const [apoInstalled, fluid] = await Promise.all([
    shouldProbeApo ? isEqualizerAPOInstalled() : Promise.resolve(false),
    readFluidEngineStatus(),
  ]);
  return {
    engine,
    apo: { installed: apoInstalled },
    fluid,
    fluidSupported: isFluidEngineSupported(),
  };
};
