/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FilterTypeEnum } from '../../common/constants';
import type { TranslationKey } from '../../common/i18n/en';

/**
 * What each filter shape is called on screen, in every language.
 *
 * The Bands page's Filter list spelt these out in English whatever the
 * language, from a list of its own, while the DSP page's EQ card named the
 * same seven shapes through the dictionary. One map serves both now, so the
 * two pages cannot call one shape by two names.
 */
const FILTER_TYPE_NAME_KEYS: Record<FilterTypeEnum, TranslationKey> = {
  [FilterTypeEnum.PK]: 'dsp.eq.type.peak',
  [FilterTypeEnum.NO]: 'dsp.eq.type.notch',
  [FilterTypeEnum.LSC]: 'dsp.eq.type.lowShelf',
  [FilterTypeEnum.HSC]: 'dsp.eq.type.highShelf',
  [FilterTypeEnum.LPQ]: 'dsp.eq.type.lowPass',
  [FilterTypeEnum.HPQ]: 'dsp.eq.type.highPass',
  [FilterTypeEnum.BP]: 'dsp.eq.type.bandPass',
};

export default FILTER_TYPE_NAME_KEYS;
