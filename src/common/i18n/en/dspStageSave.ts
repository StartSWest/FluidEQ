/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Saving a stage's own profiles (`useStagePresets.tsx`). `dsp.` keys in a
 * file of their own, as the De-esser's are: `dsp.ts` is past the size this
 * project allows. Everything else the save says is the EQ's own words.
 */
export default {
  'dsp.stageSave.hint':
    'Save this filter as it is set now, under a name of its own.',
  'dsp.stageSave.failed':
    'That couldn’t be saved: this computer’s storage for FluidEQ is full or switched off.',
} as const;
