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
import { findDspHostExecutable } from '../dspHost/hostPath';
import { DspHostSupervisor, TDspHostState } from '../dspHost/supervisor';
import { IHostTelemetry } from '../dspHost/wire';

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
