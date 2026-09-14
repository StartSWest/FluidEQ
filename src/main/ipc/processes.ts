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
 * mapped to a role the app has a sentence for (`processRoles.ts`), and the two
 * that Chromium has no app-level meaning for keep their service name as a
 * detail rather than being dressed up as something they are not.
 *
 * This is also user-facing diagnostics: an installed build is where a listener
 * most needs to identify a runaway engine, renderer, or Chromium service.
 */
import path from 'path';
import {
  BrowserWindow,
  WebContents,
  app,
  ipcMain,
  webContents as allWebContents,
} from 'electron';
import type { IHostStats } from '../dspHost/wire';
import type { IEngineProcessStats } from '../engineAnalysisPipe';
import type { IProcessMeter } from '../processMeter';
import {
  IAppProcess,
  applyReadings,
  byRole,
  isDesktopVisualizerPage,
  megabytes,
  roleFor,
  roleForExecutable,
} from '../processRoles';
import onWindowMessage from './windowMessages';

export type { IAppProcess, TProcessRole } from '../processRoles';

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
  /** Dynamic lighting's helper, only while it runs. */
  getLightingHelperPid?: () => number | undefined;
  /** The processes the FluidEQ Engine runs in, once each, as it measured them. */
  getSystemEngineProcesses?: () => IEngineProcessStats[];
  /**
   * Private memory and CPU time for every row, and the programs the app
   * started that nothing else lists (`processMeter.ts`).
   */
  meter?: IProcessMeter;
}

/**
 * Read once per question, and quietly: `getOSProcessId` throws once a page is
 * destroyed, and a window closing while the list is built is an ordinary race
 * rather than an error worth reporting.
 */
const processIdOf = (contents: WebContents | undefined): number => {
  try {
    return contents && !contents.isDestroyed() ? contents.getOSProcessId() : 0;
  } catch {
    return 0;
  }
};

/** The renderers drawing desktop visualizers, one per monitor showing one. */
const desktopVisualizerPids = (): Set<number> =>
  new Set(
    allWebContents
      .getAllWebContents()
      .filter(
        (contents) =>
          !contents.isDestroyed() && isDesktopVisualizerPage(contents.getURL()),
      )
      .map(processIdOf)
      .filter((pid) => pid !== 0),
  );

export const registerProcessIpc = (deps: IProcessIpcDeps): void => {
  // The meter runs while the list is open, and only then: the list says when
  // it closes, and a window that reloads or goes away has closed it too.
  const stopMeter = () => deps.meter?.stop();
  let watched: WebContents | undefined;
  const watchWindow = (window: BrowserWindow | null) => {
    const contents = window?.webContents;
    if (!contents || contents === watched) {
      return;
    }
    watched = contents;
    contents.on('did-start-loading', stopMeter);
    contents.once('destroyed', stopMeter);
  };

  ipcMain.handle('app-processes', async (): Promise<IAppProcess[]> => {
    const window = deps.getMainWindow();
    const context = {
      appWindowPid: processIdOf(window?.webContents),
      desktopPids: desktopVisualizerPids(),
    };

    const rows: IAppProcess[] = app.getAppMetrics().map((metric) => {
      const role = roleFor(metric, context);
      return {
        pid: metric.pid,
        role,
        // Chromium's display name ("Storage Service") before its interface
        // name, which for any forked Node child is the uninformative
        // `node.mojom.NodeService`.
        detail:
          role === 'helper' ? (metric.name ?? metric.serviceName) : undefined,
        // `workingSetSize` is in kilobytes, which is the units mistake that
        // makes a 900 MB renderer look like 900 KB and get ignored.
        memoryMb: Math.round(metric.memory.workingSetSize / 1024),
        cpuPercent: Math.round(metric.cpu.percentCPUUsage * 10) / 10,
        cpuSeconds: metric.cpu.cumulativeCPUUsage,
      };
    });

    const nativePid = deps.getNativeHostPid();
    if (nativePid !== undefined) {
      /*
       * Appended rather than merged: Electron does not know about it.
       *
       * The host measures itself and says so on its own wire, twice a second.
       * Those two numbers are the fallback for a machine without the meter;
       * where it runs, the meter's private working set and CPU time replace
       * them, as they replace Electron's.
       */
      const stats = deps.getNativeHostStats();
      rows.push({
        pid: nativePid,
        role: 'engine',
        memoryMb:
          stats === undefined ? undefined : megabytes(stats.workingSetBytes),
        cpuPercent:
          stats === undefined
            ? undefined
            : Math.round(stats.cpuPercent * 10) / 10,
      });
    }

    // Also ours rather than Electron's, and it does not measure itself: a dash
    // for its memory is honest, and it is a few megabytes of device watching.
    const lightingPid = deps.getLightingHelperPid?.();
    if (lightingPid !== undefined) {
      rows.push({ pid: lightingPid, role: 'lighting' });
    }

    deps.getSystemEngineProcesses?.().forEach((engine) => {
      rows.push({
        pid: engine.pid,
        role: 'systemEngine',
        memoryMb: megabytes(engine.workingSetBytes),
        cpuSeconds: engine.cpuSeconds,
        isShared: true,
      });
    });

    // One row per process, whichever source named it first. Each source knows
    // only its own processes, and a pid listed twice would be counted twice in
    // the total, which is exactly the number the list is opened for.
    const listed = new Set<number>();
    const unique = rows.filter((row) => {
      if (listed.has(row.pid)) {
        return false;
      }
      listed.add(row.pid);
      return true;
    });

    watchWindow(window);
    const readings = await deps.meter?.read([...listed], process.pid);
    if (!readings) {
      return unique.sort(byRole);
    }

    // The programs this process started that no source above knew about: each
    // monitor's desktop visualizer helper, the audio sharing capture, the
    // PowerShell reading other apps' media, the meter itself.
    const appExecutable = path.basename(process.execPath);
    readings.forEach((reading, pid) => {
      const role = roleForExecutable(reading.executable, appExecutable);
      if (role && !listed.has(pid)) {
        listed.add(pid);
        unique.push({ pid, role });
      }
    });
    return applyReadings(unique, readings).sort(byRole);
  });

  onWindowMessage('app-processes-closed', (event) => {
    if (event.sender === deps.getMainWindow()?.webContents) {
      stopMeter();
    }
  });
  app.on('will-quit', stopMeter);
};
