/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IDspDiagnosticEvent } from './diagnostics';
import { TNativeParameterId } from './nativeParameters';

/**
 * The contract between the renderer, Electron main and the native DSP host.
 *
 * Nothing here carries audio. The host owns decoding, the device and the
 * real-time callback; this protocol carries small control packets one way and
 * rate-limited telemetry the other, which is what keeps a DSP stall out of the
 * UI and a UI stall out of the audio.
 *
 * Bumped whenever a field changes meaning, is removed, or an existing command
 * starts behaving differently. Adding a command or an optional field does not
 * bump it. Main refuses a host whose handshake reports a different major
 * version rather than discovering the mismatch later, on an unknown command,
 * halfway through somebody's evening.
 */
export const NATIVE_DSP_PROTOCOL_VERSION = 1 as const;

/**
 * Identifies one run of the host process.
 *
 * A supervised restart produces a new id, and every acknowledgement, telemetry
 * frame and diagnostic carries it. Without one, a reply that was in flight when
 * the old host died is indistinguishable from a reply by the new one — and the
 * renderer would apply it to state the new host has never been told about.
 */
export type TEngineSessionId = string;

export type TEngineState =
  'stopped' | 'starting' | 'running' | 'suspended' | 'failed';

/** Two decks, because a crossfade needs the outgoing one still decoding. */
export type TDeckId = 0 | 1;

export const NATIVE_ENGINE_COMMANDS = [
  'engine.hello',
  'engine.getCapabilities',
  'engine.start',
  'engine.suspend',
  'engine.resume',
  'engine.stop',
  'engine.getState',
  'engine.setOutputDevice',
  'engine.setTelemetrySubscription',
  'engine.shutdown',
] as const;

export const NATIVE_TRANSPORT_COMMANDS = [
  'transport.loadDeck',
  'transport.unloadDeck',
  'transport.play',
  'transport.pause',
  'transport.stop',
  'transport.seek',
  'transport.setVolume',
  'transport.prepareNext',
  'transport.cancelPreparation',
  'transport.crossfade',
  'transport.cancelCrossfade',
  'transport.getState',
] as const;

export const NATIVE_DSP_COMMANDS = [
  'dsp.applySnapshot',
  'dsp.setParameter',
  'dsp.setRootBypass',
  'dsp.resetStage',
  'dsp.resetAll',
  'dsp.setAuditionState',
  'dsp.setTrackIdentity',
  'dsp.setTrackLevelTargets',
  'dsp.prepareLinearPhaseKernel',
  'dsp.cancelPreparedChange',
  'dsp.getAppliedSnapshot',
] as const;

export const NATIVE_ANALYSIS_COMMANDS = [
  'analysis.measureTrack',
  'analysis.cancelTrack',
  'analysis.getTrackStatus',
  'analysis.invalidateTrack',
  'analysis.measureProcessedReference',
] as const;

export const NATIVE_DIAGNOSTICS_COMMANDS = [
  'diagnostics.getHealth',
  'diagnostics.getPerformanceSnapshot',
  'diagnostics.setDevelopmentSafetyBypass',
  'diagnostics.flushNonRealtimeLog',
] as const;

export const NATIVE_COMMANDS = [
  ...NATIVE_ENGINE_COMMANDS,
  ...NATIVE_TRANSPORT_COMMANDS,
  ...NATIVE_DSP_COMMANDS,
  ...NATIVE_ANALYSIS_COMMANDS,
  ...NATIVE_DIAGNOSTICS_COMMANDS,
] as const;

export type TNativeCommand = (typeof NATIVE_COMMANDS)[number];

/**
 * Monotonic per session, and the reason a slow reply cannot undo a fast one.
 *
 * The renderer's store moves optimistically while a drag is in flight, so an
 * acknowledgement is only ever allowed to correct state that is still the
 * latest. A revision older than what the store already holds is dropped.
 */
export type TSettingsRevision = number;

export interface INativeControlRequest {
  readonly protocolVersion: typeof NATIVE_DSP_PROTOCOL_VERSION;
  readonly engineSessionId: TEngineSessionId;
  readonly requestId: number;
  readonly settingsRevision: TSettingsRevision;
  readonly command: TNativeCommand;
  readonly payload?: unknown;
}

export type TNativeAckStatus =
  'applied' | 'prepared' | 'coalesced' | 'rejected' | 'unsupported';

export interface INativeControlAck {
  readonly protocolVersion: typeof NATIVE_DSP_PROTOCOL_VERSION;
  readonly engineSessionId: TEngineSessionId;
  readonly requestId: number;
  readonly acceptedRevision: TSettingsRevision;
  /**
   * The frame at which the change became audible, recorded by the audio thread
   * into a preallocated ring and drained by the telemetry thread. The callback
   * never sends this itself — sending is an OS call and the callback makes none.
   */
  readonly appliedAtSampleFrame?: number;
  readonly status: TNativeAckStatus;
  /**
   * What the host actually holds, when it refused what was asked.
   *
   * A rejection publishes this back into the store so a dial cannot be left
   * showing a value the engine is not using. Absent on every other status.
   */
  readonly sanitizedValue?: number | boolean | string;
  readonly reason?: string;
}

/**
 * One continuous control moving, on the fast path.
 *
 * Deliberately not a snapshot: a drag produces these at pointer rate, the host
 * keeps only the newest per `(id, index)` pair, and the processor smooths
 * toward it. Keeping a backlog of every pixel would make the engine replay a
 * gesture that has already ended.
 */
export interface INativeParameterUpdate {
  readonly id: TNativeParameterId;
  /** The band, for a `[]` path. Absent for everything else. */
  readonly index?: number;
  /** Enums travel as their vocabulary index — see `encodeNativeEnum`. */
  readonly value: number;
  readonly settingsRevision: TSettingsRevision;
}

export interface INativeDeckTelemetry {
  readonly deck: TDeckId;
  readonly state: 'empty' | 'loading' | 'ready' | 'playing' | 'paused';
  readonly positionSeconds: number;
  readonly durationSeconds: number;
  /** 0 while no fade is running, 1 the instant the incoming deck owns output. */
  readonly crossfadeProgress: number;
}

export interface INativeLevelTelemetry {
  /** Per channel, in real dBFS. Never a copy of the left standing in for a right. */
  readonly peakDb: readonly number[];
  readonly truePeakDb: readonly number[];
  readonly gainReductionDb: number;
}

/**
 * The four gains that the Master target question turns on, published apart.
 *
 * Summing them into one number is what made the panel unable to answer "why is
 * it quieter than I asked for" — a ceiling winning and a target being met look
 * identical once added together.
 */
export interface INativeMasterTelemetry {
  readonly manualOutputGainDb: number;
  readonly loudnessCorrectionDb: number;
  readonly autoHeadroomReductionDb: number;
  readonly appliedGainDb: number;
}

export interface INativeSafetyTelemetry {
  readonly dcCorrectionDb: number;
  readonly repairedSamples: number;
  readonly emergencyEngaged: boolean;
}

/**
 * What the callback cost, as a distribution rather than an average.
 *
 * An average callback time cannot fail an acceptance gate: one block in a
 * thousand overrunning its deadline is an audible click and moves the mean by
 * nothing at all. The gate is written against p99 for that reason.
 */
export interface INativePerformanceTelemetry {
  readonly callbackP50Ms: number;
  readonly callbackP99Ms: number;
  readonly callbackDeadlineMs: number;
  readonly xruns: number;
  readonly telemetryDrops: number;
}

export interface INativeTelemetryFrame {
  readonly protocolVersion: typeof NATIVE_DSP_PROTOCOL_VERSION;
  readonly engineSessionId: TEngineSessionId;
  /** Monotonic, so a frame that arrives out of order can be dropped. */
  readonly sequence: number;
  readonly engineState: TEngineState;
  readonly backend: string;
  readonly sampleRate: number;
  readonly blockFrames: number;
  readonly latencyFrames: number;
  readonly oversampleFactor: number;
  readonly appliedRevision: TSettingsRevision;
  readonly decks: readonly INativeDeckTelemetry[];
  /** Final output spectrum, already binned by the analysis thread. */
  readonly spectrum: readonly number[];
  readonly normalizer: INativeLevelTelemetry;
  readonly exciterBands: readonly number[];
  readonly exciterOrganic: number;
  readonly eqBandLevels: readonly number[];
  readonly eqBandDynamics: readonly number[];
  readonly compressorGainReductionDb: readonly number[];
  readonly maximizerGainReductionDb: number;
  readonly master: INativeMasterTelemetry;
  readonly correlation: number;
  readonly safety: INativeSafetyTelemetry;
  readonly performance: INativePerformanceTelemetry;
}

/**
 * What main learns before it is willing to speak to a host at all.
 *
 * The build revision is in here so a support report can say which host was
 * running, which is not answerable from the app's own version once a host can
 * be rebuilt independently of it.
 */
export interface INativeHostHandshake {
  readonly protocolVersion: number;
  readonly parameterSchemaVersion: number;
  readonly diagnosticSchemaVersion: number;
  readonly engineSessionId: TEngineSessionId;
  readonly coreVersion: string;
  readonly architecture: string;
  readonly buildRevision: string;
}

const COMMANDS = new Set<string>(NATIVE_COMMANDS);
const ACK_STATUSES = new Set<string>([
  'applied',
  'prepared',
  'coalesced',
  'rejected',
  'unsupported',
]);

export const isNativeCommand = (value: unknown): value is TNativeCommand =>
  typeof value === 'string' && COMMANDS.has(value);

/**
 * The trust boundary. Everything below crosses a process edge.
 *
 * A host is a separate executable that can be a different build from the app
 * talking to it, so its replies are parsed rather than assumed — the same
 * treatment `isDspDiagnosticEvent` already gives the worklet's messages.
 */
export const isNativeControlAck = (
  value: unknown,
): value is INativeControlAck => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const ack = value as Partial<INativeControlAck>;
  if (
    ack.protocolVersion !== NATIVE_DSP_PROTOCOL_VERSION ||
    typeof ack.engineSessionId !== 'string' ||
    !Number.isInteger(ack.requestId) ||
    !Number.isInteger(ack.acceptedRevision) ||
    !ACK_STATUSES.has(ack.status as string)
  ) {
    return false;
  }
  if (
    ack.appliedAtSampleFrame !== undefined &&
    (!Number.isFinite(ack.appliedAtSampleFrame) || ack.appliedAtSampleFrame < 0)
  ) {
    return false;
  }
  if (ack.sanitizedValue !== undefined) {
    const kind = typeof ack.sanitizedValue;
    if (kind === 'number') {
      return Number.isFinite(ack.sanitizedValue as number);
    }
    if (kind !== 'boolean' && kind !== 'string') {
      return false;
    }
  }
  return true;
};

const isFiniteNumberArray = (value: unknown): value is readonly number[] =>
  Array.isArray(value) && value.every((entry) => Number.isFinite(entry));

const isLevelTelemetry = (value: unknown): value is INativeLevelTelemetry => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const level = value as Partial<INativeLevelTelemetry>;
  return (
    isFiniteNumberArray(level.peakDb) &&
    isFiniteNumberArray(level.truePeakDb) &&
    Number.isFinite(level.gainReductionDb)
  );
};

/**
 * A telemetry frame is validated but never trusted to be complete.
 *
 * The scalars are checked because a NaN reaching a meter paints nothing and
 * gives no clue why; the arrays are checked for finiteness for the same reason.
 * A frame that fails is dropped rather than repaired — a repaired frame is a
 * reading nobody took, and a meter is the one place that must not invent one.
 */
export const isNativeTelemetryFrame = (
  value: unknown,
): value is INativeTelemetryFrame => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const frame = value as Partial<INativeTelemetryFrame>;
  if (
    frame.protocolVersion !== NATIVE_DSP_PROTOCOL_VERSION ||
    typeof frame.engineSessionId !== 'string' ||
    !Number.isInteger(frame.sequence) ||
    typeof frame.backend !== 'string' ||
    !Number.isFinite(frame.sampleRate) ||
    !Number.isFinite(frame.blockFrames) ||
    !Number.isFinite(frame.latencyFrames) ||
    !Number.isFinite(frame.oversampleFactor) ||
    !Number.isInteger(frame.appliedRevision) ||
    !Number.isFinite(frame.correlation)
  ) {
    return false;
  }
  return (
    isFiniteNumberArray(frame.spectrum) &&
    isFiniteNumberArray(frame.exciterBands) &&
    Number.isFinite(frame.exciterOrganic) &&
    isFiniteNumberArray(frame.eqBandLevels) &&
    isFiniteNumberArray(frame.eqBandDynamics) &&
    isFiniteNumberArray(frame.compressorGainReductionDb) &&
    Number.isFinite(frame.maximizerGainReductionDb) &&
    isLevelTelemetry(frame.normalizer) &&
    Array.isArray(frame.decks)
  );
};

/** A host diagnostic is an ordinary DSP diagnostic with `origin: 'native'`. */
export type TNativeDiagnostic = IDspDiagnosticEvent;
