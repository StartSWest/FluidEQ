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
 * Development only. It is a question a developer asks while chasing memory,
 * and a list of process ids is not something to put in front of a listener.
 */
import { BrowserWindow, app, ipcMain } from 'electron';

export interface IAppProcess {
  pid: number;
  /** Electron's own label: `Browser`, `Tab`, `GPU`, `Utility`, `Zygote`. */
  kind: string;
  /** For a utility, what it serves — `Network Service`, `Audio Service`. */
  service?: string;
  memoryMb: number;
  cpuPercent: number;
  /** The app's own window, as opposed to any other renderer. */
  isAppWindow: boolean;
  /**
   * Our own child rather than one of Electron's.
   *
   * The DSP host is a separate executable, so it does NOT appear in
   * `getAppMetrics` and Task Manager files it away from the FluidEQ group
   * entirely — which is exactly why somebody looking for it cannot find it.
   */
  isNative?: boolean;
}

export interface IProcessIpcDeps {
  getMainWindow: () => BrowserWindow | null;
  /** The native host's pid, or undefined while it is not running. */
  getNativeHostPid: () => number | undefined;
}

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

      const rows: IAppProcess[] = app.getAppMetrics().map((metric) => ({
        pid: metric.pid,
        kind: metric.type,
        service: metric.serviceName,
        // `workingSetSize` is in kilobytes, which is the units mistake that
        // makes a 900 MB renderer look like 900 KB and get ignored.
        memoryMb: Math.round(metric.memory.workingSetSize / 1024),
        cpuPercent: Math.round(metric.cpu.percentCPUUsage * 10) / 10,
        isAppWindow: metric.pid === appWindowPid,
      }));

      const nativePid = deps.getNativeHostPid();
      if (nativePid !== undefined) {
        // Appended rather than merged: Electron does not know about it, and
        // its memory is not in `getAppMetrics` either. Reported without a size
        // rather than with a wrong one — reading another process's working set
        // needs a platform call this file deliberately does not make.
        rows.push({
          pid: nativePid,
          kind: 'DSP Engine',
          memoryMb: 0,
          cpuPercent: 0,
          isAppWindow: false,
          isNative: true,
        });
      }
      return rows;
    }
    // Empty rather than absent, so the renderer's panel renders nothing
    // instead of having to branch on whether the channel exists at all.
    return [];
  });
};
