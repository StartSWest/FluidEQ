/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Dynamics, the rack's three-band upward and downward compressor (engine
 * 1.27): its stored settings, its trailer on the rack's line, the line an
 * older engine is given, and its profiles.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { FilterTypeEnum } from '../../../common/constants';
import {
  clampDspSettings,
  DSP_DEFAULTS,
  IDspSettings,
} from '../../../common/dsp/chain';
import {
  appendPresetTone,
  chainWireLength,
  encodeChainSettings,
  hasDynamics,
  hasPresetTone,
  isChainWirePayload,
  legacyChainWithoutInactiveRoom,
  withoutDynamics,
} from '../../../common/dsp/chainWire';
import {
  DYNAMICS_PRESETS,
  dynamicsSettingsOf,
} from '../../../common/dsp/dynamicsPresets';
import {
  clampDynamicsSettings,
  DYNAMICS_DEFAULTS,
  IDynamicsSettings,
} from '../../../common/dsp/dynamicsStage';
import {
  CHAIN_DYNAMICS_TAG,
  CHAIN_DYNAMICS_TRAILER,
} from '../../../common/dsp/dynamicsWire';
import { engineReadsOf, lineForEngine } from '../../../common/dsp/engineLine';
import {
  ENGINE_DYNAMICS_SINCE,
  engineRunsDynamics,
} from '../../../common/engineHealth';

/** Each band unlike any other, so a value read from the wrong place shows. */
const TUNED: IDynamicsSettings = {
  enabled: true,
  presetId: '',
  bands: [
    {
      upThresholdDb: -45,
      upRatio: 1.5,
      upMaxDb: 6,
      downThresholdDb: -18,
      downRatio: 4,
    },
    {
      upThresholdDb: -42,
      upRatio: 2,
      upMaxDb: 9,
      downThresholdDb: -14,
      downRatio: 2,
    },
    {
      upThresholdDb: -48,
      upRatio: 2.5,
      upMaxDb: 5,
      downThresholdDb: -10,
      downRatio: 1,
    },
  ],
  attackMs: 8,
  releaseMs: 250,
  mix: 0.75,
  makeupDb: 1.5,
};

const rack = (more: Partial<IDspSettings> = {}): IDspSettings =>
  clampDspSettings({ ...DSP_DEFAULTS, enabled: true, ...more });

const tone = {
  matched: true,
  bands: [
    { type: FilterTypeEnum.PK, frequency: 3150, gain: 2.8, quality: 1.4 },
  ],
};

describe('a stored Dynamics read back', () => {
  it('reads a rack saved before the stage as one with it off and every band neutral', () => {
    expect(clampDynamicsSettings(undefined)).toEqual(DYNAMICS_DEFAULTS);
    expect(clampDspSettings({ enabled: true }).dynamics).toEqual(
      DYNAMICS_DEFAULTS,
    );
  });

  it('holds every value to the engine’s own range, and a missing band neutral', () => {
    const read = clampDynamicsSettings({
      enabled: true,
      presetId: 'gentle',
      bands: [
        {
          upThresholdDb: -200,
          upRatio: 9,
          upMaxDb: 40,
          downThresholdDb: 5,
          downRatio: 0,
        },
      ],
      attackMs: 0,
      releaseMs: 5000,
      mix: 2,
      makeupDb: Number.NaN,
    });
    expect(read).toEqual({
      enabled: true,
      presetId: 'gentle',
      bands: [
        {
          upThresholdDb: -80,
          upRatio: 4,
          upMaxDb: 18,
          downThresholdDb: 0,
          downRatio: 1,
        },
        DYNAMICS_DEFAULTS.bands[1],
        DYNAMICS_DEFAULTS.bands[2],
      ],
      attackMs: 1,
      releaseMs: 1000,
      mix: 1,
      makeupDb: 0,
    });
  });
});

describe('Dynamics on the rack’s line', () => {
  it('leaves a rack without it the line it always was', () => {
    const plain = encodeChainSettings(rack());
    expect(plain).not.toContain(CHAIN_DYNAMICS_TAG);
    expect(
      encodeChainSettings(rack({ dynamics: { ...TUNED, enabled: false } })),
    ).toEqual(plain);
  });

  it('stands after a game word written off, every value where the engine reads it', () => {
    const line = encodeChainSettings(rack({ dynamics: TUNED }));
    const gameWord = chainWireLength(DSP_DEFAULTS.eq.bands.length);
    expect(line[gameWord]).toBe(0);
    expect(line.slice(gameWord + 1)).toEqual([
      CHAIN_DYNAMICS_TAG,
      1,
      20,
      1,
      ...[-45, 1.5, 6, -18, 4],
      ...[-42, 2, 9, -14, 2],
      ...[-48, 2.5, 5, -10, 1],
      8,
      250,
      0.75,
      1.5,
    ]);
    expect(isChainWirePayload(line)).toBe(true);
    expect(hasDynamics(line)).toBe(true);
  });

  it('is refused at the boundary when it is not one the engine reads', () => {
    const line = encodeChainSettings(rack({ dynamics: TUNED }));
    const at = line.indexOf(CHAIN_DYNAMICS_TAG);
    const broken = (index: number, value: number) => {
      const copy = [...line];
      copy[index] = value;
      return copy;
    };
    expect(isChainWirePayload(broken(at + 1, 2))).toBe(false);
    expect(isChainWirePayload(broken(at + 2, 19))).toBe(false);
    expect(isChainWirePayload(broken(at + 3, 0.5))).toBe(false);
    // The first band's lift threshold, the last band's hold ratio, and the
    // make-up last of all.
    expect(isChainWirePayload(broken(at + 4, -81))).toBe(false);
    expect(isChainWirePayload(broken(at + 18, 21))).toBe(false);
    expect(isChainWirePayload(broken(at + 22, 13))).toBe(false);
    expect(isChainWirePayload(line.slice(0, -1))).toBe(false);
  });

  it('is taken off for an engine before 1.27, the curve after it kept', () => {
    const before = encodeChainSettings(rack());
    const line = encodeChainSettings(rack({ dynamics: TUNED }));
    // The game word was written only for the trailer to stand after.
    expect(withoutDynamics(line)).toEqual(before);
    const withCurve = appendPresetTone(line, tone);
    const older = lineForEngine(withCurve, engineReadsOf('1.26.0.0'));
    expect(hasDynamics(older)).toBe(false);
    expect(hasPresetTone(older)).toBe(true);
    // Exactly the line that rack would be with Dynamics switched off.
    expect(older).toEqual(appendPresetTone(before, tone));
    expect(older).toHaveLength(withCurve.length - CHAIN_DYNAMICS_TRAILER);
    expect(lineForEngine(withCurve, engineReadsOf('1.27.0.0'))).toEqual(
      withCurve,
    );
    expect(hasDynamics(legacyChainWithoutInactiveRoom(withCurve) ?? [])).toBe(
      false,
    );
  });

  it('is run by engine 1.27 and later', () => {
    expect(ENGINE_DYNAMICS_SINCE).toEqual([1, 27]);
    expect(engineRunsDynamics('1.26.9.0')).toBe(false);
    expect(engineRunsDynamics('1.27.0.0')).toBe(true);
    expect(engineRunsDynamics(undefined)).toBe(false);
  });
});

/**
 * The engine's own test decodes lines frozen from this encoder
 * (`dynamics_line_fixture.h`). Were the encoder to change and the header not,
 * the engine would go on passing against a line the app no longer writes:
 * so the header is read here and written again from the same settings.
 */
describe('the lines the engine is tested with', () => {
  const header = readFileSync(
    join(
      __dirname,
      '../../../../native/system-apo/tests/dynamics_line_fixture.h',
    ),
    'utf8',
  );
  const fixture = (name: string): number[] => {
    const start = header.indexOf(`${name} =`);
    const end = header.indexOf(';', start);
    if (start < 0 || end < 0) {
      throw new Error(`${name} is not in the fixture`);
    }
    const text = [...header.slice(start, end).matchAll(/"([^"]*)"/g)]
      .map((match) => match[1])
      .join('');
    return text.trim().split(/\s+/).map(Number);
  };
  const both = rack({
    gameMode: true,
    footsteps: {
      ...DSP_DEFAULTS.footsteps,
      enabled: true,
      lift: 0.85,
      calm: 0.5,
    },
    dynamics: TUNED,
  });

  it('are what the encoder writes today', () => {
    expect(encodeChainSettings(both)).toEqual(fixture('kDynamicsBothLine'));
    expect(appendPresetTone(encodeChainSettings(both), tone)).toEqual(
      fixture('kDynamicsToneLine'),
    );
    expect(encodeChainSettings(rack({ dynamics: TUNED }))).toEqual(
      fixture('kDynamicsAloneLine'),
    );
  });
});

describe('Dynamics profiles', () => {
  it('offers nine everyday profiles and keeps the five gaming profiles', () => {
    expect(DYNAMICS_PRESETS.map((preset) => preset.id)).toEqual([
      'gentle',
      'transparent',
      'punch',
      'acoustic',
      'vocal',
      'warm',
      'movie',
      'lateNight',
      'speech',
      'gameQuietLift',
      'gameBlastGuard',
      'gameNight',
      'gameLongSession',
      'gameCompetitiveLight',
    ]);
  });

  it('every one survives the stage’s clamp unchanged, and never decides whether it runs', () => {
    DYNAMICS_PRESETS.forEach((preset) => {
      const settings = dynamicsSettingsOf(preset, true);
      expect(clampDynamicsSettings(settings)).toEqual(settings);
      expect(dynamicsSettingsOf(preset, false).enabled).toBe(false);
      expect(
        isChainWirePayload(encodeChainSettings(rack({ dynamics: settings }))),
      ).toBe(true);
    });
  });

  it('hands out its own bands, so editing a stage never edits the table', () => {
    const [first] = DYNAMICS_PRESETS;
    const settings = dynamicsSettingsOf(first, true);
    settings.bands[0].upRatio = 3.9;
    expect(first.settings.bands[0].upRatio).not.toBe(3.9);
  });
});
