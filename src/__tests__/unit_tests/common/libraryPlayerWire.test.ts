/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the window may send the core's Library player, checked whole
 * (`common/library/playerWire.ts`, `playerRack.ts`), the level a measured
 * song is played at (`common/dsp/trackGains.ts`), and when an overlap starts
 * (`common/library/crossfadeTiming.ts`).
 */
import { DSP_DEFAULTS } from '../../../common/dsp/chain';
import { FilterTypeEnum } from '../../../common/constants';
import {
  masterLoudnessGainDb,
  normalizerGainBreakdown,
  normalizerGainDb,
} from '../../../common/dsp/trackGains';
import {
  isCrossfadeDue,
  leadInStartMs,
} from '../../../common/library/crossfadeTiming';
import {
  parsePlayerRackCopy,
  parsePresetTone,
} from '../../../common/library/playerRack';
import {
  parseDeckReport,
  parsePlayerCommand,
} from '../../../common/library/playerWire';

describe('a press from the window', () => {
  it('is taken as sent when it is whole', () => {
    expect(
      parsePlayerCommand({
        kind: 'play',
        trackIds: ['a', 'b'],
        startTrackId: 'a',
      }),
    ).toEqual({ kind: 'play', trackIds: ['a', 'b'], startTrackId: 'a' });
    expect(parsePlayerCommand({ kind: 'skip', direction: -1 })).toEqual({
      kind: 'skip',
      direction: -1,
    });
    expect(
      parsePlayerCommand({ kind: 'add', trackIds: ['x'], beforeIds: ['b'] }),
    ).toEqual({ kind: 'add', trackIds: ['x'], beforeIds: ['b'] });
    expect(parsePlayerCommand({ kind: 'stop', extra: 1 })).toEqual({
      kind: 'stop',
    });
  });

  it('is refused when any part of it is wrong', () => {
    expect(
      parsePlayerCommand({
        kind: 'play',
        trackIds: ['a', 7],
        startTrackId: 'a',
      }),
    ).toBeUndefined();
    expect(
      parsePlayerCommand({ kind: 'play', trackIds: ['a'], startTrackId: '' }),
    ).toBeUndefined();
    expect(parsePlayerCommand({ kind: 'skip', direction: 2 })).toBeUndefined();
    expect(
      parsePlayerCommand({ kind: 'seek', positionMs: -1 }),
    ).toBeUndefined();
    expect(
      parsePlayerCommand({ kind: 'seek', positionMs: Number.NaN }),
    ).toBeUndefined();
    expect(parsePlayerCommand({ kind: 'jump', position: 1.5 })).toBeUndefined();
    expect(
      parsePlayerCommand({ kind: 'add', trackIds: ['x'], beforeIds: 'b' }),
    ).toBeUndefined();
    expect(
      parsePlayerCommand({ kind: 'retarget', trackIds: ['x'], listKey: '' }),
    ).toBeUndefined();
    expect(
      parsePlayerCommand({ kind: 'continuation', isOn: 'yes' }),
    ).toBeUndefined();
    expect(parsePlayerCommand({ kind: 'format the disk' })).toBeUndefined();
    expect(parsePlayerCommand(null)).toBeUndefined();
  });
});

describe('what the window’s element reports', () => {
  it('is taken for a song it names', () => {
    expect(
      parseDeckReport({
        kind: 'clock',
        trackId: 'a',
        positionMs: 5,
        durationMs: 9,
      }),
    ).toEqual({
      kind: 'clock',
      trackId: 'a',
      positionMs: 5,
      durationMs: 9,
    });
    expect(
      parseDeckReport({ kind: 'playing', trackId: 'a', isPlaying: false }),
    ).toEqual({
      kind: 'playing',
      trackId: 'a',
      isPlaying: false,
    });
    expect(parseDeckReport({ kind: 'ended', trackId: 'a' })).toEqual({
      kind: 'ended',
      trackId: 'a',
    });
  });

  it('is refused without a song, or with a clock that is not one', () => {
    expect(parseDeckReport({ kind: 'ended' })).toBeUndefined();
    expect(
      parseDeckReport({
        kind: 'clock',
        trackId: 'a',
        positionMs: -5,
        durationMs: 9,
      }),
    ).toBeUndefined();
    expect(parseDeckReport({ kind: 'playing', trackId: 'a' })).toBeUndefined();
    expect(parseDeckReport({ kind: 'seek', trackId: 'a' })).toBeUndefined();
  });
});

describe('the rack the window hands over', () => {
  const gate = {
    engine: 'fluid',
    eqEnabled: true,
    eqLoaded: true,
    engineOff: false,
  };

  it('is clamped and kept with its curve and half of the gate', () => {
    const copy = parsePlayerRackCopy({
      settings: { ...DSP_DEFAULTS, enabled: true },
      tone: {
        bands: [
          { type: FilterTypeEnum.PK, frequency: 100, gain: 3, quality: 1 },
        ],
        matched: true,
      },
      gate: { ...gate, sendingRawAudio: true },
    });
    expect(copy?.settings.enabled).toBe(true);
    expect(copy?.tone?.bands).toHaveLength(1);
    expect(copy?.gate).toEqual({ ...gate, sendingRawAudio: true });
  });

  it('takes an engine not chosen yet', () => {
    expect(
      parsePlayerRackCopy({
        settings: DSP_DEFAULTS,
        gate: { ...gate, engine: null },
      })?.gate.engine,
    ).toBeNull();
  });

  it('is refused with a gate that is not one, or a curve with a bad band', () => {
    expect(
      parsePlayerRackCopy({
        settings: DSP_DEFAULTS,
        gate: { ...gate, engine: 'winamp' },
      }),
    ).toBeUndefined();
    expect(
      parsePlayerRackCopy({
        settings: DSP_DEFAULTS,
        gate: { ...gate, eqLoaded: 'yes' },
      }),
    ).toBeUndefined();
    expect(
      parsePlayerRackCopy({
        settings: DSP_DEFAULTS,
        tone: {
          bands: [
            {
              type: FilterTypeEnum.PK,
              frequency: Number.NaN,
              gain: 3,
              quality: 1,
            },
          ],
          matched: true,
        },
        gate,
      }),
    ).toBeUndefined();
  });

  it('refuses a curve longer than the host takes', () => {
    const band = {
      type: FilterTypeEnum.PK,
      frequency: 100,
      gain: 1,
      quality: 1,
    };
    expect(
      parsePresetTone({ bands: Array(49).fill(band), matched: false }),
    ).toBeUndefined();
    expect(
      parsePresetTone({ bands: Array(48).fill(band), matched: false })?.bands,
    ).toHaveLength(48);
  });
});

describe('the level a measured song is played at', () => {
  const normalizer = {
    ...DSP_DEFAULTS.normalizer,
    mode: 'loudness' as const,
    targetLufs: -14,
    truePeakDbtp: -1,
  };
  const song = { version: 2 as const, integratedLufs: -20, truePeakDbtp: -10 };

  it('brings a quiet song up to the target', () => {
    expect(normalizerGainDb(normalizer, song)).toBeCloseTo(6);
  });

  it('stops at the true-peak ceiling and says so', () => {
    const peaky = { ...song, truePeakDbtp: -3 };
    expect(normalizerGainBreakdown(normalizer, peaky)).toMatchObject({
      appliedDb: 2,
      limitedBy: 'ceiling',
    });
  });

  it('does nothing while off or unmeasured, and leaves a silent song alone', () => {
    expect(normalizerGainDb({ ...normalizer, mode: 'off' }, song)).toBe(0);
    expect(normalizerGainDb(normalizer, undefined)).toBe(0);
    expect(
      normalizerGainBreakdown(normalizer, { ...song, integratedLufs: -80 })
        .limitedBy,
    ).toBe('gate');
  });

  it('gives Master no makeup while its loudness switch is off', () => {
    expect(
      masterLoudnessGainDb(
        { ...DSP_DEFAULTS.master, enabled: true, loudnessMaximize: false },
        normalizer,
        song,
      ),
    ).toBe(0);
  });
});

describe('when the next song fades in', () => {
  it('starts the fade its length before the music ends', () => {
    const edges = { leadInMs: 0, endMs: 150_000 };
    expect(
      isCrossfadeDue({
        positionMs: 146_999,
        durationMs: 200_000,
        edges,
        fadeMs: 3_000,
      }),
    ).toBe(false);
    expect(
      isCrossfadeDue({
        positionMs: 147_000,
        durationMs: 200_000,
        edges,
        fadeMs: 3_000,
      }),
    ).toBe(true);
  });

  it('uses the file’s end without a measurement, and never past it', () => {
    expect(
      isCrossfadeDue({
        positionMs: 197_000,
        durationMs: 200_000,
        edges: undefined,
        fadeMs: 3_000,
      }),
    ).toBe(true);
    expect(
      isCrossfadeDue({
        positionMs: 200_000,
        durationMs: 200_000,
        edges: undefined,
        fadeMs: 3_000,
      }),
    ).toBe(false);
    expect(
      isCrossfadeDue({
        positionMs: 0,
        durationMs: 0,
        edges: undefined,
        fadeMs: 3_000,
      }),
    ).toBe(false);
  });

  it('comes in at its music when its silence is worth a seek', () => {
    expect(leadInStartMs({ leadInMs: 249, endMs: 1 })).toBe(0);
    expect(leadInStartMs({ leadInMs: 250, endMs: 1 })).toBe(250);
    expect(leadInStartMs(undefined)).toBe(0);
  });
});
