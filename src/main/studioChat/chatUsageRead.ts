/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ChildProcess } from 'child_process';
import { createLineReader } from './chatStream';
import { readUsageLine, usageRequestLine, type TChatUsage } from './chatUsage';
import endProcessTree from './endProcessTree';

interface IUsageReadDeps {
  /** The member's Claude Code, when it is installed. */
  executable: () => string | undefined;
  start: (executable: string, args: string[], cwd: string) => ChildProcess;
  /** Where the one-off run is started: the chat's own folder. */
  cwd: string;
  onUsage: (usage: TChatUsage) => void;
}

/**
 * The plan's usage asked of a Claude Code started for nothing else, when the
 * accounts card opens and no chat is running to ask: the one question,
 * `get_usage`, on its input, which then closes, and Claude Code ends once it
 * has answered (about three seconds, measured 2026-10-24 on 2.1.302). No
 * model is called and no conversation is kept (`--no-session-persistence`),
 * and the member's MCP servers are not started for it.
 *
 * One run at a time: opening the card again while one is out asks nothing
 * more, and the answer reaches the card through the chat's usage like any
 * other report.
 */
const createUsageRead = ({
  executable,
  start,
  cwd,
  onUsage,
}: IUsageReadDeps) => {
  let running: ChildProcess | undefined;

  return {
    read: () => {
      const found = executable();
      if (running || !found) {
        return;
      }
      const child = start(
        found,
        [
          '-p',
          '--input-format',
          'stream-json',
          '--output-format',
          'stream-json',
          '--verbose',
          '--no-session-persistence',
          '--strict-mcp-config',
        ],
        cwd,
      );
      running = child;
      const done = () => {
        if (running === child) {
          running = undefined;
        }
      };
      const reader = createLineReader((line) =>
        readUsageLine(line).forEach(onUsage),
      );
      child.stdout?.setEncoding('utf8');
      child.stdout?.on('data', (chunk: string) => reader.push(chunk));
      child.on('error', done);
      child.on('close', done);
      child.stdin?.on('error', () => undefined);
      child.stdin?.end(usageRequestLine());
    },
    /** FluidEQ is closing: a run still out ends with it. */
    dispose: () => {
      if (running) {
        endProcessTree(running);
        running = undefined;
      }
    },
  };
};

export default createUsageRead;
