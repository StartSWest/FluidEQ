/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const scene = {
  'scene.quality': '화질',
  'scene.quality.auto': '자동',
  'scene.quality.balanced': '균형',
  'scene.quality.full': '최대',
  'scene.quality.auto.hint':
    '그래픽 카드가 부드럽게 유지할 수 있는 가장 선명한 화질',
  'scene.quality.balanced.hint':
    '그래픽 카드 부담이 적고, 절반 크기 아래로는 내려가지 않음',
  'scene.quality.full.hint': '항상 전체 크기와 최대 가장자리 다듬기',
} as const;

export default scene;
