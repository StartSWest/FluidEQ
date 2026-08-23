/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  EQ_PRESETS,
  EQ_PRESET_GROUPS,
  IEqPreset,
  eqPresetSetup,
} from '../../common/dsp/eqPresets';
import { Translate } from '../../common/i18n';
import { TranslationKey } from '../../common/i18n/en';
import VoicingIcon from '../icons/VoicingIcon';
import { IRichPickEntry } from '../widgets/RichPick';
import { IUserPreset } from './userPresets';

/** Where the user's own presets file. Above every factory group, always. */
export const SAVED_GROUP = 'saved';

/**
 * What the row under the name says: the rack this preset asks for.
 *
 * Assembled from the settings rather than written out as prose, for two
 * reasons that both matter more than the prose would read better.
 *
 * It cannot go stale. A hand-written line saying "broad, parallel" survives
 * somebody changing the preset to focused and serial, and nothing fails — the
 * menu simply lies from then on. This is derived from the same fields the rack
 * is configured from, so it is wrong only if the preset is.
 *
 * And it is what actually distinguishes these entries. Fifteen of them are a
 * genre name over a curve, and the curve is already drawn on the graph the
 * moment one is chosen; what is NOT visible anywhere else is that this one
 * wants oversampling and mid-only and a de-esser on two bands. That is the
 * part somebody comparing two presets cannot otherwise see.
 *
 * Only what differs from the rack's own defaults is listed, so a plain tone
 * curve gets a short line and the elaborate ones earn their longer one.
 */
export const presetHint = (preset: IEqPreset, t: Translate): string => {
  const setup = eqPresetSetup(preset);
  const parts: string[] = [];

  if (setup.model !== 'clean') {
    parts.push(t(`dsp.eqModel.${setup.model}` as TranslationKey));
  }
  if (setup.engine !== 'serial') {
    parts.push(t('dsp.eqEngine.parallel'));
  }
  if (setup.stereo !== 'stereo') {
    parts.push(t(`dsp.eqStereo.${setup.stereo}` as TranslationKey));
  }
  if (setup.oversample > 1) {
    parts.push(t('dsp.eqOversample.on'));
  }
  const reacting = preset.dynamic?.filter((one) => one !== null).length ?? 0;
  if (reacting > 0) {
    parts.push(`${t('dsp.eq.dynamic')} ×${reacting}`);
  }

  return parts.join(' · ');
};

/**
 * Every preset as a menu row, saved ones first and the rest under their group.
 *
 * The order here is the order the picker shows AND the order the arrows walk,
 * which is the whole reason it is computed once in one place: when the two
 * disagreed, pressing "next" moved to an entry that was nowhere near the one
 * highlighted, and the arrows read as broken rather than as sorted differently.
 */
export const eqPresetEntries = (
  userPresets: readonly IUserPreset[],
  t: Translate,
): IRichPickEntry[] => [
  // Theirs first. These are the ones somebody made on purpose, and a list that
  // puts them under forty-seven factory curves is a list that hides them.
  ...userPresets.map((one) => ({
    id: one.id,
    name: one.name,
    hint: '',
    group: SAVED_GROUP,
    icon: <VoicingIcon className="rich-pick__glyph" />,
  })),
  ...EQ_PRESET_GROUPS.flatMap((group) =>
    EQ_PRESETS.filter((preset) => preset.group === group).map((preset) => ({
      id: preset.id,
      name: t(preset.labelKey as TranslationKey),
      hint: presetHint(preset, t),
      group,
      icon: <VoicingIcon profileId={preset.id} className="rich-pick__glyph" />,
    })),
  ),
];

/** The heading for a group, or `''` for one that gets none. */
export const eqPresetGroupLabel = (group: string, t: Translate): string => {
  if (group === SAVED_GROUP) {
    return t('dsp.eqPreset.saved');
  }
  return group ? t(`dsp.eqPresetGroup.${group}` as TranslationKey) : '';
};
