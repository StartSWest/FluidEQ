/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the Windows setup helper answers, answered for Linux.
 *
 * The app asks the helper whether the engine is installed, which version it
 * is and which outputs it is on, and asks it to install, attach and restart
 * Windows audio. On Linux there is nothing to install or attach: the engine
 * ships with the app, starts with it, and plays whatever output the listener
 * picks. So "installed" is the engine being where the app was installed,
 * every output it can see is "attached", the version is the engine's own
 * (`FluidEQ-Engine --version`, the Windows engine's version it is built
 * from), and "restart Windows audio" restarts the engine.
 */

import { execFile } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { promisify } from 'util';
import type { IFluidEngineStatus } from '../../common/audioEngine';
import type { IEngineSetupResult, TEngineSetupCommand } from '../engineSetup';
import {
  findLinuxEngineExecutable,
  linuxEngineConfigDir,
  linuxEngineRoot,
} from './linuxEngineFiles';
import { linuxEngine } from './linuxEngineProcess';
import { readLinuxOutputs, toEngineEndpoints } from './linuxOutputs';

const execFileAsync = promisify(execFile);

/** The engine binary's version, asked once per binary (`--version`). */
const versions = new Map<string, Promise<string | undefined>>();

const engineVersionOf = (executable: string): Promise<string | undefined> => {
  let known = versions.get(executable);
  if (!known) {
    known = execFileAsync(executable, ['--version'])
      .then(({ stdout }) => /(\d+\.\d+\.\d+\.\d+)/.exec(stdout)?.[1])
      .catch(() => undefined);
    versions.set(executable, known);
  }
  return known;
};

/** Never rejects: an engine that cannot be asked is one that is not there. */
export const readLinuxEngineStatus = async (): Promise<IFluidEngineStatus> => {
  const executable = findLinuxEngineExecutable();
  if (!executable) {
    return { installed: false, endpoints: [] };
  }
  const [outputs, version] = await Promise.all([
    readLinuxOutputs(),
    engineVersionOf(executable),
  ]);
  return {
    installed: true,
    dllPath: executable,
    dllVersion: outputs.engineVersion ?? version,
    configDir: linuxEngineConfigDir(),
    endpoints: toEngineEndpoints(outputs),
    // The Windows-only causes of an engine that never loads cannot happen
    // to a process FluidEQ starts itself.
    unsignedAllowed: true,
    runtimeBeside: true,
    serviceCanWrite: true,
    everRan: existsSync(path.join(linuxEngineRoot(), 'engine.log')),
  };
};

/**
 * `runEngineSetup` for Linux. Every command that would install or attach
 * makes sure the engine is running; "restart Windows audio" restarts it; the
 * Equalizer APO commands have nothing to act on.
 */
export const runLinuxEngineSetup = async (
  command: TEngineSetupCommand,
): Promise<IEngineSetupResult> => {
  const engine = linuxEngine();
  let ok = true;
  if (command === 'restart-audio') {
    ok = await engine.restart();
  } else if (command === 'install' || command === 'attach') {
    ok = engine.start();
  }
  const endpoints = toEngineEndpoints(await readLinuxOutputs());
  return ok
    ? { ok, declined: false, endpoints }
    : { ok, declined: false, endpoints, error: engine.trouble() };
};
