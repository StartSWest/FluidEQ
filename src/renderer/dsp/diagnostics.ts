/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import log from 'electron-log/renderer';
import {
  IDspDiagnosticEvent,
  isDspDiagnosticEvent,
  TDspDiagnosticValue,
} from '../../common/dsp/diagnostics';

const REPEAT_WINDOW_MS = 2_000;
const lastWrittenAt = new Map<string, number>();

const eventKey = (event: IDspDiagnosticEvent): string =>
  `${event.origin}:${event.code}:${JSON.stringify(event.values ?? {})}`;

/**
 * The one renderer-side DSP log sink.
 *
 * Worklets and the future C++ bridge post the same event shape here. This
 * thread performs validation, deduplication and formatting so the audio
 * callback never blocks on logging or allocates diagnostic strings.
 */
export const reportDspDiagnostic = (candidate: unknown): boolean => {
  if (!isDspDiagnosticEvent(candidate)) {
    return false;
  }
  const now = Date.now();
  const key = eventKey(candidate);
  const previous = lastWrittenAt.get(key);
  if (previous !== undefined && now - previous < REPEAT_WINDOW_MS) {
    return false;
  }
  lastWrittenAt.set(key, now);
  const label = `[dsp:${candidate.origin}] code=${candidate.code}`;
  const details = {
    ...(candidate.sampleFrame === undefined
      ? {}
      : { sampleFrame: candidate.sampleFrame }),
    ...(candidate.values ?? {}),
  };
  log[candidate.severity](label, details);
  return true;
};

export const dspErrorValues = (
  error: unknown,
): Readonly<Record<string, TDspDiagnosticValue>> => {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack ?? null,
    };
  }
  return { errorMessage: String(error) };
};

/** Test seam for the module-level rate limiter. */
export const resetDspDiagnosticsForTests = (): void => {
  lastWrittenAt.clear();
};
