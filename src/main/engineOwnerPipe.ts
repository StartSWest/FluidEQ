/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * The line the FluidEQ Engine holds to know FluidEQ is running.
 *
 * The engine keeps applying whatever it last read, and a Quit is the only way
 * out of this app that runs code on the way (`engineQuitReset.ts`): End task
 * in Task Manager, a crash, a power cut run nothing. So this keeps a named
 * pipe open for the whole life of the process, and the engine
 * (`native/system-apo/src/owner_link.h`) holds a connection to it. Windows
 * closes the pipe the instant this process ends — however it ends — the
 * engine's pending read breaks, and it passes every output through untouched
 * until FluidEQ is back.
 *
 * Nothing is sent either way. The connection existing is the whole message.
 */

import fs from 'fs';
import net from 'net';
import path from 'path';
import log from 'electron-log';
import { scheduleWrite } from './asyncWriter';
import { getFluidEngineConfigDir } from './registry';

/** `owner_pipe_name` in `native/system-apo/src/paths.cpp`: the same name. */
export const ENGINE_OWNER_PIPE = '\\\\.\\pipe\\FluidEQ-Engine-Owner';

/**
 * Written into the engine's configuration directory once the pipe is up.
 *
 * The engine only looks for the pipe when that directory changes: it cannot
 * be told a pipe appeared, and looking again on a timer is a poll. A launch
 * after a crash can find every config file already holding exactly what this
 * session writes, so nothing else is guaranteed to change there — this file
 * always does, because it names this process and the moment it started.
 */
export const ENGINE_OWNER_MARKER = 'fluideq-owner.txt';

export interface IEngineOwnerPipe {
  /** Stops serving it. The process ending does the same, which is the point. */
  close: () => Promise<void>;
}

const NOTHING_TO_CLOSE: IEngineOwnerPipe = { close: async () => undefined };

const closeServer = (server: net.Server) =>
  new Promise<void>((resolve) => {
    server.close(() => resolve());
  });

const wakeEngine = (configDir: string): void => {
  // A machine without the engine has no such directory, and making one is
  // not this code's business.
  if (!fs.existsSync(configDir)) {
    return;
  }
  scheduleWrite(
    path.join(configDir, ENGINE_OWNER_MARKER),
    [
      '# FluidEQ is running. The engine looks for it when this folder changes.',
      `pid=${process.pid}`,
      `started=${new Date().toISOString()}`,
      '',
    ].join('\r\n'),
  ).catch(() => undefined); // The writer logs its own failures.
};

/**
 * Serve the pipe; resolve once it is being served.
 *
 * Awaited before the window is made, and so before anything writes an engine
 * configuration: an engine that wakes on that write finds the pipe already
 * there.
 *
 * Never rejects, and nothing it sets up can throw later. A pipe that cannot be
 * served costs only the Task Manager case — the EQ outlives an ended FluidEQ,
 * as it did before this existed — while an unhandled `'error'` on the server
 * or on one of its connections is an exception out of the event loop, which
 * would take FluidEQ down with it.
 */
export const startEngineOwnerPipe = (
  pipePath: string = ENGINE_OWNER_PIPE,
  configDir: string = getFluidEngineConfigDir(),
): Promise<IEngineOwnerPipe> =>
  new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(NOTHING_TO_CLOSE);
      return;
    }
    const server = net.createServer((socket) => {
      // The engine never writes; whatever arrives is dropped. An error on one
      // connection — an engine unloading mid-read — ends that connection and
      // nothing else.
      socket.on('data', () => undefined);
      socket.on('error', () => undefined);
    });
    let settled = false;
    const settle = (pipe: IEngineOwnerPipe) => {
      if (!settled) {
        settled = true;
        resolve(pipe);
      }
    };
    server.on('error', (error) => {
      log.warn(
        `The FluidEQ Engine cannot see FluidEQ end: its pipe could not be served (${error.message}).`,
      );
      settle(NOTHING_TO_CLOSE);
    });
    server.listen(pipePath, () => {
      wakeEngine(configDir);
      settle({ close: () => closeServer(server) });
    });
  });
