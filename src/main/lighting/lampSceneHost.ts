/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type ChildProcess, spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import {
  createSceneHostReader,
  type ISceneHostHandlers,
} from './sceneHostWire';

export const SCENE_HOST_EXECUTABLE = 'FluidEQ-Scenes.exe';

/** Only what is used of the child, so a test can hand in its own. */
export type TSceneHostChild = Pick<
  ChildProcess,
  'stdin' | 'stdout' | 'stderr' | 'on' | 'once' | 'pid'
>;

export type TSpawnSceneHost = (
  executable: string,
  args: readonly string[],
) => TSceneHostChild;

const spawnSceneHost: TSpawnSceneHost = (executable, args) =>
  spawn(executable, [...args], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

/** Where it is built: packaged beside the others, then the development build. */
export const findSceneHost = (
  nativeDirs: readonly string[],
): string | undefined =>
  nativeDirs
    .map((dir) => path.join(dir, SCENE_HOST_EXECUTABLE))
    .find((candidate) => existsSync(candidate));

export interface ILampSceneHostEvents extends Omit<
  ISceneHostHandlers,
  'invalid'
> {
  /** Ended, by itself or not; nothing follows. `said` is its last stderr. */
  exited(expected: boolean, said: string): void;
}

export interface ILampSceneHost {
  send(message: Uint8Array): void;
  /** Its stdin closed: it ends by itself, as when FluidEQ quits. */
  stop(): void;
  pid(): number | undefined;
}

/** stderr kept for the log when the host ends: its last few lines. */
const SAID_CHARS = 2000;

/**
 * `FluidEQ-Scenes.exe`, one run: started with this process as its parent
 * (it ends with it) and the ANGLE Electron ships in `angleDir`, spoken to on
 * stdin, heard on stdout. A stream that stops making sense ends the run.
 */
export const startLampSceneHost = ({
  executable,
  angleDir,
  events,
  spawnHost = spawnSceneHost,
}: {
  executable: string;
  angleDir: string;
  events: ILampSceneHostEvents;
  spawnHost?: TSpawnSceneHost;
}): ILampSceneHost => {
  const child = spawnHost(executable, [
    '--parent-pid',
    String(process.pid),
    '--angle-dir',
    angleDir,
  ]);
  let stopped = false;
  let ended = false;
  let said = '';
  const end = () => {
    if (ended) {
      return;
    }
    ended = true;
    child.stdin?.destroy();
    events.exited(stopped, said.trim());
  };
  const read = createSceneHostReader({
    ...events,
    invalid: (why) => {
      said = `${said}\nmain could not read it: ${why}`.slice(-SAID_CHARS);
      child.stdin?.end();
    },
  });
  // A host that has gone breaks its stdin, and an unhandled stream error
  // would take main down with it; its exit says the rest.
  child.stdin?.on('error', () => undefined);
  child.stdout?.on('data', (chunk: Buffer) => read(chunk));
  child.stderr?.on('data', (chunk: Buffer) => {
    said = `${said}${chunk.toString('utf8')}`.slice(-SAID_CHARS);
  });
  child.on('error', (error) => {
    said = `${said}\n${error.message}`.slice(-SAID_CHARS);
    end();
  });
  child.once('exit', () => end());
  return {
    send: (message) => {
      if (!ended && child.stdin?.writable) {
        child.stdin.write(message);
      }
    },
    stop: () => {
      stopped = true;
      child.stdin?.end();
    },
    pid: () => (ended ? undefined : child.pid),
  };
};
