/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { spawn } from 'child_process';
import log from 'electron-log';
import type { TSpawnSceneHost } from '../lighting/lampSceneHost';
import type {
  ISceneHostScene,
  TSceneHostFailure,
} from '../lighting/sceneHostWire';
import {
  createDesktopHostReader,
  encodeMonitorClose,
  encodeMonitorDaylight,
  encodeMonitorOpen,
  encodeMonitorPause,
  encodeMonitorScale,
  encodeMonitorShow,
  type IMonitorRect,
} from './desktopHostWire';

/** What one monitor hears from the host. */
export interface IDesktopMonitorEvents {
  /** Its window, to be placed behind the icons. */
  window(hwnd: bigint): void;
  loaded(id: number): void;
  /** That scene's first frame is on the monitor. */
  drawn(id: number): void;
  /** `id` 0: the scene being drawn. The host ending fails every monitor. */
  failed(id: number, reason: TSceneHostFailure, words: string): void;
}

/** One monitor on the host, for as long as it is open. */
export interface IDesktopMonitor {
  show(id: number, scene: ISceneHostScene): void;
  daylight(daylight: { clock: true } | { clock: false; value: number }): void;
  scale(scale: number): void;
  pause(paused: boolean): void;
  close(): void;
  /** The host's process: the desktop helper checks the window is its. */
  pid(): number | undefined;
}

export interface IDesktopHost {
  open(
    rect: IMonitorRect,
    scale: number,
    events: IDesktopMonitorEvents,
  ): IDesktopMonitor;
  pid(): number | undefined;
}

/** stderr kept for the log when the host ends: its last few lines. */
const SAID_CHARS = 2000;

const spawnDesktopHost: TSpawnSceneHost = (executable, args) =>
  spawn(executable, [...args], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

/**
 * `FluidEQ-Scenes --mode desktop`, shared by every monitor drawn by C++
 * (`desktop_host.h`): started with the first monitor opened, ended — its
 * input closed — with the last one closed, and started afresh by the next.
 * A host that ends while monitors are open fails each of them, and the
 * backgrounds start them again as they would a page that went.
 */
export const createDesktopHost = ({
  executable,
  angleDir,
  spawnHost = spawnDesktopHost,
}: {
  executable: string;
  angleDir: string;
  spawnHost?: TSpawnSceneHost;
}): IDesktopHost => {
  let run:
    | {
        send: (message: Uint8Array) => void;
        stop: () => void;
        pid: () => number | undefined;
      }
    | undefined;
  const monitors = new Map<number, IDesktopMonitorEvents>();
  let nextMonitor = 1;

  const start = () => {
    const child = spawnHost(executable, [
      '--parent-pid',
      String(process.pid),
      '--angle-dir',
      angleDir,
      '--mode',
      'desktop',
    ]);
    let ended = false;
    let said = '';
    const self = {
      send: (message: Uint8Array) => {
        if (!ended && child.stdin?.writable) {
          child.stdin.write(message);
        }
      },
      stop: () => child.stdin?.end(),
      pid: () => (ended ? undefined : child.pid),
    };
    const end = () => {
      if (ended) {
        return;
      }
      ended = true;
      child.stdin?.destroy();
      if (run === self) {
        run = undefined;
      }
      const open = [...monitors.values()];
      monitors.clear();
      if (open.length > 0) {
        log.warn(`The desktop backgrounds' host ended: ${said.trim()}`);
        open.forEach((events) => events.failed(0, 'lost', said.trim()));
      }
    };
    const read = createDesktopHostReader({
      window: (monitor, hwnd) => monitors.get(monitor)?.window(hwnd),
      loaded: (monitor, id) => monitors.get(monitor)?.loaded(id),
      drawn: (monitor, id) => monitors.get(monitor)?.drawn(id),
      failed: (monitor, id, reason, words) =>
        monitors.get(monitor)?.failed(id, reason, words),
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
    return self;
  };

  return {
    open: (rect, scale, events) => {
      run ??= start();
      const host = run;
      const monitor = nextMonitor;
      nextMonitor += 1;
      monitors.set(monitor, events);
      host.send(encodeMonitorOpen(monitor, rect, scale));
      let closed = false;
      const send = (message: Uint8Array) => {
        if (!closed && run === host) {
          host.send(message);
        }
      };
      return {
        show: (id, scene) => send(encodeMonitorShow(monitor, id, scene)),
        daylight: (daylight) => send(encodeMonitorDaylight(monitor, daylight)),
        scale: (next) => send(encodeMonitorScale(monitor, next)),
        pause: (paused) => send(encodeMonitorPause(monitor, paused)),
        close: () => {
          send(encodeMonitorClose(monitor));
          closed = true;
          monitors.delete(monitor);
          if (monitors.size === 0 && run === host) {
            // The last one: the host ends with its input.
            run = undefined;
            host.stop();
          }
        },
        pid: () => (run === host ? host.pid() : undefined),
      };
    },
    pid: () => run?.pid(),
  };
};
