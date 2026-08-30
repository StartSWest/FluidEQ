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
export type TDspSection =
  | 'normalizer'
  | 'crossfade'
  | 'eq'
  | 'exciter'
  | 'dimension'
  | 'compressor'
  | 'maximizer'
  | 'master';

/**
 * The rack's visible workflow, with the output boundary fixed last.
 *
 * This list chooses pages; it does not schedule samples. The worklet owns the
 * approved processor topology independently, so moving a tab can never change
 * the sound by accident.
 */
export const DSP_SECTIONS: { id: TDspSection; labelKey: TranslationKey }[] = [
  { id: 'normalizer', labelKey: 'dsp.normalizer.title' },
  { id: 'crossfade', labelKey: 'dsp.crossfade.title' },
  { id: 'exciter', labelKey: 'dsp.exciter.title' },
  { id: 'eq', labelKey: 'dsp.eq.title' },
  { id: 'dimension', labelKey: 'dsp.dimension.title' },
  // Keep the processor in the DSP chain, but hide its editor until it is ready.
  { id: 'maximizer', labelKey: 'dsp.maximizer.title' },
  { id: 'master', labelKey: 'dsp.master.title' },
];
