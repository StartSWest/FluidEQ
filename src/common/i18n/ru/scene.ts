/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const scene = {
  'scene.quality': 'Качество',
  'scene.quality.auto': 'Авто',
  'scene.quality.balanced': 'Баланс',
  'scene.quality.full': 'Полное',
  'scene.quality.auto.hint':
    'Самая чёткая картинка, которую видеокарта показывает плавно',
  'scene.quality.balanced.hint':
    'Легче для видеокарты, не меньше половины размера',
  'scene.quality.full.hint':
    'Всегда полный размер и максимальное сглаживание краёв',
} as const;

export default scene;
