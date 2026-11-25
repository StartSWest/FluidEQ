/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readFileSync } from 'fs';
import { join } from 'path';
import { FilterTypeEnum } from '../../../common/constants';
import { DSP_DEFAULTS } from '../../../common/dsp/chainDefaults';
import type { IDspSettings } from '../../../common/dsp/chainSettings';
import {
  appendPresetTone,
  CHAIN_TONE_TAG,
  encodeChainSettings,
  hasPresetTone,
  hasVoice,
  isChainWirePayload,
  voiceWithoutLevel,
  withoutVoice,
} from '../../../common/dsp/chainWire';
import {
  ENGINE_READS_ALL,
  engineReadsOf,
  lineForEngine,
} from '../../../common/dsp/engineLine';
import {
  clampVoiceSettings,
  IVoiceSettings,
  VOICE_DEFAULTS,
} from '../../../common/dsp/voiceStage';
import {
  CHAIN_VOICE_FIELDS,
  CHAIN_VOICE_LEVEL_TRAILER,
  CHAIN_VOICE_SCHEMA,
  CHAIN_VOICE_TAG,
  CHAIN_VOICE_TRAILER,
  voiceTrailer,
} from '../../../common/dsp/voiceWire';

const VOICE: IVoiceSettings = {
  enabled: true,
  lowCutHz: 95,
  proximityDb: 3.5,
  deplosive: 0.6,
  gateEnabled: true,
  gateThresholdDb: -47,
  gateRangeDb: 22,
  gateHoldMs: 180,
  gateAttackMs: 1.5,
  gateReleaseMs: 140,
  levelEnabled: true,
  levelTargetDb: -20,
  levelMaxLiftDb: 15,
};

const rack = (patch: Partial<IDspSettings>): IDspSettings => ({
  ...DSP_DEFAULTS,
  enabled: true,
  ...patch,
});

const tone = {
  matched: true,
  bands: [
    { type: FilterTypeEnum.PK, frequency: 3150, gain: 2.8, quality: 1.4 },
  ],
};

describe('a stored Voice read back', () => {
  it('is every value inside the range the engine accepts', () => {
    const read = clampVoiceSettings({
      enabled: true,
      lowCutHz: 5,
      proximityDb: 40,
      deplosive: 3,
      gateEnabled: true,
      gateThresholdDb: 0,
      gateRangeDb: -4,
      gateHoldMs: 99999,
      gateAttackMs: 0,
      gateReleaseMs: 1,
      levelEnabled: true,
      levelTargetDb: 3,
      levelMaxLiftDb: -6,
    });
    expect(read).toEqual({
      enabled: true,
      lowCutHz: 20,
      proximityDb: 12,
      deplosive: 1,
      gateEnabled: true,
      gateThresholdDb: -10,
      gateRangeDb: 0,
      gateHoldMs: 1000,
      gateAttackMs: 0.1,
      gateReleaseMs: 5,
      levelEnabled: true,
      levelTargetDb: -10,
      levelMaxLiftDb: 0,
    });
  });

  it('reads a Voice stored before Voice level with Voice level off, at its defaults', () => {
    const older = clampVoiceSettings({
      enabled: true,
      lowCutHz: 95,
      proximityDb: 3.5,
      deplosive: 0.6,
      gateEnabled: false,
      gateThresholdDb: -47,
      gateRangeDb: 22,
      gateHoldMs: 180,
      gateAttackMs: 1.5,
      gateReleaseMs: 140,
    });
    expect({
      levelEnabled: older.levelEnabled,
      levelTargetDb: older.levelTargetDb,
      levelMaxLiftDb: older.levelMaxLiftDb,
    }).toEqual({
      levelEnabled: false,
      levelTargetDb: VOICE_DEFAULTS.levelTargetDb,
      levelMaxLiftDb: VOICE_DEFAULTS.levelMaxLiftDb,
    });
  });

  it('keeps a low cut of 0 as off and reads garbage as the defaults', () => {
    expect(clampVoiceSettings({ ...VOICE, lowCutHz: 0 }).lowCutHz).toBe(0);
    expect(clampVoiceSettings('nonsense')).toEqual(VOICE_DEFAULTS);
    expect(clampVoiceSettings({ enabled: 'yes' }).enabled).toBe(false);
  });
});

describe('the Voice trailer on the rack line', () => {
  it('is written only while the stage is on', () => {
    const off = encodeChainSettings(
      rack({ voice: { ...VOICE, enabled: false } }),
    );
    expect(off).toEqual(encodeChainSettings(rack({})));
    expect(hasVoice(off)).toBe(false);
  });

  it('stands after Dynamics and before the curve, and the line is valid', () => {
    const line = appendPresetTone(
      encodeChainSettings(
        rack({
          gameMode: true,
          dynamics: { ...DSP_DEFAULTS.dynamics, enabled: true },
          voice: VOICE,
        }),
      ),
      tone,
    );
    expect(isChainWirePayload(line)).toBe(true);
    expect(hasVoice(line)).toBe(true);
    expect(hasPresetTone(line)).toBe(true);
    const at = line.indexOf(CHAIN_VOICE_TAG);
    // Schema 2 (engine 1.33): the gate, then Voice level's three.
    expect(line.slice(at, at + CHAIN_VOICE_LEVEL_TRAILER)).toEqual(
      voiceTrailer(VOICE),
    );
    expect(line[at + CHAIN_VOICE_LEVEL_TRAILER]).toBe(CHAIN_TONE_TAG);
  });

  it('is written as schema 1, without Voice level, for an engine from 1.31 to 1.32', () => {
    const line = appendPresetTone(
      encodeChainSettings(rack({ gameMode: true, voice: VOICE })),
      tone,
    );
    const older = voiceWithoutLevel(line);
    expect(isChainWirePayload(older)).toBe(true);
    expect(hasVoice(older)).toBe(true);
    expect(hasPresetTone(older)).toBe(true);
    const at = older.indexOf(CHAIN_VOICE_TAG);
    expect(older.slice(at, at + CHAIN_VOICE_TRAILER)).toEqual([
      CHAIN_VOICE_TAG,
      CHAIN_VOICE_SCHEMA,
      CHAIN_VOICE_FIELDS,
      ...voiceTrailer(VOICE).slice(3, CHAIN_VOICE_TRAILER),
    ]);
    expect(older).toHaveLength(
      line.length - (CHAIN_VOICE_LEVEL_TRAILER - CHAIN_VOICE_TRAILER),
    );
    expect(lineForEngine(line, engineReadsOf('1.31.0.0'))).toEqual(older);
    expect(lineForEngine(line, engineReadsOf('1.32.0.0'))).toEqual(older);
    expect(lineForEngine(line, engineReadsOf('1.33.0.0'))).toEqual(line);
  });

  it('is refused at the boundary when a value is out of range', () => {
    const line = encodeChainSettings(rack({ voice: VOICE }));
    const at = line.indexOf(CHAIN_VOICE_TAG);
    const bad = [...line];
    bad[at + 9] = 120; // range past 80 dB
    expect(isChainWirePayload(line)).toBe(true); // control
    expect(isChainWirePayload(bad)).toBe(false);
  });

  it('comes off for an engine older than 1.31, the curve kept', () => {
    const line = appendPresetTone(
      encodeChainSettings(rack({ voice: VOICE })),
      tone,
    );
    const stripped = withoutVoice(line);
    expect(hasVoice(stripped)).toBe(false);
    expect(hasPresetTone(stripped)).toBe(true);
    // Written with no game mode, the off game word went in only for the
    // trailer: it goes with it, so the line is what an older app wrote.
    expect(stripped).toEqual(
      appendPresetTone(encodeChainSettings(rack({})), tone),
    );
    expect(lineForEngine(line, engineReadsOf('1.30.0.0'))).toEqual(stripped);
    // From 1.31 the stage stays; Voice level waits for 1.33 (case above).
    expect(hasVoice(lineForEngine(line, engineReadsOf('1.31.0.0')))).toBe(true);
    expect(lineForEngine(line, ENGINE_READS_ALL)).toEqual(line);
  });
});

/**
 * The engine's own test decodes lines frozen from this encoder
 * (`voice_line_fixture.h`). Were the encoder to change and the header not,
 * the engine would go on passing against a line the app no longer writes.
 */
describe('the lines the engine is tested with', () => {
  const header = readFileSync(
    join(__dirname, '../../../../native/system-apo/tests/voice_line_fixture.h'),
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

  it('are what the encoder writes today', () => {
    expect(encodeChainSettings(rack({ voice: VOICE }))).toEqual(
      fixture('kVoiceAloneLine'),
    );
    expect(encodeChainSettings(rack({ gameMode: true, voice: VOICE }))).toEqual(
      fixture('kVoiceLowLagLine'),
    );
    expect(
      appendPresetTone(
        encodeChainSettings(
          rack({
            gameMode: true,
            dynamics: { ...DSP_DEFAULTS.dynamics, enabled: true },
            voice: VOICE,
          }),
        ),
        tone,
      ),
    ).toEqual(fixture('kVoiceDynamicsToneLine'));
  });
});
