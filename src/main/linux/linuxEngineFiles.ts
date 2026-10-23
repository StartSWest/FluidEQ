/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where the FluidEQ Engine for Linux lives and keeps its files.
 *
 * The engine (`native/linux/engine`) is a process of the user's, so its
 * folder is the user's own: `$XDG_DATA_HOME/FluidEQ/engine`, which is
 * `~/.local/share/FluidEQ/engine` when unset — the same rule as the engine's
 * `paths_linux.cpp`, so both sides name one folder without passing it. The
 * layout inside is the Windows engine's: `config/` for what FluidEQ writes,
 * a `status-{ID}.json` per output, `engine.log`, and `outputs.json`, the
 * outputs the engine can see.
 */

import { existsSync } from 'fs';
import os from 'os';
import path from 'path';

/** `FLUIDEQ_ENGINE_ROOT` replaces the whole path, on both sides, for tests. */
export const linuxEngineRoot = (
  env: NodeJS.ProcessEnv = process.env,
  home: string = os.homedir(),
): string => {
  const absolute = (value: string | undefined) =>
    value !== undefined && value.startsWith('/') ? value : undefined;
  const override = absolute(env.FLUIDEQ_ENGINE_ROOT);
  if (override) {
    return override.replace(/\/+$/, '') || '/';
  }
  const data =
    absolute(env.XDG_DATA_HOME) ?? path.join(home, '.local', 'share');
  return path.join(data, 'FluidEQ', 'engine');
};

export const linuxEngineConfigDir = (): string =>
  path.join(linuxEngineRoot(), 'config');

export const linuxOutputsPath = (): string =>
  path.join(linuxEngineRoot(), 'outputs.json');

export const LINUX_ENGINE_EXECUTABLE = 'FluidEQ-Engine';

const resourcesPath = (): string => {
  const { resourcesPath: found } = process as NodeJS.Process & {
    resourcesPath?: string;
  };
  return typeof found === 'string' ? found : '';
};

/**
 * Packaged beside the DSP host, or where `pnpm dev` built it — the same
 * three places `dspHost/hostPath.ts` looks.
 */
export const findLinuxEngineExecutable = (): string | undefined =>
  [
    path.join(resourcesPath(), 'native', LINUX_ENGINE_EXECUTABLE),
    path.join(__dirname, '../../../native/.build/bin', LINUX_ENGINE_EXECUTABLE),
    path.join(__dirname, '../../native/.build/bin', LINUX_ENGINE_EXECUTABLE),
    path.join(
      __dirname,
      '../../../../native/.build/bin',
      LINUX_ENGINE_EXECUTABLE,
    ),
  ].find((candidate) => existsSync(candidate));
