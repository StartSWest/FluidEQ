/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Saving a stage's own profiles. See `en/dspStageSave.ts`. */
export default {
  'dsp.stageSave.hint':
    'Speichert diesen Filter so, wie er jetzt eingestellt ist, unter einem eigenen Namen.',
  'dsp.stageSave.failed':
    'Das konnte nicht gespeichert werden: Der Speicher von FluidEQ auf diesem Computer ist voll oder ausgeschaltet.',
} as const;
