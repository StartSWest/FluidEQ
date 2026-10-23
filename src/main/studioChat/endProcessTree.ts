/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { spawn, type ChildProcess } from 'child_process';

/**
 * Ends a program FluidEQ started and every process it started in turn: on
 * Windows a kill reaches only the first, and Claude Code and Codex each run
 * tools and helpers of their own beneath it.
 */
const endProcessTree = (child: ChildProcess) => {
  const { pid } = child;
  if (child.exitCode !== null || pid === undefined) {
    return;
  }
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    }).on('error', () => child.kill());
  } else {
    child.kill();
  }
};

export default endProcessTree;
