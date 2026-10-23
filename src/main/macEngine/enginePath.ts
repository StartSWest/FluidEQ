/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where the macOS engine's executable is, in each of the ways this app runs.
 *
 * The same three layouts, in the same order, as the DSP host's
 * (`dspHost/hostPath.ts`): packaged under `resources/native`, and the two
 * development layouts `__dirname` can be in. The first one that exists, and
 * never anything resolved from the current working directory.
 */
import { existsSync } from 'fs';
import path from 'path';

export const MAC_ENGINE_EXECUTABLE = 'FluidEQ-Engine';

const resourcesPath = (): string => {
  const { resourcesPath: found } = process as NodeJS.Process & {
    resourcesPath?: string;
  };
  return typeof found === 'string' ? found : '';
};

const candidates = (): string[] => [
  path.join(resourcesPath(), 'native', MAC_ENGINE_EXECUTABLE),
  path.join(__dirname, '../../../native/.build/bin', MAC_ENGINE_EXECUTABLE),
  path.join(__dirname, '../../native/.build/bin', MAC_ENGINE_EXECUTABLE),
];

/** The engine, or nothing — a checkout that has not built it is ordinary. */
export const findMacEngineExecutable = (): string | undefined =>
  candidates().find((candidate) => existsSync(candidate));
