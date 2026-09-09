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
 * Driving `FluidEQ-Engine-Setup.exe` — the only program that ever writes the
 * registry keys the FluidEQ Engine needs.
 *
 * Every mutating command (`install`, `attach`, `detach`, `uninstall`,
 * `restart-audio`) self-elevates inside the helper: it relaunches itself with
 * `runas`, waits, and prints the elevated run's `last-setup.json` back to its
 * own stdout. This module never touches `runas` itself and never builds a
 * command line as a string — `execFile` is given an argv array, so a GUID or
 * an argument can never be interpreted as shell syntax.
 */

import { execFile } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import log from 'electron-log';
import { IFluidEngineEndpoint } from '../common/audioEngine';

export type TEngineSetupCommand =
  'install' | 'uninstall' | 'attach' | 'detach' | 'restart-audio';

export interface IEngineSetupResult {
  ok: boolean;
  /** Exit code 2: the UAC prompt was shown and the user said no. */
  declined: boolean;
  error?: string;
  endpoints: IFluidEngineEndpoint[];
}

const ENGINE_SETUP_EXECUTABLE =
  process.platform === 'win32'
    ? 'FluidEQ-Engine-Setup.exe'
    : 'FluidEQ-Engine-Setup';

/**
 * `resourcesPath` is Electron's, not Node's.
 *
 * Read through a widening rather than declared as always present, because
 * this module is loaded outside Electron by the unit suite, where the
 * property is genuinely absent.
 */
const resourcesPath = (): string => {
  const { resourcesPath: found } = process as NodeJS.Process & {
    resourcesPath?: string;
  };
  return typeof found === 'string' ? found : '';
};

/**
 * In build order: packaged first, then the two development layouts —
 * mirrors `dspHost/hostPath.ts`'s search for `FluidEQ-DSP.exe` exactly, for
 * the same reason: `__dirname` differs between `pnpm dev` (`src/main`),
 * a production build (`dist/main`) and a packaged app (`resources/`).
 */
const candidates = (): string[] => [
  path.join(resourcesPath(), 'native', ENGINE_SETUP_EXECUTABLE),
  path.join(__dirname, '../../../native/.build/bin', ENGINE_SETUP_EXECUTABLE),
  path.join(__dirname, '../../native/.build/bin', ENGINE_SETUP_EXECUTABLE),
];

/**
 * The setup helper's path, packaged or in development.
 *
 * Unlike `findDspHostExecutable`, this never returns `undefined` for a
 * missing binary: `runEngineSetup` has to hand `execFile` something to spawn
 * even on a machine where the helper genuinely is not there yet, and the
 * `ENOENT` that produces is already the exact failure `runEngineSetup` turns
 * into an `IEngineSetupResult` instead of a thrown error. The first
 * candidate stands in as the "expected" location when none exist, so the
 * error that reaches the log names where the helper was supposed to be.
 */
export const getEngineSetupPath = (): string =>
  candidates().find((candidate) => existsSync(candidate)) ?? candidates()[0];

interface IRawSetupEndpoint {
  guid?: unknown;
  attached?: unknown;
}

interface IParsedSetupEndpoint {
  guid: string;
  attached: boolean;
}

const isRawSetupEndpoint = (value: unknown): value is IParsedSetupEndpoint =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as IRawSetupEndpoint).guid === 'string' &&
  typeof (value as IRawSetupEndpoint).attached === 'boolean';

/**
 * The helper's endpoint list carries `guid`/`attached` only — `backupExists`
 * belongs to the `status` command's document, not this one (see
 * `commands.cpp`'s `result_json`) — so it is always `false` here rather than
 * left `undefined` and silently disagreeing with `IFluidEngineEndpoint`.
 */
const parseSetupEndpoints = (value: unknown): IFluidEngineEndpoint[] =>
  Array.isArray(value)
    ? value.filter(isRawSetupEndpoint).map((endpoint) => ({
        guid: endpoint.guid,
        attached: endpoint.attached,
        backupExists: false,
      }))
    : [];

interface IRawSetupResult {
  ok?: unknown;
  error?: unknown;
  endpoints?: unknown;
}

/**
 * Turns the helper's stdout and exit code into one verdict.
 *
 * Pure and total: every shape the helper can produce, and several it should
 * never produce (empty stdout, garbage, a missing `ok`), all resolve to a
 * value rather than a thrown exception, because this runs on the far side of
 * a process boundary where "the contract was violated" is itself a normal
 * outcome to report, not a bug to crash over.
 *
 * Exit code 2 always means declined, whatever stdout says — the elevation
 * prompt can be dismissed before the child ever gets to print anything, so a
 * present-but-unhelpful document must not be allowed to overrule the exit
 * code the way it would for the ok/fail codes.
 */
export const parseEngineSetupOutput = (
  stdout: string,
  exitCode: number | null,
): IEngineSetupResult => {
  const declined = exitCode === 2;
  const text = stdout.trim();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = undefined;
  }

  if (parsed !== undefined && typeof parsed === 'object' && parsed !== null) {
    const raw = parsed as IRawSetupResult;
    const error =
      typeof raw.error === 'string' && raw.error.length > 0
        ? raw.error
        : undefined;
    return {
      ok: !declined && raw.ok === true,
      declined,
      error,
      endpoints: parseSetupEndpoints(raw.endpoints),
    };
  }

  return {
    ok: false,
    declined,
    error: declined
      ? undefined
      : 'The setup helper produced no readable result.',
    endpoints: [],
  };
};

/**
 * Runs one setup command and resolves with what happened — never rejects.
 *
 * `exePath` defaults to `getEngineSetupPath()` but stays a parameter so a
 * test can point it at a path that does not exist, without a UAC prompt or a
 * real registry write ever becoming possible from the unit suite: the
 * `status` command is the only one this module has any business running
 * unattended, and even that lives in `engineStatus.ts`.
 *
 * `execFile` is given no callback, so Node neither buffers output for us nor
 * turns a spawn failure into a rejected promise — both are handled by hand
 * below, which is what lets an `ENOENT` resolve as `ok: false` instead of
 * throwing out of an `await`.
 */
export const runEngineSetup = (
  command: TEngineSetupCommand,
  args: string[],
  exePath: string = getEngineSetupPath(),
): Promise<IEngineSetupResult> =>
  new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;

    const child = execFile(exePath, [command, ...args], {
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });

    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (settled) {
        return;
      }
      settled = true;
      log.error(`FluidEQ Engine Setup could not be started: ${error.message}`);
      resolve({
        ok: false,
        declined: false,
        error: error.message,
        endpoints: [],
      });
    });

    child.on('close', (code) => {
      if (settled) {
        return;
      }
      settled = true;
      if (stderr.trim()) {
        log.error(
          `FluidEQ Engine Setup (${command}) wrote to stderr: ${stderr.trim()}`,
        );
      }
      resolve(parseEngineSetupOutput(stdout, code));
    });
  });
