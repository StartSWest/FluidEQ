/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Translate } from '../i18n';
import type { TranslationKey } from '../i18n/en';
import { DSP_PRESETS, type IDspPreset } from './presets';
import type { IUserDspPreset } from './userPresets';

/**
 * A factory chain's name. A Room copy is named as the chain it copies plus
 * what tells it apart — "Gaming · Room", "Gaming · Competitive" — so the
 * copies read as that chain's in every language without a second set of names
 * to translate.
 */
export const dspPresetName = (preset: IDspPreset, t: Translate): string =>
  preset.copyLabelKey === undefined
    ? t(preset.labelKey as TranslationKey)
    : `${t(preset.labelKey as TranslationKey)} · ${t(preset.copyLabelKey as TranslationKey)}`;

/**
 * A preset's name by its id, as both pickers give it: a saved chain by the
 * name it was saved under, a factory chain by its label, undefined for an id
 * neither knows.
 */
export const namedDspPreset = (
  id: string,
  saved: readonly IUserDspPreset[],
  t: Translate,
): string | undefined => {
  const own = saved.find((preset) => preset.id === id);
  if (own) {
    return own.name;
  }
  const factory = DSP_PRESETS.find((preset) => preset.id === id);
  return factory ? dspPresetName(factory, t) : undefined;
};
