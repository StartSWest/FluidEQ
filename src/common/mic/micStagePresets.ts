/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The named presets of the Mic tab's own stages: the low cut, the voice
 * cleaner, the gate and Voice level (Ivan, 2026-11-24: "put presets on each
 * filter for the mic, nice presets depending on the filters"). The stages
 * borrowed from the DSP page carry theirs in the DSP catalogues, under the
 * `mic` group.
 *
 * A preset is the values of its stage's dials and nothing else, so picking
 * one leaves every other stage and the stage's own switch alone. Which one a
 * stage is on is read back from those values (`micStagePresetOf`): no
 * preset id is stored, so a dial moved by hand, a profile or an older build
 * all read the same way, as the preset whose values they are or none.
 *
 * Tuned for a voice at a headset's or a desk mic's level:
 * - Low cut: the lowest fundamental of a deep speaking voice is about 85 Hz,
 *   so nothing but Rumble guard cuts above 100 Hz; Close to the mic takes
 *   back the 3-6 dB of bass a capsule a few centimetres from the mouth adds,
 *   and nothing at arm's length; a boom at the mouth gets the most pop
 *   guard.
 * - Gate: every one opens under a soft voice and closes by a range, never to
 *   silence except Tight, and holds through a syllable's gap (120-300 ms),
 *   because the cleaner in front already takes the room and a gate that
 *   closes hard between words is what was heard as "gated" (2026-11-24).
 * - Voice level: targets between -20 and -16 dBFS, where a voice sits under
 *   a limiter at -1 to -3 dBTP with room for its peaks; the most lift says
 *   how quiet a voice it will still bring up.
 */

import type { IReverbSettings } from '../dsp/reverbStage';
import type { TranslationKey } from '../i18n';
import type { IVoiceSettings } from '../dsp/voiceStage';

export type TMicPresetStage =
  'lowCut' | 'denoise' | 'gate' | 'level' | 'reverb';

/** The values one stage's presets set, by stage. */
export interface IMicStageValues {
  lowCut: Pick<IVoiceSettings, 'lowCutHz' | 'proximityDb' | 'deplosive'>;
  denoise: { amount: number };
  gate: Pick<
    IVoiceSettings,
    | 'gateThresholdDb'
    | 'gateRangeDb'
    | 'gateHoldMs'
    | 'gateAttackMs'
    | 'gateReleaseMs'
  >;
  level: Pick<IVoiceSettings, 'levelTargetDb' | 'levelMaxLiftDb'>;
  reverb: Omit<IReverbSettings, 'enabled'>;
}

export interface IMicStagePreset<S extends TMicPresetStage> {
  id: string;
  /** Written out, so the dead-keys guard and the compiler both see it. */
  labelKey: TranslationKey;
  values: IMicStageValues[S];
}

export const MIC_STAGE_PRESETS: {
  readonly [S in TMicPresetStage]: readonly IMicStagePreset<S>[];
} = {
  lowCut: [
    {
      id: 'speech',
      labelKey: 'mic.preset.lowCut.speech',
      values: { lowCutHz: 90, proximityDb: 2, deplosive: 0.6 },
    },
    {
      id: 'deep',
      labelKey: 'mic.preset.lowCut.deep',
      values: { lowCutHz: 65, proximityDb: 1.5, deplosive: 0.5 },
    },
    {
      id: 'headset',
      labelKey: 'mic.preset.lowCut.headset',
      values: { lowCutHz: 100, proximityDb: 4, deplosive: 0.9 },
    },
    {
      id: 'rumble',
      labelKey: 'mic.preset.lowCut.rumble',
      values: { lowCutHz: 140, proximityDb: 0, deplosive: 0.8 },
    },
    {
      id: 'distant',
      labelKey: 'mic.preset.lowCut.distant',
      values: { lowCutHz: 80, proximityDb: 0, deplosive: 0.3 },
    },
  ],
  denoise: [
    {
      id: 'light',
      labelKey: 'mic.preset.denoise.light',
      values: { amount: 0.3 },
    },
    {
      id: 'studio',
      labelKey: 'mic.preset.denoise.studio',
      values: { amount: 0.5 },
    },
    {
      id: 'home',
      labelKey: 'mic.preset.denoise.home',
      values: { amount: 0.65 },
    },
    {
      id: 'noisy',
      labelKey: 'mic.preset.denoise.noisy',
      values: { amount: 0.85 },
    },
    { id: 'fan', labelKey: 'mic.preset.denoise.fan', values: { amount: 1 } },
  ],
  gate: [
    {
      id: 'gentle',
      labelKey: 'mic.preset.gate.gentle',
      values: {
        gateThresholdDb: -52,
        gateRangeDb: 8,
        gateHoldMs: 250,
        gateAttackMs: 2,
        gateReleaseMs: 250,
      },
    },
    {
      id: 'calls',
      labelKey: 'mic.preset.gate.calls',
      values: {
        gateThresholdDb: -50,
        gateRangeDb: 12,
        gateHoldMs: 300,
        gateAttackMs: 3,
        gateReleaseMs: 300,
      },
    },
    {
      id: 'podcast',
      labelKey: 'mic.preset.gate.podcast',
      values: {
        gateThresholdDb: -48,
        gateRangeDb: 15,
        gateHoldMs: 250,
        gateAttackMs: 2,
        gateReleaseMs: 200,
      },
    },
    {
      id: 'stream',
      labelKey: 'mic.preset.gate.stream',
      values: {
        gateThresholdDb: -46,
        gateRangeDb: 20,
        gateHoldMs: 200,
        gateAttackMs: 1.5,
        gateReleaseMs: 150,
      },
    },
    {
      id: 'tight',
      labelKey: 'mic.preset.gate.tight',
      values: {
        gateThresholdDb: -40,
        gateRangeDb: 40,
        gateHoldMs: 120,
        gateAttackMs: 0.5,
        gateReleaseMs: 80,
      },
    },
  ],
  level: [
    {
      id: 'gentle',
      labelKey: 'mic.preset.level.gentle',
      values: { levelTargetDb: -20, levelMaxLiftDb: 6 },
    },
    {
      id: 'calls',
      labelKey: 'mic.preset.level.calls',
      values: { levelTargetDb: -20, levelMaxLiftDb: 12 },
    },
    {
      id: 'podcast',
      labelKey: 'mic.preset.level.podcast',
      values: { levelTargetDb: -18, levelMaxLiftDb: 15 },
    },
    // The stage's own default (`VOICE_DEFAULTS`), so a fresh mic reads as
    // a preset and not as Custom.
    {
      id: 'everyday',
      labelKey: 'mic.preset.level.everyday',
      values: { levelTargetDb: -18, levelMaxLiftDb: 18 },
    },
    {
      id: 'stream',
      labelKey: 'mic.preset.level.stream',
      values: { levelTargetDb: -16, levelMaxLiftDb: 18 },
    },
    {
      id: 'soft',
      labelKey: 'mic.preset.level.soft',
      values: { levelTargetDb: -18, levelMaxLiftDb: 24 },
    },
  ],
  // Singing wants a long, bright tail it can sit in; a voice that talks
  // wants a short one, ducked so the words stay clear and the space blooms
  // in the gaps (the plan's table, 2026-11-23). Plate is the stage's own
  // default, so a Reverb switched on reads as a preset.
  reverb: [
    {
      id: 'plate',
      labelKey: 'mic.preset.reverb.plate',
      values: {
        type: 'plate',
        mixDb: -16,
        decayS: 1.8,
        predelayMs: 30,
        toneHz: 8000,
        lowCutHz: 200,
        width: 1,
        duck: false,
        duckDb: 8,
      },
    },
    {
      id: 'vocalPlate',
      labelKey: 'mic.preset.reverb.vocalPlate',
      values: {
        type: 'vocalPlate',
        mixDb: -18,
        decayS: 1.2,
        predelayMs: 20,
        toneHz: 7000,
        lowCutHz: 250,
        width: 0.8,
        duck: false,
        duckDb: 8,
      },
    },
    {
      id: 'intimate',
      labelKey: 'mic.preset.reverb.intimate',
      values: {
        type: 'room',
        mixDb: -18,
        decayS: 0.6,
        predelayMs: 10,
        toneHz: 8000,
        lowCutHz: 200,
        width: 0.7,
        duck: false,
        duckDb: 8,
      },
    },
    {
      id: 'chamber',
      labelKey: 'mic.preset.reverb.chamber',
      values: {
        type: 'chamber',
        mixDb: -16,
        decayS: 1.4,
        predelayMs: 25,
        toneHz: 7000,
        lowCutHz: 200,
        width: 0.9,
        duck: false,
        duckDb: 8,
      },
    },
    {
      id: 'hall',
      labelKey: 'mic.preset.reverb.hall',
      values: {
        type: 'hall',
        mixDb: -16,
        decayS: 2.8,
        predelayMs: 40,
        toneHz: 6000,
        lowCutHz: 250,
        width: 1,
        duck: false,
        duckDb: 8,
      },
    },
    {
      id: 'streamAir',
      labelKey: 'mic.preset.reverb.streamAir',
      values: {
        type: 'room',
        mixDb: -22,
        decayS: 0.5,
        predelayMs: 0,
        toneHz: 8000,
        lowCutHz: 300,
        width: 0.6,
        duck: true,
        duckDb: 10,
      },
    },
  ],
};

/** Two values a dial would show the same; a type or a switch exactly. */
const same = (a: unknown, b: unknown) =>
  typeof a === 'number' && typeof b === 'number'
    ? Math.abs(a - b) < 1e-4
    : a === b;

/** The preset `values` are, or undefined when no preset's are. */
export const micStagePresetOf = <S extends TMicPresetStage>(
  stage: S,
  values: IMicStageValues[S],
): IMicStagePreset<S> | undefined =>
  (MIC_STAGE_PRESETS[stage] as readonly IMicStagePreset<S>[]).find((preset) =>
    (Object.keys(preset.values) as (keyof IMicStageValues[S])[]).every((key) =>
      same(preset.values[key], values[key]),
    ),
  );

/** One preset's values, by stage and id. */
export const micStagePreset = <S extends TMicPresetStage>(
  stage: S,
  id: string,
): IMicStagePreset<S> | undefined =>
  (MIC_STAGE_PRESETS[stage] as readonly IMicStagePreset<S>[]).find(
    (preset) => preset.id === id,
  );
