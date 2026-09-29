/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import orderRelatedStyles from './presetOrder';
import {
  DSP_DEFAULTS,
  EQ_BAND_COUNT,
  IEqBandSettings,
  IEqSettings,
  TEqEngine,
  TEqModel,
  TEqPhase,
  TEqStereo,
} from './chain';
import { DEFAULT_SETUP, EQ_DEFAULT_PRESET_ID } from './eqPresetSetups';
import EQ_PRESET_ENTRIES from './eqPresetEntries';

/**
 * The parts of the rack a preset sets besides its curve.
 *
 * A preset that moved fifteen gains and left the character, the topology and
 * the protective filters wherever the last one put them was not a preset — it
 * was a curve wearing somebody else's settings. Optional authoring stays terse,
 * but `eqPresetSetup` resolves every omitted field to a deliberate baseline;
 * nothing is inherited from the previously selected profile.
 */
/**
 * The sections the picker files presets under, in the order it shows them.
 *
 * Ordered from the ones somebody reaches for first: the way back to nothing,
 * then what they are listening to, then who is talking, then where they are,
 * then what they are listening on, then colour, then the four that fix a
 * specific fault.
 */
export const EQ_PRESET_GROUPS = [
  'basic',
  'genre',
  'voice',
  'scene',
  'device',
  'character',
  'repair',
] as const;

export type TEqPresetGroup = (typeof EQ_PRESET_GROUPS)[number];

export interface IEqPresetSetup {
  model?: TEqModel;
  modelAmount?: number;
  engine?: TEqEngine;
  phase?: TEqPhase;
  oversample?: number;
  stereo?: TEqStereo;
  subsonicHz?: number;
  fuzzAmount?: number;
  monoBelowHz?: number;
}

export interface IEqPreset {
  id: string;
  labelKey: string;
  /**
   * Which heading it files under in the picker.
   *
   * Here rather than in the picker because both menus that show these read it,
   * and a list of forty-seven with no sections is a list nobody reads to the
   * bottom of. Adding a preset without one is a type error, which is the point:
   * an ungrouped entry would silently land under whatever heading came before.
   */
  group: TEqPresetGroup;
  /**
   * One gain in dB per band, low to high. Always `EQ_BAND_COUNT` long.
   *
   * A curve is a TILT, and the level it happens to add is not part of it:
   * every curve a chain plays is set as a whole so that it adds no loudness
   * to that chain — K-weighted, heard against the chain's rack alone —
   * shifted rather than reshaped, so the tone is untouched and only the
   * volume moves. This matters more than it sounds: louder wins every
   * comparison it is in, so a hot curve reads as "better" while the listener
   * has not heard what it did to the tone yet. Six of these were between two
   * and four decibels hot before anyone measured them, and each one felt like
   * the best preset in its section. Where a chain then lands against DSP Off
   * is its rack's business: its Maximizer takes a loud master down by its
   * overs and a quiet one not at all, which no fixed curve could follow.
   */
  gains: readonly number[];
  /**
   * Per band: the level its gain should wait for, or `null` to always apply.
   *
   * Parallel to `gains` and the same length when present. Almost every preset
   * omits it, and that is the point rather than an oversight — a tone curve is
   * meant to hold still. Only a curve whose problem is intermittent has any
   * business reacting, and there are two of those here.
   */
  dynamic?: readonly (number | null)[];
  /** @see IEqPresetSetup */
  setup?: IEqPresetSetup;
}

export const eqPresetSetup = (preset: IEqPreset): Required<IEqPresetSetup> => ({
  ...DEFAULT_SETUP,
  ...(preset.setup ?? {}),
});

export const EQ_PRESETS: readonly IEqPreset[] =
  orderRelatedStyles(EQ_PRESET_ENTRIES);

/**
 * Every preset carries exactly one gain per band.
 *
 * Checked here rather than trusted, because a short array would silently leave
 * the last bands at whatever the user had — a preset that half-applies is
 * worse than one that does not exist.
 */
export const isCompleteEqPreset = (preset: IEqPreset): boolean =>
  preset.gains.length === EQ_BAND_COUNT &&
  // Checked on the same terms: a short thresholds array would leave the last
  // bands static while the gains that need them were applied in full, which is
  // a de-esser that quietly became a dull EQ.
  (preset.dynamic === undefined || preset.dynamic.length === EQ_BAND_COUNT);

/**
 * Materialise one factory preset into the complete EQ state it owns.
 *
 * Factory profiles are voiced on the canonical fifteen-band rack. Fitting the
 * gains onto whatever rack happened to be open preserved that rack's types,
 * Qs, enabled flags and dynamic state, so the same preset could sound different
 * depending on the edit made immediately before it. A preset is deterministic:
 * every audible value is assigned here, while only the processor's power state
 * and its Treble choice remain the user's decision — the Treble is how every
 * band plays near the top, not a part of any one curve, as the main EQ's is.
 */
export const eqSettingsForPreset = (
  current: IEqSettings,
  preset: IEqPreset,
): IEqSettings => {
  if (!isCompleteEqPreset(preset)) {
    return current;
  }

  if (preset.id === EQ_DEFAULT_PRESET_ID) {
    return {
      ...DSP_DEFAULTS.eq,
      enabled: current.enabled,
      isolate: false,
      treble: current.treble,
      presetId: preset.id,
      bands: DSP_DEFAULTS.eq.bands.map((band) => ({ ...band })),
    };
  }

  const setup = eqPresetSetup(preset);
  const bands: IEqBandSettings[] = DSP_DEFAULTS.eq.bands.map((band, index) => {
    const threshold = preset.dynamic?.[index] ?? null;
    return {
      ...band,
      gainDb: preset.gains[index],
      dynamic: threshold !== null,
      thresholdDb: threshold ?? band.thresholdDb,
    };
  });

  return {
    ...DSP_DEFAULTS.eq,
    ...setup,
    enabled: current.enabled,
    isolate: false,
    treble: current.treble,
    presetId: preset.id,
    bands,
    sourceBands: bands.map((band) => ({ ...band })),
  };
};
