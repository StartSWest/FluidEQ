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

export type { IDspHostStatus };

/** What main knows about the host right now, including its stderr tail. */
const getDspHostStatus = (): Promise<IDspHostStatus> =>
  ipcRenderer.invoke('dsp-host-status');

/**
 * Start the host process. Deliberately explicit.
 *
 * Nothing starts it at launch: a process that opens an audio endpoint is not
 * something an app should do because it was opened, and the renderer asks for
 * it when something is actually about to be heard.
 */
const startDspHost = (): Promise<IDspHostStatus> =>
  ipcRenderer.invoke('dsp-host-start');

const stopDspHost = (): Promise<IDspHostStatus> =>
  ipcRenderer.invoke('dsp-host-stop');

/** Opening the endpoint is what wakes the hardware, so it is its own call. */
const openDspHostDevice = (): Promise<boolean> =>
  ipcRenderer.invoke('dsp-host-device-open');

const closeDspHostDevice = (): Promise<boolean> =>
  ipcRenderer.invoke('dsp-host-device-close');

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

/**
 * The whole chain, arrays included, built by `encodeChainSettings`.
 *
 * The renderer never assembles this by hand — there is one encoder and it
 * lives in `common/dsp/chainWire.ts`, which is also what the parity fixtures
 * push through the native decoder.
 */
const applyDspHostChain = (values: readonly number[]): Promise<boolean> =>
  ipcRenderer.invoke('dsp-host-chain', values);

/** A media file into a deck. Refused if the host cannot decode it. */
const loadDspHostDeck = (deck: number, mediaPath: string): Promise<boolean> =>
  ipcRenderer.invoke('dsp-host-load', deck, mediaPath);

/**
 * The transport, as one call with a verb.
 *
 * `value` and `extra` mean different things per verb — seconds for a seek,
 * milliseconds and a curve index for a crossfade, two gains in dB for `gains`
 * — which is why the wrappers below exist rather than callers passing three
 * positional numbers and hoping.
 */
type TDspTransportVerb =
  | 'play'
  | 'pause'
  | 'select'
  | 'unload'
  | 'seek'
  | 'crossfade'
  | 'gains'
  // Not transport in the strict sense, but it belongs on this channel: it is a
  // one-word instruction to the same host with the same validation in front of
  // it, and a channel of its own would be ceremony around a boolean.
  | 'analysis'
  | 'volume';

const transport = (
  verb: TDspTransportVerb,
  deck: number,
  value?: number,
  extra?: number,
): Promise<boolean> =>
  ipcRenderer.invoke('dsp-host-transport', verb, deck, value, extra);

const playDspHost = (): Promise<boolean> => transport('play', 0);
const pauseDspHost = (): Promise<boolean> => transport('pause', 0);
const selectDspHostDeck = (deck: number): Promise<boolean> =>
  transport('select', deck);
const unloadDspHostDeck = (deck: number): Promise<boolean> =>
  transport('unload', deck);
const seekDspHostDeck = (deck: number, seconds: number): Promise<boolean> =>
  transport('seek', deck, seconds);
const crossfadeDspHost = (
  toDeck: number,
  durationMs: number,
  curveIndex: number,
): Promise<boolean> => transport('crossfade', toDeck, durationMs, curveIndex);
/**
 * The Custom curve's sampled shape, 128 gains: outgoing then incoming.
 *
 * Its own channel because the transport verb carries numbers, not arrays.
 */
const setDspHostCrossfadeTable = (
  values: readonly number[],
): Promise<boolean> => ipcRenderer.invoke('dsp-host-crossfade-table', values);

const setDspHostTrackGains = (
  inputGainDb: number,
  masterLoudnessGainDb: number,
): Promise<boolean> => transport('gains', 0, inputGainDb, masterLoudnessGainDb);

/**
 * The measured noise floor for the track now playing, or null to clear it.
 *
 * Its own channel rather than the transport verb for the same reason the
 * crossfade table has one: the verb carries four numbers and this is an array,
 * and a profile arriving truncated has to be refused rather than half-applied.
 */
const setDspHostNoiseProfile = (
  values: readonly number[] | null,
): Promise<boolean> => ipcRenderer.invoke('dsp-host-noise-profile', values);

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

/**
 * The listener's fader, 0 to 1.
 *
 * Mirrored because the elements are muted while the native engine is audible,
 * so the volume control on the player reached nothing at all: it moved, and the
 * sound did not change.
 */
const setDspHostVolume = (volume: number): Promise<boolean> =>
  transport('volume', 0, volume);

/**
 * Ask the host to measure what the panel draws, or to stop.
 *
 * Called when the DSP tab mounts and unmounts, and nowhere else. Off is the
 * default: three transforms and a scope window per block is real work to do for
 * a picture nobody is looking at.
 */
const setDspHostAnalysis = (enabled: boolean): Promise<boolean> =>
  transport('analysis', 0, enabled ? 1 : 0);

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

export const dspHostBridge = {
  appProcesses,

  getDspHostStatus,
  startDspHost,
  stopDspHost,
  openDspHostDevice,
  closeDspHostDevice,
  applyDspHostSnapshot,
  setDspHostParameter,
  applyDspHostChain,
  loadDspHostDeck,
  playDspHost,
  pauseDspHost,
  selectDspHostDeck,
  unloadDspHostDeck,
  seekDspHostDeck,
  crossfadeDspHost,
  setDspHostCrossfadeTable,
  setDspHostTrackGains,
  setDspHostNoiseProfile,
  readDspDenoiseModelState,
  downloadDspDenoiseModel,
  setDspHostVolume,
  setDspHostAnalysis,
  onDspHostAnalysis,
  onDspHostTelemetry,
  onDspHostState,
  onDspHostDiagnostic,
};
