/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Saving a stage's own profiles. See `en/dspStageSave.ts`. */
export default {
  'dsp.stageSave.hint':
    'このフィルターを今の設定のまま、名前を付けて保存します。',
  'dsp.stageSave.failed':
    '保存できませんでした。このコンピューターの FluidEQ 用ストレージがいっぱいか、無効になっています。',
} as const;
