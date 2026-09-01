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
  | 'denoise'
  | 'crossfade'
  | 'eq'
  | 'exciter'
  | 'bassForge'
  | 'bassPunch'
  | 'dimension'
  | 'compressor'
  | 'maximizer'
  | 'master';

/**
 * The rack's visible workflow, with the output boundary fixed last.
 *
 * This list chooses pages; it does not schedule samples. The native chain owns
 * the approved processor topology independently, so moving a tab can never
 * change the sound by accident.
 */
export const DSP_SECTIONS: { id: TDspSection; labelKey: TranslationKey }[] = [
  { id: 'normalizer', labelKey: 'dsp.normalizer.title' },
  // Beside the Normalizer rather than beside the creative stages: both of
  // these fix the source, and the rack reads as repair-then-colour.
  { id: 'denoise', labelKey: 'dsp.denoise.title' },
  { id: 'exciter', labelKey: 'dsp.exciter.title' },
  // Beside the Exciter, and ahead of the EQ, because that is where the audio
  // runs: `chain_process_bass_forge` sits between the two so the EQ shapes
  // everything that will be heard rather than everything except what the
  // rack's two synthesis stages just made.
  { id: 'bassForge', labelKey: 'dsp.bassForge.title' },
  { id: 'eq', labelKey: 'dsp.eq.title' },
  // After the EQ rather than beside Forge, because that is where the audio
  // runs: `chain_process_bass_punch` sits between the EQ and Dimension so the
  // envelope it shapes is the one the EQ has already voiced, not one the EQ
  // then re-times underneath it.
  { id: 'bassPunch', labelKey: 'dsp.bassPunch.title' },
  { id: 'dimension', labelKey: 'dsp.dimension.title' },
  // Keep the processor in the DSP chain, but hide its editor until it is ready.
  { id: 'maximizer', labelKey: 'dsp.maximizer.title' },
  { id: 'master', labelKey: 'dsp.master.title' },
];

/** Playback transitions are configured here, but are not DSP filter stages. */
export const DSP_PLAYBACK_SECTIONS: {
  id: TDspSection;
  labelKey: TranslationKey;
}[] = [{ id: 'crossfade', labelKey: 'dsp.crossfade.title' }];
