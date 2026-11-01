/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from 'path';
import { app } from 'electron';

/** The variable the sandbox launcher sets (`.erb/scripts/dev-sandbox.cjs`). */
export const SANDBOX_DIR_VARIABLE = 'FLUIDEQ_SANDBOX_DIR';
/** Its DevTools port, which must not be the 9222 of the development window. */
export const SANDBOX_CDP_PORT_VARIABLE = 'FLUIDEQ_SANDBOX_CDP_PORT';
export const SANDBOX_DEFAULT_CDP_PORT = 9244;

export interface IDevSandbox {
  /** Everything the sandbox writes lives under this folder. */
  root: string;
  /** Its own settings, profiles, caches and logs. */
  userData: string;
  /** Stands in for `%ProgramData%\FluidEQ\engine\config` and APO's config. */
  engineConfigDir: string;
  /** Where its cross-build single-copy lock lives. */
  instanceLockDir: string;
  cdpPort: number;
}

const portOf = (value: string | undefined): number => {
  const port = Number(value);
  return Number.isInteger(port) && port > 1024 && port < 65536 && port !== 9222
    ? port
    : SANDBOX_DEFAULT_CDP_PORT;
};

/**
 * The sandbox described by `env`, for a build that may run one.
 *
 * A second development copy of FluidEQ, run beside the one Ivan listens
 * through, may share nothing with it that reaches the sound: both engines read
 * one config folder each, the FluidEQ Engine applies a config only while
 * somebody holds its owner pipe, and every elevated helper run restarts
 * Windows audio. So a sandbox writes its engine configs into its own folder
 * that no engine reads, serves neither of the engine's pipes, runs no helper,
 * and keeps its own data, lock, DevTools port and taskbar identity.
 *
 * Never a packaged build: `isPackaged` closes it there whatever the
 * environment says, so an installed FluidEQ started with the variable set is
 * the ordinary app.
 */
export const sandboxFor = (
  env: NodeJS.ProcessEnv,
  isPackaged: boolean,
): IDevSandbox | undefined => {
  const dir = env[SANDBOX_DIR_VARIABLE];
  if (isPackaged || !dir || !path.isAbsolute(dir)) {
    return undefined;
  }
  const root = path.resolve(dir);
  return {
    root,
    userData: path.join(root, 'userData'),
    engineConfigDir: path.join(root, 'engine', 'config'),
    instanceLockDir: path.join(root, 'lock'),
    cdpPort: portOf(env[SANDBOX_CDP_PORT_VARIABLE]),
  };
};

/**
 * This process's sandbox, or `undefined` for every ordinary run. `app` is
 * absent under Jest, which is never a sandbox.
 */
export const devSandbox: IDevSandbox | undefined = app
  ? sandboxFor(process.env, app.isPackaged)
  : undefined;

/**
 * The product's name where a person picks a window or a tray icon: marked in a
 * sandbox, which otherwise looks exactly like the FluidEQ it runs beside — two
 * identical tray icons, two windows called FluidEQ, and a Quit meant for the
 * test copy landing on the real one, which takes the EQ off with it. English
 * only: a sandbox is a development tool and never reaches a listener.
 */
export const sandboxProductName = (product: string): string =>
  devSandbox ? `${product} (test copy)` : product;

/**
 * The id Windows files this process's windows and media sessions under: a
 * sandbox's own, so it neither shares a taskbar button with the FluidEQ it
 * runs beside nor reads its own players as somebody else's — the system
 * media watcher skips exactly this id, and a sandbox that told it the
 * ordinary one had its own Library video stop itself as another app's.
 */
export const ownAppUserModelId = (id: string): string =>
  devSandbox ? `${id}.sandbox` : id;
