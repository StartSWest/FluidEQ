/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which of our processes is which, since the operating system cannot say.
 *
 * Windows names a process from the version resource in its executable, and
 * every Electron child IS the same executable — so Task Manager shows six
 * identical rows called FluidEQ and no way to tell the window from the GPU
 * process from a utility. Chrome has exactly the same limitation; expand it
 * and every child says "Google Chrome". There is no naming scheme that fixes
 * this, because there is nothing per-process to name.
 *
 * Electron knows, though. `getAppMetrics` labels every process by type, names
 * the utilities by service, and `getOSProcessId` says which renderer is the
 * app's own window rather than a guest page. That last one matters: an app
 * playing a video runs several renderers and picking ours out by process id is
 * a guess.
 *
 * What this file will NOT do is pass Chromium's vocabulary through to the
 * window. `Tab`, `Browser`, `Utility: video_capture.mojom.VideoCaptureService`
 * are true and useless: they name the machinery rather than the job, and the
 * question being asked is what part of FluidEQ this is. So every process is
 * mapped to a role the app has a sentence for, and the two that Chromium has
 * no app-level meaning for keep their service name as a detail rather than
 * being dressed up as something they are not.
 *
 * Development only. It is a question a developer asks while chasing memory,
 * and a list of process ids is not something to put in front of a listener.
 */
import { BrowserWindow, app, ipcMain } from 'electron';
import type { IHostStats } from '../dspHost/wire';

/**
 * What a process does for FluidEQ, which is the only thing worth showing.
 *
 * A closed set on purpose: each one has a name and an explanation written for
 * it in every locale, so a role that arrives without one would render as a
 * missing string. Anything Chromium starts that is not on this list is a
 * `helper` carrying its own service name.
 */
export type TProcessRole =
  /** The process that owns everything: settings, devices, the system EQ. */
  | 'core'
  /** The app's own window — the one drawing the interface being looked at. */
  | 'window'
  /** Another renderer: a web page inside the Video tab, not our interface. */
  | 'page'
  /** Chromium's compositor. Draws every window; runs no models. */
  | 'graphics'
  /** Chromium's audio service, which is what the browser-side player uses. */
  | 'sound'
  /** Update checks, artwork, the Video tab. */
  | 'network'
  /** The camera and screen-capture service. */
  | 'camera'
  /** Our own DSP host: a separate executable, not one of Electron's. */
  | 'engine'
  /** Something Chromium started that we have no app-level sentence for. */
  | 'helper';

export interface IAppProcess {
  pid: number;
  role: TProcessRole;
  /**
   * Chromium's own words, kept only where they are the whole answer.
   *
   * A `helper` row is a service this app never asked for by name, and its
   * service string is more informative than any label we could invent.
   */
  detail?: string;
  /**
   * The working set, in megabytes. Undefined when nothing has measured it —
   * which is a dash in the window, never a zero, because a zero reads as a
   * process that costs nothing rather than one nobody has asked.
   */
  memoryMb?: number;
  cpuPercent?: number;
}

export interface IProcessIpcDeps {
  getMainWindow: () => BrowserWindow | null;
  /** The native host's pid, or undefined while it is not running. */
  getNativeHostPid: () => number | undefined;
  /**
   * What the native host says it costs, or undefined before its first sample.
   *
   * Injected like the pid beside it rather than imported: this module knows
   * how to describe a process and nothing about how the engine is supervised,
   * and a test can hand it a number without starting one.
   */
  getNativeHostStats: () => IHostStats | undefined;
}

/**
 * Chromium's utility services, in the order they answer "what is this for".
 *
 * Matched on the service name rather than on a substring of the label, so a
 * new service arrives as a `helper` with its own name showing instead of
 * silently matching a rule written for a different one.
 */
const UTILITY_ROLES: Record<string, TProcessRole> = {
  'audio.mojom.AudioService': 'sound',
  'network.mojom.NetworkService': 'network',
  'video_capture.mojom.VideoCaptureService': 'camera',
};

const roleFor = (
  type: string,
  service: string | undefined,
  isAppWindow: boolean,
): TProcessRole => {
  if (type === 'Browser') {
    return 'core';
  }
  if (type === 'Tab') {
    return isAppWindow ? 'window' : 'page';
  }
  if (type === 'GPU') {
    return 'graphics';
  }
  if (type === 'Utility' && service) {
    return UTILITY_ROLES[service] ?? 'helper';
  }
  return 'helper';
};

/**
 * A fixed reading order, rather than sorting by whichever row is largest.
 *
 * This table used to sort by memory, which reordered itself under the cursor:
 * the GPU process and the window trade places whenever a spectrum redraws, so
 * a row being read moves as it is read and the column somebody is comparing
 * against is a different process a second later. The list is nine rows at
 * most and the total is on the last line, so nothing is gained by ranking
 * them; what is gained by a fixed order is that the row found once is in the
 * same place next time.
 */
const ROLE_ORDER: readonly TProcessRole[] = [
  'window',
  'core',
  'engine',
  'graphics',
  'sound',
  'network',
  'camera',
  'page',
  'helper',
];

export const registerProcessIpc = (deps: IProcessIpcDeps): void => {
  ipcMain.handle('app-processes', (): IAppProcess[] => {
    if (process.env.NODE_ENV === 'development') {
      const window = deps.getMainWindow();
      /**
       * Read once, outside the map.
       *
       * `getOSProcessId` throws once the web contents are destroyed, and a
       * window closing while this list is being built is an ordinary race
       * rather than an error worth reporting.
       */
      let appWindowPid = 0;
      try {
        appWindowPid = window ? window.webContents.getOSProcessId() : 0;
      } catch {
        appWindowPid = 0;
      }

      const rows: IAppProcess[] = app.getAppMetrics().map((metric) => {
        const isAppWindow = metric.pid === appWindowPid;
        const role = roleFor(metric.type, metric.serviceName, isAppWindow);
        return {
          pid: metric.pid,
          role,
          detail: role === 'helper' ? metric.serviceName : undefined,
          // `workingSetSize` is in kilobytes, which is the units mistake that
          // makes a 900 MB renderer look like 900 KB and get ignored.
          memoryMb: Math.round(metric.memory.workingSetSize / 1024),
          cpuPercent: Math.round(metric.cpu.percentCPUUsage * 10) / 10,
        };
      });

      const nativePid = deps.getNativeHostPid();
      if (nativePid !== undefined) {
        /*
         * Appended rather than merged: Electron does not know about it.
         *
         * Its memory is not in `getAppMetrics` either, and reading another
         * process's counters from here needs a platform call this file
         * deliberately does not make — so the host measures itself and says so
         * on its own wire, twice a second. That is where these two numbers come
         * from, and they are the same working set Electron reports above rather
         * than a private commit that would not add up with it.
         */
        const stats = deps.getNativeHostStats();
        rows.push({
          pid: nativePid,
          role: 'engine',
          memoryMb:
            stats === undefined
              ? undefined
              : Math.round(stats.workingSetBytes / (1024 * 1024)),
          cpuPercent:
            stats === undefined
              ? undefined
              : Math.round(stats.cpuPercent * 10) / 10,
        });
      }

      return rows.sort(
        (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role),
      );
    }
    // Empty rather than absent, so the renderer's panel renders nothing
    // instead of having to branch on whether the channel exists at all.
    return [];
  });
};
