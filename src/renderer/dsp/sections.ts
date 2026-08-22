/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { TranslationKey } from '../../common/i18n/en';

/**
 * Which processor the DSP page is showing.
 *
 * Owned here rather than by the rail because the rail and the icons both need
 * it, and having either import the other put a cycle between two modules that
 * only ever agreed on a four-word union.
 */
export type TDspSection = 'eq' | 'exciter' | 'compressor' | 'maximizer';

/**
 * In signal order, and NOT reorderable: the order is an audio decision, so the
 * rail reads as the chain rather than as a menu.
 */
export const DSP_SECTIONS: { id: TDspSection; labelKey: TranslationKey }[] = [
  { id: 'eq', labelKey: 'dsp.eq.title' },
  { id: 'exciter', labelKey: 'dsp.exciter.title' },
  { id: 'compressor', labelKey: 'dsp.compressor.title' },
  { id: 'maximizer', labelKey: 'dsp.maximizer.title' },
];
