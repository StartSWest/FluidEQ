/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Saving a stage's own profiles. See `en/dspStageSave.ts`. */
export default {
  'dsp.stageSave.hint':
    'Сохранить этот фильтр в текущих настройках под собственным именем.',
  'dsp.stageSave.failed':
    'Не удалось сохранить: хранилище FluidEQ на этом компьютере заполнено или отключено.',
} as const;
