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
import type { IHostTelemetry } from './wire';

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
  'play' | 'pause' | 'select' | 'unload' | 'seek' | 'crossfade' | 'gains';

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
const setDspHostTrackGains = (
  inputGainDb: number,
  masterLoudnessGainDb: number,
): Promise<boolean> => transport('gains', 0, inputGainDb, masterLoudnessGainDb);

export const dspHostBridge = {
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
  setDspHostTrackGains,
  onDspHostTelemetry,
  onDspHostState,
  onDspHostDiagnostic,
};
