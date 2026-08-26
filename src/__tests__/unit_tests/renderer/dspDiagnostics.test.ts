/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import log from 'electron-log/renderer';
import {
  DSP_DIAGNOSTIC_CODES,
  DSP_DIAGNOSTIC_SCHEMA_VERSION,
} from '../../../common/dsp/diagnostics';
import {
  reportDspDiagnostic,
  resetDspDiagnosticsForTests,
} from '../../../renderer/dsp/diagnostics';

jest.mock('electron-log/renderer', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('DSP diagnostics boundary', () => {
  beforeEach(() => {
    resetDspDiagnosticsForTests();
    jest.clearAllMocks();
  });

  it('validates and writes a structured native-compatible event', () => {
    expect(
      reportDspDiagnostic({
        schemaVersion: DSP_DIAGNOSTIC_SCHEMA_VERSION,
        code: DSP_DIAGNOSTIC_CODES.crossfadeMixerFallback,
        severity: 'warn',
        origin: 'renderer',
        values: { durationMs: 2_000, curve: 'equalPower' },
      }),
    ).toBe(true);
    expect(log.warn).toHaveBeenCalledWith(
      '[dsp:renderer] code=2001',
      expect.objectContaining({ durationMs: 2_000, curve: 'equalPower' }),
    );
  });

  it('rate-limits duplicate events and rejects malformed bridge data', () => {
    const event = {
      schemaVersion: DSP_DIAGNOSTIC_SCHEMA_VERSION,
      code: DSP_DIAGNOSTIC_CODES.crossfadePlayFailed,
      severity: 'error' as const,
      origin: 'native' as const,
      sampleFrame: 48_000,
      values: { nativeError: 7 },
    };
    expect(reportDspDiagnostic(event)).toBe(true);
    expect(reportDspDiagnostic(event)).toBe(false);
    expect(
      reportDspDiagnostic({ ...event, values: { nativeError: Infinity } }),
    ).toBe(false);
    expect(log.error).toHaveBeenCalledTimes(1);
  });
});
