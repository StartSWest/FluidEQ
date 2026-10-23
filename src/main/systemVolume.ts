/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The app's side of `FluidEQ-Volume.exe` (`native/volume-watch/src/main.cpp`):
 * the level and mute of the output Windows plays through, followed as they
 * change anywhere and set from the compact player's slider.
 *
 * It runs only while the window shows that slider — the window says when —
 * and its input closing is what ends it, so quitting or a crash ends it too.
 * Nothing is left at logon and nothing polls.
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import type { BrowserWindow } from 'electron';
import log from 'electron-log';
import {
  ISystemVolume,
  parseSystemVolumeLine,
  SYSTEM_VOLUME_CHANGED,
  SYSTEM_VOLUME_CHANNEL,
  systemVolumeCommand,
} from '../common/systemVolume';
import { createHelperReplacement } from './helperReplacement';
import onWindowMessage from './ipc/windowMessages';

export const SYSTEM_VOLUME_EXECUTABLE =
  process.platform === 'win32' ? 'FluidEQ-Volume.exe' : undefined;

const resourcesPath = (): string => {
  const { resourcesPath: found } = process as NodeJS.Process & {
    resourcesPath?: string;
  };
  return typeof found === 'string' ? found : '';
};

export const findSystemVolumeExecutable = (): string | undefined => {
  if (!SYSTEM_VOLUME_EXECUTABLE) {
    return undefined;
  }
  return [
    path.join(resourcesPath(), 'native', SYSTEM_VOLUME_EXECUTABLE),
    path.join(__dirname, '../../native/.build/bin', SYSTEM_VOLUME_EXECUTABLE),
    path.join(
      __dirname,
      '../../../native/.build/bin',
      SYSTEM_VOLUME_EXECUTABLE,
    ),
  ].find((candidate) => existsSync(candidate));
};

export interface ISystemVolumeWatch {
  /** Start following, or keep following; the level arrives at once. */
  start: () => void;
  stop: () => void;
  set: (level: number) => void;
  mute: (isMuted: boolean) => void;
}

/**
 * `onChange` hears the level and mute, or `null` when there is no output to
 * control — no helper on this platform, no default output, or a helper that
 * ended and was not started again. Asked to start while already running, it
 * repeats the last answer: a window that reloaded is asking again and has
 * heard nothing yet.
 *
 * A helper that ends by itself while the slider shows is put back, as the
 * media helper is (`helperReplacement.ts`): with nothing to start another,
 * the slider went for as long as the window stayed up.
 */
export const createSystemVolumeWatch = (
  onChange: (volume: ISystemVolume | null) => void,
  locate: () => string | undefined = findSystemVolumeExecutable,
): ISystemVolumeWatch => {
  let child: ChildProcessWithoutNullStreams | undefined;
  let buffered = '';
  let last: ISystemVolume | null | undefined;
  const replacement = createHelperReplacement('system volume helper');

  const stop = () => {
    const running = child;
    child = undefined;
    buffered = '';
    running?.stdin.end();
  };

  const write = (line: string) => {
    if (child && !child.stdin.destroyed) {
      child.stdin.write(`${line}\n`);
    }
  };

  const run = (executable: string) => {
    const started = spawn(executable, [], { windowsHide: true });
    const helper = replacement.run();
    started.stdout.setEncoding('utf8');
    started.stdout.on('data', (chunk: string) => {
      if (started !== child) {
        return;
      }
      buffered += chunk;
      let end = buffered.indexOf('\n');
      while (end >= 0) {
        const line = buffered.slice(0, end);
        const said = parseSystemVolumeLine(line);
        buffered = buffered.slice(end + 1);
        if (said !== undefined) {
          helper.heard(line);
          last = said;
          onChange(said);
        }
        end = buffered.indexOf('\n');
      }
    });
    started.stdin.on('error', () => undefined);
    const ended = (how: string) => {
      // A stop lets go of the child first, so this is a helper that went by
      // itself, and only the current one's end means anything.
      if (started !== child) {
        return;
      }
      child = undefined;
      buffered = '';
      if (helper.ended(how)) {
        // The slider keeps the level it shows until the new helper's first
        // line, which comes as soon as it has read the output.
        run(executable);
        return;
      }
      last = null;
      onChange(null);
    };
    started.on('error', (error) => {
      log.info('The system volume helper could not start', error);
      ended(`could not start: ${error.message}`);
    });
    started.on('exit', (code, signal) => {
      ended(`exit code ${code ?? 'none'}, signal ${signal ?? 'none'}`);
    });
    child = started;
  };

  const start = () => {
    replacement.asked();
    if (child) {
      if (last !== undefined) {
        onChange(last);
      }
      return;
    }
    const executable = locate();
    if (!executable) {
      last = null;
      onChange(null);
      return;
    }
    run(executable);
  };

  return {
    start,
    stop,
    set: (level) => {
      const command = systemVolumeCommand(level);
      if (command) {
        write(command);
      }
    },
    mute: (isMuted) => write(isMuted ? 'mute 1' : 'mute 0'),
  };
};

/**
 * The window's requests, and the answers sent back to it. Only the main
 * window may ask: the helper sets the machine's volume.
 */
export const registerSystemVolumeIpc = (
  getMainWindow: () => BrowserWindow | null,
): { stop: () => void } => {
  const watch = createSystemVolumeWatch((volume) => {
    const window = getMainWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send(SYSTEM_VOLUME_CHANGED, volume);
    }
  });
  const off = onWindowMessage(SYSTEM_VOLUME_CHANNEL, (event, arg: unknown) => {
    if (event.sender !== getMainWindow()?.webContents || !Array.isArray(arg)) {
      return;
    }
    const [command, value] = arg as unknown[];
    if (command === 'watch') {
      if (value === true) {
        watch.start();
      } else {
        watch.stop();
      }
      return;
    }
    if (command === 'set' && typeof value === 'number') {
      watch.set(value);
      return;
    }
    if (command === 'mute' && typeof value === 'boolean') {
      watch.mute(value);
    }
  });
  return {
    stop: () => {
      off();
      watch.stop();
    },
  };
};
