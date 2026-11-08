/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import net from 'net';
import writeFileAtomically from '../atomicWrite';
import { createRelayHost } from './chatRelayHost';
import {
  RELAY_FAILED,
  RELAY_READY,
  type IRelaySettings,
} from './chatRelayProtocol';
import { createLineReader } from './chatStream';
import { startClaudeCode } from './claudeCode';
import endProcessTree from './endProcessTree';

/**
 * The process that holds the Studio's chats across FluidEQ's restarts in
 * development (`chatRelayHost.ts`), as `chatRelayBoot.cjs` runs it once it
 * has reached the FluidEQ that started it (`starter`): it listens on its
 * pipe, says it is ready on that line, and hears the starter go when the
 * line closes.
 */
const runRelayHost = (
  starter: net.Socket,
  { pipe, token, left }: IRelaySettings,
) => {
  const host = createRelayHost({
    token,
    spawn: ({ executable, args, cwd }, events) => {
      const child = startClaudeCode(executable, args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
      const reader = createLineReader(events.line);
      child.stdout?.setEncoding('utf8');
      child.stdout?.on('data', (chunk: string) => reader.push(chunk));
      child.stderr?.setEncoding('utf8');
      child.stderr?.on('data', events.errors);
      child.on('error', events.failed);
      child.on('close', events.closed);
      child.stdin?.on('error', () => undefined);
      return {
        ...(child.pid === undefined ? {} : { pid: child.pid }),
        write: (text) => {
          child.stdin?.write(text);
        },
        closeInput: () => {
          child.stdin?.end();
        },
        end: () => endProcessTree(child),
      };
    },
    writeLeft: (children) =>
      writeFileAtomically(left, JSON.stringify({ children }), 0o600),
    exit: () => process.exit(0),
  });

  const server = net.createServer((socket) => {
    socket.setEncoding('utf8');
    const link = host.connect(
      (text) => {
        socket.write(text);
      },
      () => socket.destroy(),
    );
    const reader = createLineReader(link.receive);
    socket.on('data', (chunk: string) => reader.push(chunk));
    socket.on('close', link.gone);
    socket.on('error', () => undefined);
  });

  server.on('error', (error) => {
    starter.end(`${RELAY_FAILED} ${String(error.message)}\n`, () =>
      process.exit(1),
    );
  });
  server.listen(pipe, () => {
    starter.write(`${RELAY_READY} ${process.pid}\n`);
  });
  starter.on('close', host.starterGone);
};

export default runRelayHost;
