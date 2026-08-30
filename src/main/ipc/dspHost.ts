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
import { isChainWirePayload } from '../../common/dsp/chainWire';
import { NOISE_PROFILE_WIRE_LENGTH } from '../../common/dsp/noiseProfile';
import {
  denoiseModelPath,
  downloadDenoiseModel,
  isDenoiseModelPresent,
  onnxRuntimeLibraryPath,
} from '../denoiseModel';
import { CROSSFADE_TABLE_POINTS } from '../../common/dsp/crossfadeShape';
import { findDspHostExecutable } from '../dspHost/hostPath';
import { DspHostSupervisor, TDspHostState } from '../dspHost/supervisor';
import { IHostAnalysis, IHostTelemetry } from '../dspHost/wire';

export interface IDspHostIpcDeps {
  getMainWindow: () => BrowserWindow | null;
}

/**
 * One host per app, built on first use and not before.
 *
 * Module state for the same reason the library index is: there is exactly one
 * of these per process, and threading it through every handler would be
 * ceremony around a singleton that is already a singleton.
 */
let supervisor: DspHostSupervisor | undefined;

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

export const registerDspHostIpc = ({
  getMainWindow,
}: IDspHostIpcDeps): void => {
  /**
   * Only while somebody can see it.
   *
   * The host publishes about forty telemetry frames a second and every one of
   * them would become an IPC message, a deserialisation and a store write for
   * a window that is not being composited. The same reasoning that stopped the
   * AudioWorklet building meter frames behind a minimised window applies to
   * the process one boundary further out.
   */
  const publish = (channel: string, payload: unknown) => {
    const window = getMainWindow();
    if (!window || window.isDestroyed() || window.isMinimized()) {
      return;
    }
    window.webContents.send(channel, payload);
  };

  const ensureSupervisor = (): DspHostSupervisor | undefined => {
    if (supervisor) {
      return supervisor;
    }
    const executablePath = findDspHostExecutable();
    if (!executablePath) {
      // Not an error worth a dialog: a checkout that has never built the
      // native target is an ordinary state, and the renderer's answer is to
      // keep using the TypeScript engine.
      log.info('dsp host: no executable found; native engine unavailable');
      return undefined;
    }
    supervisor = new DspHostSupervisor({
      executablePath,
      expectedParameterCount: NATIVE_DSP_PARAMETERS.length,
      onTelemetry: (telemetry: IHostTelemetry) =>
        publish('dsp-host-telemetry', telemetry),
      /**
       * Forwarded raw, and only sent at all while the panel has asked for it.
       *
       * Twelve kilobytes about twenty-three times a second is the largest thing
       * on this channel by two orders of magnitude, which is exactly why the
       * host stays silent until `setAnalysis` turns it on.
       */
      onAnalysis: (analysis: IHostAnalysis) =>
        publish('dsp-host-analysis', analysis),
      onStateChange: (state: TDspHostState) => publish('dsp-host-state', state),
      onDiagnostic: (event: IDspDiagnosticEvent) => {
        // Logged as well as forwarded. A window that has already gone is
        // exactly the case where the reason it went is worth keeping.
        log.error('dsp host diagnostic', event);
        publish('dsp-host-diagnostic', event);
      },
    });
    return supervisor;
  };

  ipcMain.handle('dsp-host-status', (): IDspHostStatus => statusOf());

  ipcMain.handle('dsp-host-start', async (): Promise<IDspHostStatus> => {
    const host = ensureSupervisor();
    if (!host) {
      return unavailable;
    }
    await host.start();
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
    return statusOf();
  });

  ipcMain.handle('dsp-host-stop', async (): Promise<IDspHostStatus> => {
    await supervisor?.stop();
    return statusOf();
  });

  ipcMain.handle('dsp-host-device-open', async (): Promise<boolean> => {
    if (!supervisor || supervisor.getState() !== 'ready') {
      return false;
    }
    try {
      return await supervisor.openDevice();
    } catch {
      // The supervisor has already reported why through its diagnostic
      // channel; a rejection here would only reach a `.catch` in the renderer
      // that could say nothing more specific.
      return false;
    }
  });

  ipcMain.handle('dsp-host-device-close', async (): Promise<boolean> => {
    if (!supervisor || supervisor.getState() !== 'ready') {
      return false;
    }
    try {
      return await supervisor.closeDevice();
    } catch {
      return false;
    }
  });

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
   * The whole chain, arrays included.
   *
   * Separate from `dsp-host-snapshot` because they carry different shapes: the
   * snapshot is the flat parameter table, and this is the one that can hold
   * sixty-four EQ bands. `isChainWirePayload` checks the length against the
   * band count the payload itself declares, so a truncated message is refused
   * rather than decoded into a shorter rack.
   */
  ipcMain.handle(
    'dsp-host-chain',
    async (_event, values: unknown): Promise<boolean> => {
      if (!supervisor || supervisor.getState() !== 'ready') {
        return false;
      }
      if (!isChainWirePayload(values)) {
        return false;
      }
      try {
        return await supervisor.applyChain(values);
      } catch {
        return false;
      }
    },
  );

  /**
   * The measured noise floor for the track now playing, or null to clear it.
   *
   * Validated here rather than trusted: the renderer is the only sender and
   * main the only forwarder, but the boundary is where a malformed message
   * stops, and "the only caller is ours" is a property of today's code rather
   * than of the channel. A wrong length reaching the host would be read as
   * band levels shifted into the hum partials.
   */
  ipcMain.handle(
    'dsp-host-noise-profile',
    async (_event, values: unknown): Promise<boolean> => {
      if (!supervisor || supervisor.getState() !== 'ready') {
        return false;
      }
      if (values === null || values === undefined) {
        try {
          return await supervisor.setNoiseProfile(undefined);
        } catch {
          return false;
        }
      }
      if (
        !Array.isArray(values) ||
        values.length !== NOISE_PROFILE_WIRE_LENGTH ||
        !values.every(
          (entry) => typeof entry === 'number' && Number.isFinite(entry),
        )
      ) {
        return false;
      }
      try {
        return await supervisor.setNoiseProfile(values);
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
   * The Custom crossfade curve, as 128 gains: outgoing then incoming.
   *
   * Its own channel rather than a transport verb because the verb channel
   * carries four numbers and this is an array, and because a shape that
   * arrives truncated must be refused here rather than half-applied to a
   * fade the listener is in the middle of.
   */
  ipcMain.handle(
    'dsp-host-crossfade-table',
    async (_event, values: unknown): Promise<boolean> => {
      if (!supervisor || supervisor.getState() !== 'ready') {
        return false;
      }
      if (
        !Array.isArray(values) ||
        values.length !== CROSSFADE_TABLE_POINTS * 2 ||
        !values.every(isFiniteNumber)
      ) {
        return false;
      }
      try {
        return await supervisor.setCrossfadeTable(values);
      } catch {
        return false;
      }
    },
  );

  /**
   * The transport, as one channel with a verb rather than eight channels.
   *
   * Eight would each need their own validation and their own name in the
   * preload, for messages that differ only in which of two numbers matters.
   * The verb is checked against a closed list, so an unknown one is refused
   * here rather than reaching the host as a command it would have to reject.
   */
  ipcMain.handle(
    'dsp-host-transport',
    async (
      _event,
      verb: unknown,
      deck: unknown,
      value: unknown,
      extra: unknown,
    ): Promise<boolean> => {
      if (!supervisor || supervisor.getState() !== 'ready') {
        return false;
      }
      const slot = Number.isInteger(deck) ? (deck as number) : -1;
      if (slot < 0 || slot > 1) {
        return false;
      }
      try {
        switch (verb) {
          case 'play':
            return await supervisor.setPlaying(true);
          case 'pause':
            return await supervisor.setPlaying(false);
          case 'select':
            return await supervisor.selectDeck(slot);
          case 'unload':
            return await supervisor.unloadDeck(slot);
          case 'seek':
            return isFiniteNumber(value)
              ? await supervisor.seekDeck(slot, value)
              : false;
          case 'crossfade':
            return isFiniteNumber(value) && Number.isInteger(extra)
              ? await supervisor.crossfade(slot, value, extra as number)
              : false;
          case 'volume':
            // Clamped again in the host; a renderer is the half of this app
            // that loads remote content.
            return isFiniteNumber(value)
              ? await supervisor.setVolume(Math.min(1, Math.max(0, value)))
              : false;
          case 'analysis':
            // The panel mounting and unmounting, which is the only caller.
            return await supervisor.setAnalysis(value !== 0);
          case 'gains':
            return isFiniteNumber(value) && isFiniteNumber(extra)
              ? await supervisor.setTrackGains(value, extra, true)
              : false;
          default:
            return false;
        }
      } catch {
        return false;
      }
    },
  );

  /**
   * A path, and the one channel that takes one.
   *
   * Main owns the executable and never accepts a path for it; this accepts a
   * path for a MEDIA file, which is a different thing and still needs saying:
   * the host opens it read-only through a decoder that knows two container
   * formats, and anything it cannot parse is refused rather than played as
   * silence.
   */
  ipcMain.handle(
    'dsp-host-load',
    async (_event, deck: unknown, mediaPath: unknown): Promise<boolean> => {
      if (!supervisor || supervisor.getState() !== 'ready') {
        return false;
      }
      const slot = Number.isInteger(deck) ? (deck as number) : -1;
      if (slot < 0 || slot > 1 || typeof mediaPath !== 'string' || !mediaPath) {
        return false;
      }
      try {
        return await supervisor.loadDeck(slot, mediaPath);
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

export const shutdownDspHost = async (): Promise<void> => {
  const host = supervisor;
  supervisor = undefined;
  await host?.stop();
};
