/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where the native host executable is, in each of the ways this app runs.
 *
 * Three candidates rather than a branch on `app.isPackaged`, because there are
 * three layouts and only two of them are "development": main is loaded from
 * `src/main` through ts-node during `pnpm dev`, from `dist/main` in a
 * production build, and from `resources/` once packaged. `__dirname` differs in
 * all three, so the answer is "the first one that exists" rather than a guess
 * about which run this is.
 *
 * Never resolved from the current working directory. A packaged app is started
 * from wherever the user happened to be, and a path built from `cwd` finds the
 * host on the developer's machine and nowhere else.
 */
import { existsSync } from 'fs';
import path from 'path';

export const DSP_HOST_EXECUTABLE =
  process.platform === 'win32' ? 'fluideq-dsp-host.exe' : 'fluideq-dsp-host';

/**
 * `resourcesPath` is Electron's, not Node's.
 *
 * Read through a widening rather than declared as always present, because this
 * module is deliberately loadable outside Electron — the supervisor's own
 * harness runs it from plain Node, and asserting a property that is genuinely
 * absent there would be a lie the type system happily repeated.
 */
const resourcesPath = (): string => {
  const { resourcesPath: found } = process as NodeJS.Process & {
    resourcesPath?: string;
  };
  return typeof found === 'string' ? found : '';
};

/** In build order: packaged first, then the two development layouts. */
const candidates = (): string[] => [
  path.join(resourcesPath(), 'native', DSP_HOST_EXECUTABLE),
  path.join(__dirname, '../../../native/.build/bin', DSP_HOST_EXECUTABLE),
  path.join(__dirname, '../../native/.build/bin', DSP_HOST_EXECUTABLE),
];

/**
 * The host, or nothing.
 *
 * `undefined` rather than a path that does not exist, so the caller reports
 * "the DSP engine is unavailable" instead of a spawn failure naming a file
 * nobody expected it to look for.
 */
export const findDspHostExecutable = (): string | undefined =>
  candidates().find((candidate) => existsSync(candidate));
