/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type ChildProcess, spawn } from 'child_process';
import type { ICoreLog } from '../../coreLog';
import type {
  ISystemSoundSource,
  TSystemSoundEnd,
} from '../../systemSound/systemSound';
import { createCaptureFrameReader } from './captureFrames';

/** `FluidEQ-Listen.exe`'s own exit codes (`native/system-listen`). */
const EXIT_OUTPUT_CHANGED = 3;

/** Only what is read of the child, so a test can hand in its own. */
export type TListenChild = Pick<
  ChildProcess,
  'stdin' | 'stdout' | 'stderr' | 'on' | 'once'
>;

export type TSpawnListen = (executable: string) => TListenChild;

/**
 * stdout overlapped because the helper's writer waits on its own writes
 * (`capture_writer.h`); stdin is the helper's whole lifetime — it ends when
 * that pipe closes, or when this process does.
 */
const spawnListen: TSpawnListen = (executable) =>
  spawn(executable, ['--parent-pid', String(process.pid)], {
    stdio: ['pipe', 'overlapped', 'pipe'],
    windowsHide: true,
  });

/**
 * Windows: the default output heard through `FluidEQ-Listen.exe`, one helper
 * per run. It ends by itself only when Windows moves the default output or
 * takes the one heard away (`output-changed`, heard again on the new one at
 * once by `systemSound.ts`) or when something fails.
 */
export const createListenHelperSource = (
  executable: string,
  log: ICoreLog,
  spawnHelper: TSpawnListen = spawnListen,
): ISystemSoundSource => ({
  start: (handlers) => {
    const child = spawnHelper(executable);
    let isStopped = false;
    let hasEnded = false;
    let complaint = '';
    const end = (why: TSystemSoundEnd) => {
      if (hasEnded) {
        return;
      }
      hasEnded = true;
      child.stdin?.destroy();
      if (!isStopped) {
        if (why === 'failed') {
          log.warn(
            `The listening helper stopped${complaint ? `: ${complaint}` : '.'}`,
          );
        }
        handlers.ended(why);
      }
    };
    const read = createCaptureFrameReader({
      ready: handlers.ready,
      // Second-output replies belong to the other helper; this one sends none.
      reply: () => end('failed'),
      audio: (header, payload) =>
        handlers.audio({
          sampleRate: header.sampleRate,
          channels: header.channels,
          frames: header.frames,
          sequence: header.sequence,
          // Copied out of the stream's buffer: the block is transferred to a
          // window, which takes the whole of whatever buffer it is handed.
          pcm: new Uint8Array(payload).buffer,
        }),
      invalid: (error) => {
        complaint = error.message;
        end('failed');
      },
    });
    // A helper that has gone breaks its stdin, and an unhandled stream error
    // would take the whole process down with it; its exit says the rest.
    child.stdin?.on('error', () => undefined);
    child.stdout?.on('data', read);
    child.stderr?.on('data', (chunk: Buffer) => {
      // The helper says why it stopped on stderr, one line, before it exits.
      complaint = chunk.toString('utf8').trim().slice(0, 400);
    });
    child.on('error', (error) => {
      complaint = error.message;
      end('failed');
    });
    child.once('exit', (code) =>
      end(code === EXIT_OUTPUT_CHANGED ? 'output-changed' : 'failed'),
    );
    return {
      stop: () => {
        if (isStopped) {
          return;
        }
        isStopped = true;
        child.stdin?.end();
      },
    };
  },
});
