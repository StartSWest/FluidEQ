/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Mic tab's own stage presets: the low cut, the voice cleaner, the gate,
 * Voice level and the Reverb. Which one a stage is on is read back from its
 * values, never stored, so a preset the engine would clamp to something else
 * would never read as itself again.
 */

import { clampReverbSettings } from '../../../common/dsp/reverbStage';
import {
  clampVoiceSettings,
  VOICE_DEFAULTS,
} from '../../../common/dsp/voiceStage';
import en from '../../../common/i18n/en';
import {
  MIC_STAGE_PRESETS,
  micStagePreset,
  micStagePresetOf,
  TMicPresetStage,
} from '../../../common/mic/micStagePresets';

const STAGES = Object.keys(MIC_STAGE_PRESETS) as TMicPresetStage[];

describe("the Mic tab's stage presets", () => {
  it.each(STAGES)('%s names each preset once, in English', (stage) => {
    const presets = MIC_STAGE_PRESETS[stage];
    const ids = presets.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    const words = en as Record<string, string>;
    presets.forEach((preset) => expect(words[preset.labelKey]).toBeTruthy());
  });

  it('keeps every Voice preset inside the ranges the engine accepts', () => {
    (['lowCut', 'gate', 'level'] as const).forEach((stage) =>
      MIC_STAGE_PRESETS[stage].forEach((preset) => {
        const voice = { ...VOICE_DEFAULTS, ...preset.values };
        expect({
          stage,
          id: preset.id,
          read: clampVoiceSettings(voice),
        }).toEqual({ stage, id: preset.id, read: voice });
      }),
    );
  });

  it('keeps every Reverb preset inside the ranges the engine accepts', () => {
    MIC_STAGE_PRESETS.reverb.forEach((preset) => {
      const reverb = { ...preset.values, enabled: true };
      expect({ id: preset.id, read: clampReverbSettings(reverb) }).toEqual({
        id: preset.id,
        read: reverb,
      });
    });
  });

  it('keeps every cleaner amount between none and all', () => {
    MIC_STAGE_PRESETS.denoise.forEach(({ values }) => {
      expect(values.amount).toBeGreaterThan(0);
      expect(values.amount).toBeLessThanOrEqual(1);
    });
  });

  /**
   * A gate that closed hard between words was heard as "gated"
   * (2026-11-24): every one holds through a syllable's gap and closes by a
   * range, never to silence.
   */
  it('holds every gate through a syllable gap and never closes it to silence', () => {
    MIC_STAGE_PRESETS.gate.forEach(({ id, values }) => {
      expect({
        id,
        holds: values.gateHoldMs >= 120 && values.gateHoldMs <= 300,
      }).toEqual({ id, holds: true });
      expect({ id, silent: values.gateRangeDb >= 80 }).toEqual({
        id,
        silent: false,
      });
    });
  });

  it.each(STAGES)('%s reads each preset back from its own values', (stage) => {
    MIC_STAGE_PRESETS[stage].forEach((preset) => {
      expect(micStagePresetOf(stage, preset.values)?.id).toBe(preset.id);
      expect(micStagePreset(stage, preset.id)).toBe(preset);
    });
  });

  it('reads a dial moved by hand as no preset, and an unknown id as none', () => {
    const [first] = MIC_STAGE_PRESETS.level;
    // Control: the preset's own values read as it.
    expect(micStagePresetOf('level', first.values)?.id).toBe(first.id);
    expect(
      micStagePresetOf('level', {
        ...first.values,
        levelMaxLiftDb: first.values.levelMaxLiftDb + 0.5,
      }),
    ).toBeUndefined();
    expect(micStagePreset('level', 'nope')).toBeUndefined();
  });
});
