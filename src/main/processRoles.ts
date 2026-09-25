/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What each of FluidEQ's processes is, in the app's words rather than
 * Chromium's, and how a row's figures are made to add up.
 *
 * Pure, so the classification can be tested without Electron; the IPC that
 * gathers the processes is `ipc/processes.ts`.
 */
import type { IMeterReading } from './processMeter';
import {
  LIBRARY_SCAN_PROCESS_NAME,
  MODEL_PROCESS_NAME,
} from './utilityProcessNames';

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
  /**
   * Chromium's GPU process. Draws every window, and is where the Plus
   * visualizers' WebGL actually executes; runs no models.
   */
  | 'graphics'
  /**
   * A desktop visualizer's page: a Plus scene drawn as one monitor's
   * background, in a window of its own — so one of these per monitor.
   */
  | 'desktop'
  /**
   * `FluidEQ-Wallpaper.exe`, one per monitor: places that monitor's desktop
   * visualizer behind the icons and says when a full-screen app covers it.
   */
  | 'desktopHost'
  /** Our karaoke models (voice separation, pitch), forked on first use. */
  | 'models'
  /** Our library scan, forked for one scan and closed when it finishes. */
  | 'libraryScan'
  /** `FluidEQ-LAN-Capture.exe`: captures this PC's sound while it is shared. */
  | 'shareCapture'
  /**
   * `FluidEQ-LAN-Playback.exe`: plays what another FluidEQ shares with this
   * PC, while it is being listened to.
   */
  | 'sharePlayback'
  /**
   * `FluidEQ-Volume.exe`: follows and sets Windows' volume for the app's
   * volume sliders, while one of them is on screen.
   */
  | 'volume'
  /**
   * `FluidEQ-Games.exe`: says which program is in front, for Game presets,
   * while a game has a sound of its own or the Game presets page is open.
   */
  | 'games'
  /**
   * The PowerShell that reads what other apps are playing for the transport
   * bar (`systemMedia.ts`), and the short-lived one that sends them a command.
   */
  | 'mediaWatch'
  /** Chromium's audio service, which is what the browser-side player uses. */
  | 'sound'
  /** Update checks, artwork, the Video tab. */
  | 'network'
  /**
   * Chromium's video-capture service, started by device enumeration.
   *
   * Not called the camera service in the window: it is running because the
   * app listed audio devices, it holds no camera, and a row named "camera"
   * read as the app watching somebody.
   */
  | 'devices'
  /** Our own DSP host: a separate executable, not one of Electron's. */
  | 'engine'
  /**
   * The FluidEQ Engine: our DLL, running inside Windows' audiodg.exe.
   *
   * The process is Windows' own and is shared — sound card effects load into
   * it too — so its figures are shown for what they are and kept out of the
   * total (`isShared`).
   */
  | 'systemEngine'
  /** `FluidEQ-Meter.exe`, which measures this list and runs only while it is open. */
  | 'meter'
  /** Dynamic lighting's helper, which reaches Windows Dynamic Lighting. */
  | 'lighting'
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
   * Memory in megabytes: the private working set where the meter can read it
   * (`applyReadings`), the working set otherwise. Undefined when nothing has
   * measured it — which is a dash in the window, never a zero, because a zero
   * reads as a process that costs nothing rather than one nobody has asked.
   */
  memoryMb?: number;
  /**
   * Share of one core since the previous look, as Chromium or the host counts
   * it. For an Electron row that window is whatever elapsed since anybody last
   * called `getAppMetrics`, which is why the list prefers `cpuSeconds` below.
   */
  cpuPercent?: number;
  /**
   * CPU time used since the process started, in seconds.
   *
   * The list asks once per painted frame, and a percentage over sixteen
   * milliseconds is quantised by the Windows scheduler tick into 0 or 100. A
   * running total lets the window average over whatever span it chooses, and
   * no other caller of `getAppMetrics` can shorten that span. The DSP host
   * reports its own, which the meter's replaces where it runs.
   */
  cpuSeconds?: number;
  /**
   * A process FluidEQ runs in but does not own, whose memory is therefore not
   * FluidEQ's to add up. Only the Windows audio service hosting the engine.
   */
  isShared?: boolean;
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
  'video_capture.mojom.VideoCaptureService': 'devices',
};

/**
 * The utility processes this app forks itself, by the name it gave them.
 *
 * Matched on `name` rather than `serviceName`: every `utilityProcess.fork`
 * reports the same service, `node.mojom.NodeService`, and the `serviceName`
 * option passed to the fork lands in `name`. Matching on the service is what
 * listed the karaoke models and a library scan as two identical helpers.
 */
const OWN_UTILITY_ROLES: Record<string, TProcessRole> = {
  [MODEL_PROCESS_NAME]: 'models',
  [LIBRARY_SCAN_PROCESS_NAME]: 'libraryScan',
};

/**
 * Whether a page is a desktop visualizer's, by the document every one loads
 * (`wallpaper/window.ts`, `wallpaperUrl`). Its renderer is an Electron tab
 * like a Video page, and was listed as one.
 */
export const isDesktopVisualizerPage = (url: string): boolean => {
  try {
    return new URL(url).pathname.endsWith('/wallpaper.html');
  } catch {
    return false;
  }
};

export interface IElectronProcess {
  type: string;
  serviceName?: string;
  name?: string;
  pid: number;
}

export interface IRoleContext {
  /** The renderer of the app's own window. */
  appWindowPid: number;
  /** The renderers drawing desktop visualizers. */
  desktopPids: ReadonlySet<number>;
}

export const roleFor = (
  metric: IElectronProcess,
  { appWindowPid, desktopPids }: IRoleContext,
): TProcessRole => {
  if (metric.type === 'Browser') {
    return 'core';
  }
  if (metric.type === 'Tab') {
    if (metric.pid === appWindowPid) {
      return 'window';
    }
    return desktopPids.has(metric.pid) ? 'desktop' : 'page';
  }
  if (metric.type === 'GPU') {
    return 'graphics';
  }
  if (metric.type !== 'Utility') {
    return 'helper';
  }
  const own =
    metric.name === undefined ? undefined : OWN_UTILITY_ROLES[metric.name];
  if (own) {
    return own;
  }
  return (metric.serviceName && UTILITY_ROLES[metric.serviceName]) || 'helper';
};

/**
 * The programs the app starts itself, by executable name, lower-cased.
 *
 * Found by asking which processes the app started (`FluidEQ-Meter.exe`,
 * `c<pid>`), not by each feature registering its own: the list otherwise shows
 * only what somebody remembered to add, and three desktop visualizer helpers
 * and a PowerShell were running unlisted, their memory missing from the total.
 * The setup helper is left out on purpose — it runs for a moment at a time,
 * and a row that blinks in and out says nothing anybody can read.
 */
export const EXECUTABLE_ROLES: Readonly<Record<string, TProcessRole>> = {
  'fluideq-wallpaper.exe': 'desktopHost',
  'fluideq-lan-capture.exe': 'shareCapture',
  'fluideq-lan-playback.exe': 'sharePlayback',
  'fluideq-volume.exe': 'volume',
  'fluideq-games.exe': 'games',
  'powershell.exe': 'mediaWatch',
  'fluideq-dsp.exe': 'engine',
  'fluideq-lighting.exe': 'lighting',
  'fluideq-meter.exe': 'meter',
};

/**
 * The role of a process the app started that Electron did not list.
 *
 * A copy of the app's own executable is one of Chromium's — its crash
 * reporter is started that way and is not in `getAppMetrics` — and is a
 * helper like any other Chromium service. Anything else unknown is left out
 * rather than dressed up as one of ours.
 */
export const roleForExecutable = (
  executable: string | undefined,
  appExecutable: string,
): TProcessRole | undefined => {
  if (executable === undefined) {
    return undefined;
  }
  const known = EXECUTABLE_ROLES[executable.toLowerCase()];
  if (known) {
    return known;
  }
  return executable.toLowerCase() === appExecutable.toLowerCase()
    ? 'helper'
    : undefined;
};

/**
 * A fixed reading order, rather than sorting by whichever row is largest.
 *
 * This table used to sort by memory, which reordered itself under the cursor:
 * the GPU process and the window trade places whenever a spectrum redraws, so
 * a row being read moves as it is read and the column somebody is comparing
 * against is a different process a second later. The total is on the last
 * line, so nothing is gained by ranking them; what is gained by a fixed order
 * is that the row found once is in the same place next time.
 */
const ROLE_ORDER: readonly TProcessRole[] = [
  'window',
  'core',
  'engine',
  'systemEngine',
  'lighting',
  'graphics',
  'desktop',
  'desktopHost',
  'models',
  'libraryScan',
  'shareCapture',
  'sharePlayback',
  'volume',
  'games',
  'mediaWatch',
  'sound',
  'network',
  'devices',
  'page',
  'helper',
  'meter',
];

export const byRole = (a: IAppProcess, b: IAppProcess): number =>
  ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);

export const megabytes = (bytes: number): number =>
  Math.round(bytes / (1024 * 1024));

/**
 * Every row measured the one way that adds up, where the meter can.
 *
 * Electron's working set counts Chromium's shared DLL pages once per process,
 * and summed over the list that overstated the app by 800 MB of 2.8 GB. The
 * meter's private working set counts each page once and is Task Manager's own
 * Memory column; its CPU time comes from one call for every process, where
 * Electron's is estimated from CPU cycles and read ten percent above Windows'
 * own figure. A process the meter did not answer for — one that started after
 * the question was asked — shows a dash rather than a working set measured
 * the other way, which would jump when the next answer arrives. A reading
 * without a private figure — Windows 10 before 21H2 cannot give one — keeps
 * the working set, which is the best that machine can say.
 */
export const applyReadings = (
  rows: readonly IAppProcess[],
  readings: ReadonlyMap<number, IMeterReading>,
): IAppProcess[] =>
  rows.map((row) => {
    const reading = readings.get(row.pid);
    if (!reading) {
      return {
        ...row,
        memoryMb: undefined,
        cpuPercent: undefined,
        cpuSeconds: undefined,
      };
    }
    const bytes = reading.privateBytes ?? reading.workingSetBytes;
    return {
      ...row,
      memoryMb: bytes === undefined ? row.memoryMb : megabytes(bytes),
      cpuSeconds: reading.cpuSeconds ?? row.cpuSeconds,
    };
  });
