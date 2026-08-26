/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Stable diagnostics contract shared by today's renderer/worklet engine and
 * the future native DSP bridge.
 *
 * Native real-time code must only enqueue the compact code/severity/value
 * fields into a preallocated lock-free ring. Formatting, rate limiting and
 * disk I/O belong to the control/renderer thread that drains that ring.
 */
export const DSP_DIAGNOSTIC_SCHEMA_VERSION = 1 as const;

export const DSP_DIAGNOSTIC_CODES = {
  engineStartFailed: 1001,
  engineResumeFailed: 1002,
  crossfadeMixerFallback: 2001,
  crossfadeDeckFallback: 2002,
  crossfadeAutomationFallback: 2003,
  crossfadePlayFailed: 2004,
  /**
   * The native host, 3000-up. Appended rather than interleaved: these codes
   * reach support reports and a renumbering would make an old report describe
   * a different fault than the one that happened.
   */
  hostSpawnFailed: 3001,
  hostHandshakeRejected: 3002,
  hostExited: 3003,
  hostRestartBudgetExhausted: 3004,
  hostStreamDesynchronised: 3005,
} as const;

export type TDspDiagnosticCode =
  (typeof DSP_DIAGNOSTIC_CODES)[keyof typeof DSP_DIAGNOSTIC_CODES];
export type TDspDiagnosticSeverity = 'debug' | 'info' | 'warn' | 'error';
export type TDspDiagnosticOrigin = 'renderer' | 'worklet' | 'native';
export type TDspDiagnosticValue = string | number | boolean | null;

export interface IDspDiagnosticEvent {
  schemaVersion: typeof DSP_DIAGNOSTIC_SCHEMA_VERSION;
  code: TDspDiagnosticCode;
  severity: TDspDiagnosticSeverity;
  origin: TDspDiagnosticOrigin;
  /** Audio-frame position supplied by a worklet/native engine when known. */
  sampleFrame?: number;
  values?: Readonly<Record<string, TDspDiagnosticValue>>;
}

const CODES = new Set<number>(Object.values(DSP_DIAGNOSTIC_CODES));
const SEVERITIES = new Set<TDspDiagnosticSeverity>([
  'debug',
  'info',
  'warn',
  'error',
]);
const ORIGINS = new Set<TDspDiagnosticOrigin>([
  'renderer',
  'worklet',
  'native',
]);

/** Trust boundary for events posted by an AudioWorklet or native bridge. */
export const isDspDiagnosticEvent = (
  value: unknown,
): value is IDspDiagnosticEvent => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const event = value as Partial<IDspDiagnosticEvent>;
  if (
    event.schemaVersion !== DSP_DIAGNOSTIC_SCHEMA_VERSION ||
    typeof event.code !== 'number' ||
    !CODES.has(event.code) ||
    !SEVERITIES.has(event.severity as TDspDiagnosticSeverity) ||
    !ORIGINS.has(event.origin as TDspDiagnosticOrigin) ||
    (event.sampleFrame !== undefined &&
      (!Number.isFinite(event.sampleFrame) || event.sampleFrame < 0))
  ) {
    return false;
  }
  if (event.values === undefined) {
    return true;
  }
  if (!event.values || typeof event.values !== 'object') {
    return false;
  }
  return Object.values(event.values).every(
    (entry) =>
      entry === null ||
      typeof entry === 'string' ||
      typeof entry === 'boolean' ||
      (typeof entry === 'number' && Number.isFinite(entry)),
  );
};
