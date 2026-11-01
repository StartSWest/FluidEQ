/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The renderer's half of the DSP host bridge.
 *
 * Kept out of `api.ts` because that file is already past the size where things
 * are easy to find, and because everything about the native host now lives in
 * one directory. It is spread into the exposed API rather than nested, so the
 * renderer calls `window.electron.ipcRenderer.startDspHost()` like everything
 * else beside it.
 *
 * Every import here is `import type` except `ipcRenderer` itself. The preload
 * bundle must not pull `child_process` in behind the supervisor's types — see
 * the same note at the head of `api.ts`.
 */
import { ipcRenderer, IpcRendererEvent } from 'electron';
import type { IDspDiagnosticEvent } from '../../common/dsp/diagnostics';
import type { IDspHostStatus } from '../ipc/dspHost';
import type { IHostAnalysis, IHostTelemetry } from './wire';
import { ENGINE_ANALYSIS_CHANNEL } from '../../common/dsp/engineAnalysis';
import type { IEngineAnalysis } from '../../common/dsp/engineAnalysis';
import { CORE_COPY_CHANNEL } from '../../common/coreCopyChannels';

export type { IDspHostStatus };

/** What main knows about the host right now, including its stderr tail. */
const getDspHostStatus = (): Promise<IDspHostStatus> =>
  ipcRenderer.invoke('dsp-host-status');

/**
 * One complete chain, in the parameter table's order.
 *
 * Already clamped by the renderer. Main validates it again anyway, and refuses
 * the whole thing rather than repairing a value — a snapshot with one bad
 * number is a chain nobody chose.
 */
const applyDspHostSnapshot = (
  values: readonly number[],
  revision: number,
): Promise<boolean> =>
  ipcRenderer.invoke('dsp-host-snapshot', values, revision);

/** One control moving. `index` is the band, for a parameter that has bands. */
const setDspHostParameter = (
  parameterId: number,
  index: number | undefined,
  value: number,
  revision: number,
): Promise<boolean> =>
  ipcRenderer.invoke('dsp-host-parameter', parameterId, index, value, revision);

/**
 * Subscribe, and hand back the way to stop.
 *
 * Only the exact function that was registered can be removed, so the wrapper
 * is closed over rather than rebuilt — the same reason `on` in `api.ts` does
 * it this way.
 */
const onDspHostTelemetry = (listener: (frame: IHostTelemetry) => void) => {
  const wrapped = (_event: IpcRendererEvent, frame: IHostTelemetry) =>
    listener(frame);
  ipcRenderer.on('dsp-host-telemetry', wrapped);
  return () => {
    ipcRenderer.removeListener('dsp-host-telemetry', wrapped);
  };
};

const onDspHostState = (listener: (state: string) => void) => {
  const wrapped = (_event: IpcRendererEvent, state: string) => listener(state);
  ipcRenderer.on('dsp-host-state', wrapped);
  return () => {
    ipcRenderer.removeListener('dsp-host-state', wrapped);
  };
};

const onDspHostDiagnostic = (
  listener: (event: IDspDiagnosticEvent) => void,
) => {
  const wrapped = (_event: IpcRendererEvent, diagnostic: IDspDiagnosticEvent) =>
    listener(diagnostic);
  ipcRenderer.on('dsp-host-diagnostic', wrapped);
  return () => {
    ipcRenderer.removeListener('dsp-host-diagnostic', wrapped);
  };
};

/** Whether the Voice model is already on disk. */
const readDspDenoiseModelState = (): Promise<boolean> =>
  ipcRenderer.invoke('dsp-denoise-model-state');

/**
 * Fetch the Voice model and engage it, reporting bytes as they arrive.
 *
 * The listener is returned as a disposer rather than left attached: a card
 * that is opened and closed repeatedly would otherwise accumulate one
 * subscription per visit, and every one of them would fire.
 */
const downloadDspDenoiseModel = (
  onProgress: (received: number, total: number) => void,
): Promise<boolean> => {
  const listener = (
    _event: unknown,
    progress: { received: number; total: number },
  ) => onProgress(progress.received, progress.total);
  ipcRenderer.on('dsp-denoise-model-progress', listener);
  return ipcRenderer
    .invoke('dsp-denoise-model-download')
    .finally(() =>
      ipcRenderer.removeListener('dsp-denoise-model-progress', listener),
    );
};

/** Stop the Voice model's download; `downloadDspDenoiseModel` answers false. */
const cancelDspDenoiseModel = (): Promise<void> =>
  ipcRenderer.invoke('dsp-denoise-model-cancel');

/**
 * Ask the host to measure what the panel draws, or to stop.
 *
 * Called when the DSP tab mounts and unmounts, and nowhere else. Off is the
 * default: three transforms and a scope window per block is real work to do for
 * a picture nobody is looking at.
 */
const setDspHostAnalysis = (enabled: boolean): Promise<boolean> =>
  ipcRenderer.invoke('dsp-host-transport', 'analysis', 0, enabled ? 1 : 0);

const onDspHostAnalysis = (listener: (frame: IHostAnalysis) => void) => {
  const wrapped = (_event: IpcRendererEvent, frame: IHostAnalysis) =>
    listener(frame);
  ipcRenderer.on('dsp-host-analysis', wrapped);
  return () => {
    ipcRenderer.removeListener('dsp-host-analysis', wrapped);
  };
};

/**
 * Every process this app is running, labelled by what it does.
 *
 * Lives beside the DSP host's bridge because the host is one of the rows: it
 * is our own child rather than Electron's, so nothing else in the app knows
 * it exists. Available in every build because installed users need the same
 * evidence when the engine or one of Electron's services is misbehaving.
 */
const appProcesses = (): Promise<unknown[]> =>
  ipcRenderer.invoke('app-processes');

/** The list closed: its meter, which runs only while it is open, can stop. */
const appProcessesClosed = (): void => ipcRenderer.send('app-processes-closed');

/**
 * Game profiles' two questions, beside the processes list for the same
 * reason: both are answered by a helper of our own that nothing in Electron
 * knows about.
 */
const gamePrograms = (): Promise<unknown> =>
  ipcRenderer.invoke('game-programs');

/** Watch what Windows puts in front, or stop: nothing runs unwatched. */
const watchGames = (wanted: boolean): void =>
  ipcRenderer.send('game-watch', [wanted]);

/** The window's colours, for the card the core puts on the desktop. */
const keepCardColoursForCore = (colours: Record<string, string>): void =>
  ipcRenderer.send('game-card-colours', [colours]);

/** Which game's sound the core has on, answered on `game-sounding`. */
const askGameSounding = (): void => ipcRenderer.send('game-sounding-ask', []);

/** A program no launcher knows about, pointed at by hand. */
const chooseGameProgram = (): Promise<unknown> =>
  ipcRenderer.invoke('game-choose');

/**
 * The window's game profiles and its saved chains, handed whole to the core,
 * which keeps a copy to act on without the window (`common/coreCopies.ts`).
 */
const keepGamesForCore = (kept: {
  enabled: boolean;
  profiles: readonly unknown[];
}): void => ipcRenderer.send(CORE_COPY_CHANNEL.games, [kept]);
const keepDspPresetsForCore = (presets: readonly unknown[]): void =>
  ipcRenderer.send(CORE_COPY_CHANNEL.dspPresets, [presets]);
const handRackHoldToCore = (presetId: string): void =>
  ipcRenderer.send(CORE_COPY_CHANNEL.rackHold, [presetId]);

export const dspHostBridge = {
  readEnginePreamp: (
    endpoint: string,
  ): Promise<import('../../common/enginePreamp').IEnginePreamp | undefined> =>
    ipcRenderer.invoke('engine-preamp', endpoint),
  readDspEngineAnalysis: (
    endpoint: string | null,
  ): Promise<IEngineAnalysis | null | undefined> =>
    ipcRenderer.invoke(ENGINE_ANALYSIS_CHANNEL, endpoint),
  appProcesses,
  appProcessesClosed,
  gamePrograms,
  watchGames,
  chooseGameProgram,
  keepGamesForCore,
  keepDspPresetsForCore,
  handRackHoldToCore,
  keepCardColoursForCore,
  askGameSounding,

  getDspHostStatus,
  applyDspHostSnapshot,
  setDspHostParameter,
  readDspDenoiseModelState,
  downloadDspDenoiseModel,
  cancelDspDenoiseModel,
  setDspHostAnalysis,
  onDspHostAnalysis,
  onDspHostTelemetry,
  onDspHostState,
  onDspHostDiagnostic,
};
