/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { existsSync } from 'fs';
import path from 'path';
import log from 'electron-log';
import type { IAudioWorkerTransport } from './host';
import { createShareFrameReader, encodeShareFrame } from './shareServiceWire';

export const SHARE_SERVICE_EXECUTABLE = 'FluidEQ-Share.exe';

/** Packaged beside the other native helpers, then the development build. */
export const findShareService = (): string | undefined => {
  const resources = (process as NodeJS.Process & { resourcesPath?: string })
    .resourcesPath;
  return [
    ...(resources
      ? [path.join(resources, 'native', SHARE_SERVICE_EXECUTABLE)]
      : []),
    path.join(__dirname, '../../native/.build/bin', SHARE_SERVICE_EXECUTABLE),
    path.join(
      __dirname,
      '../../../native/.build/bin',
      SHARE_SERVICE_EXECUTABLE,
    ),
  ].find((candidate) => existsSync(candidate));
};

/** Only what is used of the child, so a test can hand in its own. */
export interface IShareServiceChild {
  stdin: NodeJS.WritableStream & {
    on(event: 'error', listener: (error: Error) => void): unknown;
  };
  stdout: NodeJS.ReadableStream;
  stderr: NodeJS.ReadableStream;
  pid?: number;
  kill(): boolean;
  on(event: 'error', listener: (error: Error) => void): unknown;
  on(event: 'exit', listener: (code: number | null) => void): unknown;
}

const spawnService = (executable: string): IShareServiceChild =>
  spawn(executable, [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

/** One line the service logged: `{"message", "detail"}`, or plain text. */
const logLine = (line: string) => {
  try {
    const { message, detail } = JSON.parse(line) as {
      message?: unknown;
      detail?: unknown;
    };
    if (typeof message === 'string') {
      log.info(message, detail);
      return;
    }
  } catch {
    // Not one of its JSON lines: a failure it could only print.
  }
  log.warn('Share Audio service:', line);
};

/**
 * The Share Audio service as `host.ts` speaks to it: `FluidEQ-Share.exe`,
 * the C++ twin of the Node service it replaced, which held 33 MB for what
 * this does in a few. Its standard input is main's frames and ending it is
 * how the service is told to end; its standard error is its log.
 */
export const createShareServiceProcess = (
  executable: string,
  start: (file: string) => IShareServiceChild = spawnService,
): IAudioWorkerTransport => {
  const events = new EventEmitter();
  let ended = false;
  const child = start(executable);
  const finish = () => {
    ended = true;
  };
  const read = createShareFrameReader((message) =>
    events.emit('message', message),
  );
  child.stdout.on('data', (bytes: Buffer) => {
    if (ended) {
      return;
    }
    try {
      read(bytes);
    } catch (error) {
      finish();
      child.kill();
      events.emit(
        'error',
        error instanceof Error
          ? error
          : new Error('The Share Audio service sent an invalid frame.'),
      );
    }
  });
  let said = '';
  child.stderr.on('data', (bytes: Buffer) => {
    said += bytes.toString('utf8');
    const lines = said.split('\n');
    said = lines.pop() ?? '';
    lines
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .forEach(logLine);
  });
  child.stdin.on('error', (error) => {
    finish();
    events.emit('error', error);
  });
  child.on('error', (error) => {
    finish();
    events.emit('error', error);
  });
  child.on('exit', (code) => {
    finish();
    events.emit('exit', code ?? 1);
  });
  return Object.assign(events, {
    pid: child.pid,
    postMessage: (message: unknown) => {
      if (ended) {
        throw new Error('Share Audio process stopped.');
      }
      child.stdin.write(encodeShareFrame(message));
    },
    ref: () => undefined,
    unref: () => undefined,
    terminate: async () => {
      finish();
      child.kill();
      return 0;
    },
  });
};
