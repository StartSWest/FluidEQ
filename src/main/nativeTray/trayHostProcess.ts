/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import net from 'net';
import path from 'path';
import log from 'electron-log';
import type { TTrayAction } from '../trayView';
import {
  ITrayHostState,
  ITrayQuitRecipe,
  ITrayRelaunch,
  leavingLine,
  readTrayHostLine,
  recipeLine,
  stateLine,
  trayHostPipe,
} from './trayHostWire';

/**
 * FluidEQ-Tray, started and spoken to: the notification-area icon and the
 * FluidEQ Engine's line to FluidEQ, in a program of their own
 * (`native/tray-host`). It is started detached — not in the job that ends
 * main's children with main — because what it is for is the moment main is
 * gone: a crash or End task then still leaves no EQ on any output.
 */

export const TRAY_HOST_EXECUTABLE = 'FluidEQ-Tray.exe';

/** Packaged beside the other native helpers, then the development build. */
export const findTrayHost = (): string | undefined => {
  const resources = (process as NodeJS.Process & { resourcesPath?: string })
    .resourcesPath;
  return [
    ...(resources
      ? [path.join(resources, 'native', TRAY_HOST_EXECUTABLE)]
      : []),
    path.join(__dirname, '../../native/.build/bin', TRAY_HOST_EXECUTABLE),
    path.join(__dirname, '../../../native/.build/bin', TRAY_HOST_EXECUTABLE),
  ].find((candidate) => existsSync(candidate));
};

/** Only what is used of the child, so a test can hand in its own. */
export interface ITrayHostChild {
  stdout: NodeJS.ReadableStream & { destroy: () => void };
  on(event: 'error', listener: (error: Error) => void): unknown;
  unref(): void;
}

/** Only what is used of the connection, likewise. */
export interface ITrayHostSocket {
  write(text: string): unknown;
  /** Writes the last line, and calls back once it has gone or failed. */
  end(text: string, done: (error?: Error | null) => void): unknown;
  destroy(): void;
  on(event: 'data', listener: (bytes: Buffer) => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  on(event: 'close', listener: () => void): unknown;
}

export interface ITrayHostParts {
  start: (executable: string, args: string[]) => ITrayHostChild;
  connect: (pipe: string) => ITrayHostSocket;
}

const SYSTEM_PARTS: ITrayHostParts = {
  start: (executable, args) =>
    spawn(executable, args, {
      detached: true,
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    }),
  connect: (pipe) => net.connect(pipe),
};

/** The tray's lines are a few dozen bytes; anything this long is not one. */
const MAX_LINE = 64 * 1024;

export interface ITrayHost {
  /** The tray that answered, which may be one an earlier start left running. */
  pid: number;
  /** Whether it holds the engine's line; when not, nothing does. */
  servesOwnerPipe: boolean;
  show: (state: ITrayHostState) => void;
  /** Sent at once and whenever it changes, never only with a state. */
  setRecipe: (recipe: ITrayQuitRecipe | undefined) => void;
  onPressed: (listener: (action: TTrayAction) => void) => void;
  /** The tray ended while main did not; heard once. */
  onLost: (listener: () => void) => void;
  /** Main's end of the line, which the tray hears as FluidEQ ending. */
  close: () => void;
  /**
   * Main's end of the line, with FluidEQ going on (`appLeave.ts`): settles
   * true once the tray has been told how to start it again, false when its
   * line ended first.
   */
  leave: (relaunch: ITrayRelaunch) => Promise<boolean>;
}

/** The tray's first line, `ready`; false once its output ends without it. */
const readyFrom = (child: ITrayHostChild): Promise<boolean> =>
  new Promise((resolve) => {
    let said = '';
    child.stdout.on('data', (bytes: Buffer) => {
      said += bytes.toString('utf8');
      const end = said.indexOf('\n');
      if (end >= 0) {
        resolve(said.slice(0, end).trim() === 'ready');
      }
    });
    // Its output ending is the tray having ended, whatever its exit says:
    // `exit` can come before the last of the output has been read.
    child.stdout.on('end', () => resolve(false));
    child.stdout.on('error', () => resolve(false));
    child.on('error', (error) => {
      log.warn(`FluidEQ-Tray could not be started: ${error.message}`);
      resolve(false);
    });
  });

/** Connected and greeted, or undefined when the line ends first. */
const linkTo = (socket: ITrayHostSocket): Promise<ITrayHost | undefined> =>
  new Promise((resolve) => {
    const pressedListeners: ((action: TTrayAction) => void)[] = [];
    const lostListeners: (() => void)[] = [];
    let host: ITrayHost | undefined;
    let closing = false;
    let ended = false;
    let pending = '';
    const send = (line: string) => {
      if (!ended) {
        socket.write(line);
      }
    };
    const greeted = (pid: number, servesOwnerPipe: boolean): ITrayHost => ({
      pid,
      servesOwnerPipe,
      show: (state) => send(stateLine(state)),
      setRecipe: (recipe) => send(recipeLine(recipe)),
      onPressed: (listener) => pressedListeners.push(listener),
      onLost: (listener) => lostListeners.push(listener),
      close: () => {
        closing = true;
        socket.destroy();
      },
      leave: (relaunch) =>
        new Promise<boolean>((resolve) => {
          closing = true;
          if (ended) {
            resolve(false);
            return;
          }
          // Whichever comes first: the line written, or the line gone.
          socket.on('close', () => resolve(false));
          socket.end(leavingLine(relaunch), (error) => resolve(!error));
        }),
    });
    socket.on('data', (bytes: Buffer) => {
      pending += bytes.toString('utf8');
      let end = pending.indexOf('\n');
      while (end >= 0) {
        const event = readTrayHostLine(pending.slice(0, end));
        pending = pending.slice(end + 1);
        if (event?.type === 'hello' && !host) {
          host = greeted(event.pid, event.ownerPipe);
          resolve(host);
        } else if (event?.type === 'pressed' && host) {
          const { id } = event;
          pressedListeners.forEach((listener) => listener(id));
        }
        end = pending.indexOf('\n');
      }
      if (pending.length > MAX_LINE) {
        socket.destroy();
      }
    });
    // `close` follows every error; this only keeps it from being thrown.
    socket.on('error', (error) => {
      if (!closing) {
        log.warn(`FluidEQ-Tray's line failed: ${error.message}`);
      }
    });
    socket.on('close', () => {
      if (ended) {
        return;
      }
      ended = true;
      if (!host) {
        resolve(undefined);
      } else if (!closing) {
        lostListeners.forEach((listener) => listener());
      }
    });
  });

/**
 * FluidEQ-Tray for this data folder, started if it is not running, and
 * connected; undefined wherever it cannot be, which leaves the icon to
 * Electron's tray and the engine's line to main (`engineOwnerPipe.ts`).
 * Never rejects.
 */
export const startTrayHost = async (
  {
    executable,
    key,
    ownerPipe,
  }: { executable: string; key: string; ownerPipe?: string },
  parts: ITrayHostParts = SYSTEM_PARTS,
): Promise<ITrayHost | undefined> => {
  let child: ITrayHostChild;
  try {
    child = parts.start(executable, [
      '--key',
      key,
      ...(ownerPipe ? ['--owner-pipe', ownerPipe] : []),
    ]);
  } catch (error) {
    log.warn('FluidEQ-Tray could not be started', error);
    return undefined;
  }
  if (!(await readyFrom(child))) {
    log.warn('FluidEQ-Tray ended before it was ready.');
    return undefined;
  }
  // It says nothing more on its output, and it outlives this process.
  child.stdout.destroy();
  child.unref();
  const host = await linkTo(parts.connect(trayHostPipe(key)));
  if (!host) {
    log.warn('FluidEQ-Tray was ready, and its line ended before it spoke.');
  }
  return host;
};
