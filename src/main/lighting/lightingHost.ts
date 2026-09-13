/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import {
  createLineSplitter,
  encodeColoursFrame,
  parseHelperEvent,
  type THelperEvent,
} from './lightingWire';

/**
 * One running lighting helper: its events in, colour frames out.
 *
 * Closing it is how the lamps are given back. The helper holds Windows'
 * lighting objects for as long as it lives, and its exit is the one release
 * Windows honours for certain — so "stop lighting" is "end the process", and
 * the next frame starts a new one.
 */
export interface ILightingHost {
  readonly pid: number | undefined;
  /** Dropped, not queued, while the helper is behind: the next frame is newer. */
  send(device: number, rgb: Uint8Array): void;
  close(): void;
}

/**
 * Past this many unwritten bytes the helper is not keeping up — a keyboard
 * frame is about four hundred bytes, so this is several seconds of them.
 */
const BACKLOG_BYTES = 64 * 1024;

export const startLightingHost = (
  executable: string,
  onEvent: (event: THelperEvent) => void,
  onExit: (detail: string) => void,
): ILightingHost => {
  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn(executable, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
  } catch (error) {
    onExit(error instanceof Error ? error.message : String(error));
    return { pid: undefined, send: () => undefined, close: () => undefined };
  }

  let closed = false;
  let errorText = '';
  child.stdout.on(
    'data',
    createLineSplitter((line) => {
      const event = parseHelperEvent(line);
      if (event) {
        onEvent(event);
      }
    }),
  );
  child.stderr.on('data', (chunk: Buffer) => {
    if (errorText.length < 4096) {
      errorText += chunk.toString('utf8');
    }
  });
  // A write to a helper that has just died fails asynchronously; the exit
  // below is where that is reported, once.
  child.stdin.on('error', () => undefined);
  child.on('error', (error) => {
    errorText = errorText || error.message;
  });
  child.on('exit', (code, signal) => {
    const wasClosed = closed;
    closed = true;
    if (!wasClosed) {
      onExit(errorText.trim() || `exited with ${code ?? signal ?? 'nothing'}`);
    }
  });

  return {
    pid: child.pid,
    send: (device, rgb) => {
      if (closed || child.stdin.writableLength > BACKLOG_BYTES) {
        return;
      }
      child.stdin.write(encodeColoursFrame(device, rgb));
    },
    close: () => {
      if (closed) {
        return;
      }
      closed = true;
      child.stdin.end();
      child.kill();
    },
  };
};
