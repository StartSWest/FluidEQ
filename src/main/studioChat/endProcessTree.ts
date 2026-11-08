/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { spawn, type ChildProcess } from 'child_process';

/**
 * Ends a process by its id and every process it started in turn: on Windows
 * a kill reaches only the first, and Claude Code and Codex each run tools
 * and helpers of their own beneath it. Also for one FluidEQ did not start
 * itself — a chat's Claude Code held across a restart (`chatRelayHost.ts`).
 */
export const endProcessTreeById = (pid: number, fallback?: () => void) => {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    }).on('error', () => fallback?.());
    return;
  }
  if (fallback) {
    fallback();
    return;
  }
  try {
    process.kill(pid);
  } catch {
    // Already gone: there is nothing left to end.
  }
};

/** Ends a program FluidEQ started and every process it started in turn. */
const endProcessTree = (child: ChildProcess) => {
  const { pid } = child;
  if (child.exitCode !== null || pid === undefined) {
    return;
  }
  endProcessTreeById(pid, () => child.kill());
};

export default endProcessTree;
