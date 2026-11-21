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
  encodeChainSettings,
  hasPresetTone,
  hasVoice,
  isChainWirePayload,
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
    expect(line.slice(at, at + CHAIN_VOICE_TRAILER)).toEqual(
      voiceTrailer(VOICE),
    );
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
    expect(lineForEngine(line, engineReadsOf('1.31.0.0'))).toEqual(line);
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
