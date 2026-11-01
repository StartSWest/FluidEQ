/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What crosses between main and the core's process (`core/process/
 * coreWire.ts`), read whole on arrival: a message of the right shape is
 * taken as it is meant, anything else is dropped rather than half-read.
 */
import { parseFromCore, parseToCore } from 'core/process/coreWire';

describe('what main sends the core', () => {
  it('is taken as sent when whole', () => {
    expect(parseToCore({ kind: 'port', id: 3 })).toEqual({
      kind: 'port',
      id: 3,
    });
    expect(parseToCore({ kind: 'desktop-want', wanted: true })).toEqual({
      kind: 'desktop-want',
      wanted: true,
    });
    expect(
      parseToCore({
        kind: 'clock-follow',
        id: 1,
        secondsPerStep: 0.25,
        wanted: false,
        extra: 'dropped',
      }),
    ).toEqual({
      kind: 'clock-follow',
      id: 1,
      secondsPerStep: 0.25,
      wanted: false,
    });
    expect(
      parseToCore({
        kind: 'headroom-follow',
        state: { enabled: true, trimDb: -1.5, hasLegacyProgramme: false, x: 1 },
      }),
    ).toEqual({
      kind: 'headroom-follow',
      state: { enabled: true, trimDb: -1.5, hasLegacyProgramme: false },
    });
    expect(parseToCore({ kind: 'trim-result', id: 2, applied: false })).toEqual(
      { kind: 'trim-result', id: 2, applied: false },
    );
    expect(parseToCore({ kind: 'headroom-edited' })).toEqual({
      kind: 'headroom-edited',
    });
  });

  it('is dropped when any part is wrong', () => {
    expect(parseToCore({ kind: 'port', id: -1 })).toBeUndefined();
    expect(parseToCore({ kind: 'port', id: 1.5 })).toBeUndefined();
    expect(
      parseToCore({ kind: 'desktop-want', wanted: 'yes' }),
    ).toBeUndefined();
    expect(
      parseToCore({
        kind: 'clock-follow',
        id: 1,
        secondsPerStep: 0,
        wanted: true,
      }),
    ).toBeUndefined();
    expect(
      parseToCore({
        kind: 'clock-follow',
        id: 1,
        secondsPerStep: Number.NaN,
        wanted: true,
      }),
    ).toBeUndefined();
    expect(
      parseToCore({
        kind: 'headroom-follow',
        state: { enabled: true, trimDb: Infinity, hasLegacyProgramme: false },
      }),
    ).toBeUndefined();
    expect(parseToCore({ kind: 'trim-result', id: 1 })).toBeUndefined();
    expect(parseToCore({ kind: 'unknown' })).toBeUndefined();
    expect(parseToCore(null)).toBeUndefined();
  });
});

describe('what the core sends main', () => {
  it('is taken as sent when whole', () => {
    expect(parseFromCore({ kind: 'ready' })).toEqual({ kind: 'ready' });
    expect(
      parseFromCore({ kind: 'log', level: 'warn', message: 'helper gone' }),
    ).toEqual({ kind: 'log', level: 'warn', message: 'helper gone' });
    expect(parseFromCore({ kind: 'clock-step', id: 4 })).toEqual({
      kind: 'clock-step',
      id: 4,
    });
    const frame = { points: [], waveform: [0], stereo: [0.1, 0.9] };
    expect(parseFromCore({ kind: 'desktop-frame', id: 1, frame })).toEqual({
      kind: 'desktop-frame',
      id: 1,
      frame,
    });
    expect(parseFromCore({ kind: 'trim', id: 1, trimDb: -3 })).toEqual({
      kind: 'trim',
      id: 1,
      trimDb: -3,
    });
    expect(parseFromCore({ kind: 'desktop-serves', serves: false })).toEqual({
      kind: 'desktop-serves',
      serves: false,
    });
  });

  it('is dropped when any part is wrong', () => {
    expect(
      parseFromCore({ kind: 'log', level: 'debug', message: 'x' }),
    ).toBeUndefined();
    expect(
      parseFromCore({ kind: 'desktop-frame', id: 1, frame: { points: [] } }),
    ).toBeUndefined();
    expect(
      parseFromCore({
        kind: 'desktop-frame',
        id: 1,
        frame: { points: [], waveform: [], stereo: [1] },
      }),
    ).toBeUndefined();
    expect(
      parseFromCore({ kind: 'trim', id: 1, trimDb: 'loud' }),
    ).toBeUndefined();
    expect(parseFromCore({ kind: 'desktop-serves' })).toBeUndefined();
    expect(parseFromCore('ready')).toBeUndefined();
  });
});
