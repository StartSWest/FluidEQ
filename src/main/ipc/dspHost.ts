/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The renderer's only way to reach the native DSP host.
 *
 * Main owns the executable and the renderer never sees its path — not as an
 * argument, not in a reply. A channel that accepted one would be a channel for
 * running any program on the machine, and the renderer is the half of this app
 * that loads remote content.
 *
 * Everything arriving here is validated even though the renderer already
 * clamped it. That is not distrust of our own code: `clampDspSettings` runs in
 * a process that also renders a web page, and the boundary between the two is
 * exactly where "already checked" stops being a fact and becomes an assumption.
 */
import { BrowserWindow, ipcMain } from 'electron';
import log from 'electron-log';
import { IDspDiagnosticEvent } from '../../common/dsp/diagnostics';
import {
  NATIVE_DSP_PARAMETERS,
  isNativeParameterId,
} from '../../common/dsp/nativeParameters';
import {
  cancelDenoiseModelDownload,
  denoiseModelPath,
  downloadDenoiseModel,
  isDenoiseModelPresent,
  onnxRuntimeLibraryPath,
} from '../denoiseModel';
import { findDspHostExecutable } from '../dspHost/hostPath';
import { DspHostSupervisor, TDspHostState } from '../dspHost/supervisor';
import {
  createDspHostPublisher,
  IDspHostPublisher,
} from '../dspHost/windowPublisher';
import { IHostAnalysis, IHostStats, IHostTelemetry } from '../dspHost/wire';

export interface IDspHostIpcDeps {
  getMainWindow: () => BrowserWindow | null;
  onVoiceModelChanged?: () => Promise<void>;
}

/**
 * One host per app, built on first use and not before.
 *
 * Module state for the same reason the library index is: there is exactly one
 * of these per process, and threading it through every handler would be
 * ceremony around a singleton that is already a singleton.
 */
let supervisor: DspHostSupervisor | undefined;

/**
 * Whether the host is currently pushing audio at a device.
 *
 * Kept here because this is the only place main ever learns it: the transport
 * verbs pass through this module and the supervisor keeps no play state of its
 * own. The unattended updater reads it to decide whether restarting the app
 * would cut a song off mid-bar — the window being hidden into the tray says
 * nothing about that, since the host plays perfectly well with no window.
 */
let isHostPlaying = false;
let rawSharing = false;
let rawLibrary = false;

/**
 * Who wants the host's analysis frames: the window's DSP panels, and the
 * core's Smart EQ, which hears the Library through the rack's input tap
 * (`main/smartEq/rawSourceFrames.ts`). The host sends while either does, and
 * the window is sent frames only while it asked — twelve kilobytes about
 * twenty-three times a second is not a thing to post to a page that did not.
 */
let windowWantsAnalysis = false;
const analysisListeners = new Set<(analysis: IHostAnalysis) => void>();
/** The rate the host plays at, from its telemetry; 0 before any. */
let hostSampleRate = 0;

const applyAnalysis = async (): Promise<boolean> =>
  supervisor
    ? supervisor.setAnalysis(windowWantsAnalysis || analysisListeners.size > 0)
    : false;

/**
 * Hear the host's analysis frames until the returned stop is called, or
 * undefined where the host cannot send them (not running, or refusing).
 */
export const listenToDspHostAnalysis = async (
  listener: (analysis: IHostAnalysis) => void,
): Promise<(() => void) | undefined> => {
  analysisListeners.add(listener);
  if (await applyAnalysis().catch(() => false)) {
    return () => {
      if (analysisListeners.delete(listener)) {
        applyAnalysis().catch(() => false);
      }
    };
  }
  analysisListeners.delete(listener);
  await applyAnalysis().catch(() => false);
  return undefined;
};

export const dspHostSampleRate = (): number => hostSampleRate;

/** Main enforces raw Library output before capture; renderer settings cannot
 * re-enable effects while sharing, including across host restarts. */
export const setDspHostRawSharing = async (enabled: boolean): Promise<void> => {
  rawSharing = enabled;
  if (
    supervisor &&
    !(await supervisor.setRawSharing(rawSharing || rawLibrary))
  ) {
    throw new Error('Could not change raw sharing on the Library engine.');
  }
};

/** Endpoint-owned Library processing bypasses the host without changing sharing. */
export const setDspHostRawLibrary = async (enabled: boolean): Promise<void> => {
  rawLibrary = enabled;
  if (
    supervisor &&
    !(await supervisor.setRawSharing(rawSharing || rawLibrary))
  ) {
    throw new Error(
      'Could not change output processing on the Library engine.',
    );
  }
};

export interface IDspHostStatus {
  state: TDspHostState | 'unavailable';
  handshake?: ReturnType<DspHostSupervisor['getHandshake']>;
  pid?: number;
  stderr: readonly string[];
}

const unavailable: IDspHostStatus = { state: 'unavailable', stderr: [] };

const statusOf = (): IDspHostStatus =>
  supervisor
    ? {
        state: supervisor.getState(),
        handshake: supervisor.getHandshake(),
        pid: supervisor.getPid(),
        stderr: supervisor.getStderrTail(),
      }
    : unavailable;

/** A finite number and nothing else. `NaN` is not a gain. */
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Everyone who reads the host's telemetry in main: the core's Library player. */
const telemetryListeners = new Set<(telemetry: IHostTelemetry) => void>();

/** How the host's messages reach the window; set when the channels register. */
let publisher: IDspHostPublisher | undefined;

/** The supervisor while it is up and answering, or undefined. */
export const readyDspHost = (): DspHostSupervisor | undefined =>
  supervisor?.getState() === 'ready' ? supervisor : undefined;

/** Whether this machine has a host to start at all. */
export const dspHostAvailable = (): boolean =>
  findDspHostExecutable() !== undefined;

/** Hear the host's telemetry until the returned stop is called. */
export const listenToDspHostTelemetry = (
  listener: (telemetry: IHostTelemetry) => void,
): (() => void) => {
  telemetryListeners.add(listener);
  return () => {
    telemetryListeners.delete(listener);
  };
};

/** The transport the player last set, for the updater's question. */
export const noteDspHostPlaying = (playing: boolean): void => {
  isHostPlaying = playing;
};

export const stopDspHost = async (): Promise<void> => {
  await supervisor?.stop();
};

const ensureSupervisor = (): DspHostSupervisor | undefined => {
  if (supervisor) {
    return supervisor;
  }
  const executablePath = findDspHostExecutable();
  if (!executablePath) {
    // Not an error worth a dialog: a checkout that has never built the
    // native target is an ordinary state. Browser playback remains available
    // unchanged, and the renderer marks the DSP rack unavailable.
    log.info('dsp host: no executable found; native engine unavailable');
    return undefined;
  }
  supervisor = new DspHostSupervisor({
    executablePath,
    expectedParameterCount: NATIVE_DSP_PARAMETERS.length,
    onTelemetry: (telemetry) => {
      hostSampleRate = telemetry.sampleRate;
      publisher?.publishTelemetry(telemetry);
      telemetryListeners.forEach((listener) => listener(telemetry));
    },
    /**
     * Forwarded raw, and only sent at all while somebody has asked for it.
     *
     * Twelve kilobytes about twenty-three times a second is the largest thing
     * on this channel by two orders of magnitude, which is exactly why the
     * host stays silent until `setAnalysis` turns it on.
     */
    onAnalysis: (analysis: IHostAnalysis) => {
      if (windowWantsAnalysis) {
        publisher?.publish('dsp-host-analysis', analysis);
      }
      analysisListeners.forEach((listener) => listener(analysis));
    },
    onStateChange: (state: TDspHostState) =>
      publisher?.publish('dsp-host-state', state),
    onLifecycle: (event) => {
      const entry = { event: event.event, ...event.values };
      if (event.event === 'stderr') {
        const line = String(event.values.line ?? '').toLowerCase();
        if (/failed|could not|\berror\b|no default|unsupported/.test(line)) {
          log.warn('dsp host native', entry);
        } else {
          log.info('dsp host native', entry);
        }
      } else {
        log.info('dsp host lifecycle', entry);
      }
    },
    onDiagnostic: (event: IDspDiagnosticEvent) => {
      // Logged as well as forwarded. A window that has already gone is
      // exactly the case where the reason it went is worth keeping.
      switch (event.severity) {
        case 'debug':
          log.debug('dsp host diagnostic', event);
          break;
        case 'info':
          log.info('dsp host diagnostic', event);
          break;
        case 'warn':
          log.warn('dsp host diagnostic', event);
          break;
        default:
          log.error('dsp host diagnostic', event);
          break;
      }
      publisher?.publish('dsp-host-diagnostic', event);
    },
  });
  return supervisor;
};

/**
 * Bring the host up, with what it has to have before it plays: raw sharing as
 * Share Audio last asked, and the voice model downloaded in an earlier
 * session. True once it is ready.
 */
export const startDspHost = async (): Promise<boolean> => {
  const host = ensureSupervisor();
  if (!host) {
    return false;
  }
  await host.start();
  if (!(await host.setRawSharing(rawSharing || rawLibrary))) {
    throw new Error('Could not restore raw sharing on the Library engine.');
  }
  /*
   * A model downloaded in an earlier session has to be handed over here.
   *
   * Nothing else does it. `loadVoiceModel` was only ever called from the
   * download handler, so the model engaged exactly once — in the session it
   * was fetched — and every launch after that started with the file sitting
   * on disk, the card offering no download because it was present, and the
   * module reporting itself unavailable forever.
   */
  if (host.getState() === 'ready' && isDenoiseModelPresent()) {
    const runtime = onnxRuntimeLibraryPath();
    if (runtime) {
      try {
        await host.loadVoiceModel(denoiseModelPath(), runtime);
      } catch {
        // The stage reports itself unavailable, which is already correct.
      }
    }
  }
  return host.getState() === 'ready';
};

export const registerDspHostIpc = ({
  getMainWindow,
  onVoiceModelChanged,
}: IDspHostIpcDeps): void => {
  // Telemetry has its own rule behind a minimised window. See `windowPublisher`.
  publisher = createDspHostPublisher(getMainWindow);

  ipcMain.handle('dsp-host-status', (): IDspHostStatus => statusOf());

  ipcMain.handle(
    'dsp-host-snapshot',
    async (_event, values: unknown, revision: unknown): Promise<boolean> => {
      if (!supervisor || supervisor.getState() !== 'ready') {
        return false;
      }
      // Refused whole rather than repaired. A snapshot with one bad value is a
      // chain nobody chose, and guessing which value was meant is how a preset
      // silently becomes a different preset.
      if (
        !Array.isArray(values) ||
        values.length !== NATIVE_DSP_PARAMETERS.length ||
        !values.every(isFiniteNumber) ||
        !Number.isInteger(revision)
      ) {
        return false;
      }
      try {
        return await supervisor.applySnapshot(values, revision as number);
      } catch {
        return false;
      }
    },
  );

  /**
   * Whether the Voice model is on disk, so the card can offer the download.
   *
   * Separate from loading it: the answer is wanted before the host is even
   * running, and it is what turns a switch that would do nothing into a
   * button that says what it needs.
   */
  ipcMain.handle('dsp-denoise-model-state', async (): Promise<boolean> =>
    isDenoiseModelPresent(),
  );

  /**
   * Fetch the model, then hand it and the runtime to the host.
   *
   * Both together, because neither is any use alone: a module pointed at a
   * model with no runtime is a control that reads as ready while doing
   * nothing. Progress goes back on its own channel so the card can show it
   * from the first second rather than after ten megabytes of silence.
   */
  /** The model's download stopped; its request answers false. */
  ipcMain.handle('dsp-denoise-model-cancel', (): void => {
    cancelDenoiseModelDownload();
  });

  ipcMain.handle(
    'dsp-denoise-model-download',
    async (event): Promise<boolean> => {
      const ok = await downloadDenoiseModel(({ received, total }) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('dsp-denoise-model-progress', { received, total });
        }
      });
      if (!ok) {
        return false;
      }
      await onVoiceModelChanged?.().catch((error) => {
        log.error('Could not refresh output voice processing', error);
      });
      /*
       * The answer is about the FILE, not about the engine.
       *
       * This used to report false whenever the host was not running or the
       * runtime could not be found, reasoning that the card should not claim a
       * module the engine had not accepted. The effect was the opposite of
       * careful: the card reset itself to "missing" after a successful
       * ten-megabyte download, so the button looked like it had done nothing
       * and pressing it again re-ran the whole thing. Whether the ENGINE has
       * the model is a different fact, and the card already has that one live
       * from `voiceModelLoaded` in the meter frame.
       */
      const runtime = onnxRuntimeLibraryPath();
      if (runtime && supervisor && supervisor.getState() === 'ready') {
        try {
          await supervisor.loadVoiceModel(denoiseModelPath(), runtime);
        } catch {
          // Engaging can wait for the next start. The file is downloaded and
          // its hash verified, which is what was actually asked for.
        }
      }
      return true;
    },
  );

  /**
   * The host's analysis frames, for the DSP page's graphs: the window's one
   * transport verb left. Everything else the window used to send here — load,
   * play, seek, the fade, the rack — the core's Library player now asks of
   * the supervisor itself (`libraryHostPort`).
   */
  ipcMain.handle(
    'dsp-host-transport',
    async (_event, verb: unknown, _deck: unknown, value: unknown) => {
      if (
        !supervisor ||
        supervisor.getState() !== 'ready' ||
        verb !== 'analysis'
      ) {
        return false;
      }
      try {
        // The panel mounting and unmounting, which is the window's only
        // caller; the core's Smart EQ may be listening too.
        windowWantsAnalysis = value !== 0;
        return await applyAnalysis();
      } catch {
        return false;
      }
    },
  );

  ipcMain.handle(
    'dsp-host-parameter',
    async (
      _event,
      parameterId: unknown,
      index: unknown,
      value: unknown,
      revision: unknown,
    ): Promise<boolean> => {
      if (!supervisor || supervisor.getState() !== 'ready') {
        return false;
      }
      if (
        typeof parameterId !== 'number' ||
        !isNativeParameterId(parameterId) ||
        !isFiniteNumber(value) ||
        !Number.isInteger(revision) ||
        (index !== undefined && !Number.isInteger(index))
      ) {
        return false;
      }
      try {
        const ack = await supervisor.setParameter(
          parameterId,
          index as number | undefined,
          value,
          revision as number,
        );
        return ack.status === 0;
      } catch {
        return false;
      }
    },
  );
};

/**
 * Take the host down with the app.
 *
 * A host left running holds an audio endpoint open, and an endpoint held by a
 * process whose parent has gone is one Windows only reclaims when it notices.
 * Called from `before-quit` rather than `will-quit`, because the shutdown is
 * asynchronous and `will-quit` is already too late to wait for anything.
 */
/**
 * The running host's process id, or undefined while it is not running.
 *
 * For the process list, which shows it alongside Electron's own — it is our
 * child rather than Electron's, so `getAppMetrics` has never heard of it and
 * Task Manager files it away from the FluidEQ group entirely.
 */
export const dspHostPid = (): number | undefined => supervisor?.getPid();

/**
 * What the host process costs, as the host itself measured it.
 *
 * The same list, and the one row Electron cannot fill in: `getAppMetrics`
 * covers Electron's children and this is a separate executable. Undefined
 * until its first sample arrives, which is within a frame of it starting.
 */
export const dspHostStats = (): IHostStats | undefined =>
  supervisor?.getStats();

/**
 * Is FluidEQ playing something right now?
 *
 * Answers false whenever the host is not up, so a crashed or not-yet-started
 * host reads as "nothing is playing" rather than as a reason to hold an update
 * back forever. The flag itself is set by the transport verbs above.
 */
export const isDspHostPlaying = (): boolean =>
  isHostPlaying && supervisor?.getState() === 'ready';

export const shutdownDspHost = async (): Promise<void> => {
  const host = supervisor;
  supervisor = undefined;
  isHostPlaying = false;
  await host?.stop();
};
