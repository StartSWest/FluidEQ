/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where the Mac engine's display connection is served: the Windows effect's
 * named pipe (`engineAnalysisPipe.ts`) as a Unix socket, beside the engine's
 * statuses in its root. The engine is told the path when it starts
 * (`--analysis`, `mac_analysis_link.h`) and connects to it on every reload,
 * as the effect does to its pipe.
 */
import fs from 'fs';
import type { ListenOptions } from 'net';
import path from 'path';
import { getFluidEngineConfigDir } from '../registry';

export const macAnalysisSocketPath = (): string =>
  path.join(path.dirname(getFluidEngineConfigDir()), 'analysis.sock');

/**
 * How to listen on it. A socket file left by a FluidEQ that did not get to
 * close it is removed first: listening over it fails with EADDRINUSE, and the
 * DSP page's meters would stay dark until somebody deleted it by hand. Only
 * this user may connect — the engine runs as this user — where the Windows
 * pipe has to admit the audio service's own account.
 */
export const macAnalysisListenOptions = (): ListenOptions => {
  const socket = macAnalysisSocketPath();
  fs.mkdirSync(path.dirname(socket), { recursive: true });
  fs.rmSync(socket, { force: true });
  return { path: socket };
};
