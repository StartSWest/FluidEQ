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
import path from 'path';
import log from 'electron-log';
import {
  IAudioEngineStatus,
  IFluidEngineEndpoint,
  IFluidEngineStatus,
  TAudioEngine,
} from '../common/audioEngine';
import { isEqualizerAPOInstalled, noteFluidEngineRegistered } from './registry';
import { getEngineSetupPath } from './engineSetup';
import { planEngineUpdate } from './engineUpdate';

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

interface IGuardedStatusEndpoint {
  guid: string;
  attached: boolean;
  backupExists?: unknown;
}

const isRawStatusEndpoint = (value: unknown): value is IGuardedStatusEndpoint =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as IRawStatusEndpoint).guid === 'string' &&
  typeof (value as IRawStatusEndpoint).attached === 'boolean';

/**
 * `backupExists` defaults to `false` when the helper omits it rather than
 * dropping the whole endpoint — `guid` and `attached` are the only fields the
 * helper's contract guarantees, so a document missing the third one is still
 * a real endpoint, not a malformed one.
 */
const parseStatusEndpoints = (value: unknown): IFluidEngineEndpoint[] =>
  Array.isArray(value)
    ? value.filter(isRawStatusEndpoint).map((endpoint) => ({
        guid: endpoint.guid,
        attached: endpoint.attached,
        backupExists: endpoint.backupExists === true,
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
 * The `installed` the helper actually printed, or nothing when it printed no
 * such field — which `parseFluidEngineStatus` deliberately cannot tell apart
 * from "not installed", because the status dialog wants one answer either
 * way. The flush gate is the one reader that must tell them apart.
 */
const answeredInstalled = (stdout: string): boolean | undefined => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return undefined;
  }
  const { installed } = parsed as IRawStatus;
  return typeof installed === 'boolean' ? installed : undefined;
};

/**
 * `execFile`'s own `maxBuffer` option only truncates output when a callback
 * is passed to it — this module reads `stdout`/`stderr` by hand instead (see
 * `runEngineSetup`'s own comment on the same point), so `maxBuffer` here
 * would be silently ignored. Capped by hand instead: once accumulated stdout
 * crosses this, further chunks are dropped and the result is treated as
 * unreadable rather than let a runaway or hostile helper grow the buffer
 * without bound.
 *
 * stderr is held to the same cap. It is drained so a chatty child cannot
 * block on a full pipe, and draining it into an unbounded string is the same
 * unbounded buffer under another name.
 */
const MAX_OUTPUT_BYTES = 1024 * 1024;

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
    let stdoutBytes = 0;
    let stdoutOverflowed = false;
    let stderr = '';
    let stderrBytes = 0;
    let settled = false;

    const child = execFile(getEngineSetupPath(), ['status'], {
      windowsHide: true,
    });

    child.stdout?.on('data', (chunk: Buffer | string) => {
      if (stdoutOverflowed) {
        return;
      }
      stdoutBytes += Buffer.byteLength(chunk);
      if (stdoutBytes > MAX_OUTPUT_BYTES) {
        stdoutOverflowed = true;
        return;
      }
      stdout += chunk.toString();
    });

    // Drained for the same reason `runEngineSetup` drains it: a chatty child
    // must never be able to block on a full stderr pipe just because nothing
    // here reads it. Kept reading past the cap, retained only up to it.
    child.stderr?.on('data', (chunk: Buffer | string) => {
      if (stderrBytes > MAX_OUTPUT_BYTES) {
        return;
      }
      stderrBytes += Buffer.byteLength(chunk);
      if (stderrBytes > MAX_OUTPUT_BYTES) {
        return;
      }
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (settled) {
        return;
      }
      settled = true;
      log.error(`FluidEQ Engine status probe could not run: ${error.message}`);
      resolve({ installed: false, endpoints: [] });
    });

    child.on('close', (code: number | null) => {
      if (settled) {
        return;
      }
      settled = true;
      if (stderr.trim()) {
        log.error(
          `FluidEQ Engine status probe wrote to stderr: ${stderr.trim()}`,
        );
      }
      if (stdoutOverflowed) {
        log.error(
          'FluidEQ Engine status probe stdout exceeded 1 MiB; treating as unreadable.',
        );
        resolve({ installed: false, endpoints: [] });
        return;
      }
      const status = parseFluidEngineStatus(stdout);
      // Only the helper's own yes or no reaches the flush gate. Its
      // `{"error":…}` document (exit 3: the audio stack could not be asked,
      // which happens mid-restart and at login before Audiosrv is up) also
      // parses to "not installed", and caching that refused every EQ change
      // under 'fluid' — and made a switch to Equalizer APO skip neutralising
      // the engine that was still running, so both processed the sound.
      const answer = code === 0 ? answeredInstalled(stdout) : undefined;
      if (answer !== undefined) {
        noteFluidEngineRegistered(answer);
      }
      resolve(status);
    });
  });

/**
 * `isEqualizerAPOInstalled` goes through `regedit`, a real process spawn that
 * can reject (a locked hive, a missing `reg.exe`) rather than only ever
 * resolving `false` — same failure shape as any other registry read in this
 * app. Caught here rather than left to reach `readAudioEngineStatus`'s
 * `Promise.all`, because an unguarded rejection there would reject the whole
 * status read and break the "never throws" contract every other probe in
 * this file already honours; logged with context, then folded into the same
 * "not installed" answer a genuine absence would produce.
 */
const probeApoInstalled = async (): Promise<boolean> => {
  try {
    return await isEqualizerAPOInstalled();
  } catch (error) {
    log.error(
      `Equalizer APO install probe failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return false;
  }
};

/**
 * Whether to offer this app's engine in place of the one installed.
 *
 * The installed set is the folder of `dllPath`, which the helper reads off the
 * engine's own registration — where Windows actually loads it from, with no
 * guess at where Program Files is. This app's set is the folder the helper
 * copies from, its own, which `bundleDir` defaults to.
 *
 * Anything that cannot be read is "no": the notice this feeds asks for a
 * Windows prompt, and has to be sure there is something to install first.
 */
export const readFluidEngineUpdateReady = async (
  fluid: IFluidEngineStatus,
  bundleDir: string = path.dirname(getEngineSetupPath()),
): Promise<boolean> => {
  if (!fluid.installed || !fluid.dllPath) {
    return false;
  }
  try {
    const plan = await planEngineUpdate(bundleDir, path.dirname(fluid.dllPath));
    if (plan.kind !== 'stale') {
      return false;
    }
    log.info(
      `The installed FluidEQ Engine is not this build's: ${plan.files.join(
        ', ',
      )} differ.`,
    );
    return true;
  } catch (error) {
    log.error(
      'The installed FluidEQ Engine could not be compared with this build',
      error,
    );
    return false;
  }
};

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
 * Equalizer APO is probed whatever the current engine is. Skipping it under
 * `'fluid'` reported `apo.installed: false` on a machine that has Equalizer
 * APO installed, and the "switch back to Equalizer APO" path reads exactly
 * that field to decide whether to run APO's installer — so every switch back
 * re-ran the installer and asked for a reboot. One `regedit` round trip on a
 * screen the user has deliberately opened is the cheaper side of that trade.
 * The ordinary flush path still never asks this question under `'fluid'`.
 */
export const readAudioEngineStatus = async (
  _userDataDir: string,
  engine: TAudioEngine | null,
): Promise<IAudioEngineStatus> => {
  const [apoInstalled, fluid] = await Promise.all([
    probeApoInstalled(),
    readFluidEngineStatus(),
  ]);
  return {
    engine,
    apo: { installed: apoInstalled },
    fluid,
    fluidSupported: isFluidEngineSupported(),
    fluidUpdateReady: await readFluidEngineUpdateReady(fluid),
  };
};
