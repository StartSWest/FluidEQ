/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const scene = {
  'scene.quality': '画质',
  'scene.quality.auto': '自动',
  'scene.quality.balanced': '平衡',
  'scene.quality.full': '完整',
  'scene.quality.auto.hint': '显卡能流畅保持的最清晰画面',
  'scene.quality.balanced.hint': '减轻显卡负担，从不低于一半大小',
  'scene.quality.full.hint': '始终全尺寸，边缘平滑到最佳',
} as const;

export default scene;
