/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A mic's Reverb (engine 1.33) on the rack's line: a trailer of its own
 * after Voice's and before the preset's curve. An engine before it refuses
 * a line carrying it and bypasses the whole rack, so the line it is sent
 * has the Reverb taken off and everything else kept.
 */

import { FilterTypeEnum } from '../../../common/constants';
import { DSP_DEFAULTS } from '../../../common/dsp/chainDefaults';
import type { IDspSettings } from '../../../common/dsp/chainSettings';
import {
  appendPresetTone,
  CHAIN_TONE_TAG,
  encodeChainSettings,
  hasPresetTone,
  hasReverb,
  hasVoice,
  isChainWirePayload,
  voiceWithoutLevel,
  withoutReverb,
} from '../../../common/dsp/chainWire';
import {
  ENGINE_READS_ALL,
  engineReadsOf,
  lineForEngine,
} from '../../../common/dsp/engineLine';
import {
  clampReverbSettings,
  IReverbSettings,
  REVERB_DEFAULTS,
} from '../../../common/dsp/reverbStage';
import {
  CHAIN_REVERB_TAG,
  CHAIN_REVERB_TRAILER,
  reverbTrailer,
} from '../../../common/dsp/reverbWire';
import { VOICE_DEFAULTS } from '../../../common/dsp/voiceStage';

const REVERB: IReverbSettings = {
  enabled: true,
  type: 'vocalPlate',
  mixDb: -15,
  decayS: 1.6,
  predelayMs: 25,
  toneHz: 7000,
  lowCutHz: 250,
  width: 0.8,
  duck: true,
  duckDb: 6,
};

const VOICE = {
  ...VOICE_DEFAULTS,
  enabled: true,
  lowCutHz: 90,
  levelEnabled: true,
};

const rack = (patch: Partial<IDspSettings>): IDspSettings => ({
  ...DSP_DEFAULTS,
  enabled: true,
  gameMode: true,
  ...patch,
});

const tone = {
  matched: true,
  bands: [
    { type: FilterTypeEnum.PK, frequency: 3150, gain: 2.8, quality: 1.4 },
  ],
};

describe('the Reverb on the rack line', () => {
  it('is written only while the stage is on', () => {
    const off = encodeChainSettings(
      rack({ voice: VOICE, reverb: { ...REVERB, enabled: false } }),
    );
    expect(off).toEqual(encodeChainSettings(rack({ voice: VOICE })));
    expect(hasReverb(off)).toBe(false);
  });

  it('stands after Voice and before the curve, and the line is valid', () => {
    const line = appendPresetTone(
      encodeChainSettings(rack({ voice: VOICE, reverb: REVERB })),
      tone,
    );
    expect(isChainWirePayload(line)).toBe(true);
    expect(hasVoice(line)).toBe(true);
    expect(hasReverb(line)).toBe(true);
    expect(hasPresetTone(line)).toBe(true);
    const at = line.indexOf(CHAIN_REVERB_TAG);
    expect(at).toBeGreaterThan(0);
    expect(line.slice(at, at + CHAIN_REVERB_TRAILER)).toEqual(
      reverbTrailer(REVERB),
    );
    expect(line[at + CHAIN_REVERB_TRAILER]).toBe(CHAIN_TONE_TAG);
  });

  it('is refused at the boundary when a value is out of range', () => {
    const line = encodeChainSettings(rack({ voice: VOICE, reverb: REVERB }));
    const at = line.indexOf(CHAIN_REVERB_TAG);
    expect(isChainWirePayload(line)).toBe(true); // control
    const badType = [...line];
    badType[at + 4] = 5; // one past the last type
    expect(isChainWirePayload(badType)).toBe(false);
    const loud = [...line];
    loud[at + 5] = 3; // a tail over the dry voice
    expect(isChainWirePayload(loud)).toBe(false);
  });

  it('comes off for an engine older than 1.33, Voice and the curve kept', () => {
    const line = appendPresetTone(
      encodeChainSettings(rack({ voice: VOICE, reverb: REVERB })),
      tone,
    );
    const stripped = withoutReverb(line);
    expect(hasReverb(stripped)).toBe(false);
    expect(hasPresetTone(stripped)).toBe(true);
    expect(stripped).toEqual(
      appendPresetTone(encodeChainSettings(rack({ voice: VOICE })), tone),
    );
    // 1.32 reads Voice without its level, and no Reverb at all.
    expect(lineForEngine(line, engineReadsOf('1.32.0.0'))).toEqual(
      voiceWithoutLevel(stripped),
    );
    expect(lineForEngine(line, engineReadsOf('1.33.0.0'))).toEqual(line);
    expect(lineForEngine(line, ENGINE_READS_ALL)).toEqual(line);
  });
});

describe('a stored Reverb read back', () => {
  it('is every value inside the range the engine accepts', () => {
    expect(
      clampReverbSettings({
        enabled: true,
        type: 'hall',
        mixDb: 6,
        decayS: 30,
        predelayMs: -5,
        toneHz: 100,
        lowCutHz: 9000,
        width: 2,
        duck: true,
        duckDb: 99,
      }),
    ).toEqual({
      enabled: true,
      type: 'hall',
      mixDb: 0,
      decayS: 8,
      predelayMs: 0,
      toneHz: 2000,
      lowCutHz: 500,
      width: 1,
      duck: true,
      duckDb: 24,
    });
  });

  it('reads an unknown type or garbage as the defaults, off', () => {
    expect(clampReverbSettings({ ...REVERB, type: 'cathedral' }).type).toBe(
      REVERB_DEFAULTS.type,
    );
    expect(clampReverbSettings('nonsense')).toEqual(REVERB_DEFAULTS);
    expect(clampReverbSettings({ enabled: 'yes' }).enabled).toBe(false);
  });
});
