/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const scene = {
  'scene.quality': '画質',
  'scene.quality.auto': '自動',
  'scene.quality.balanced': 'バランス',
  'scene.quality.full': 'フル',
  'scene.quality.auto.hint': 'グラフィックカードが滑らかに保てる最も鮮明な画質',
  'scene.quality.balanced.hint':
    'グラフィックカードに軽く、半分のサイズより小さくしない',
  'scene.quality.full.hint': '常にフルサイズ、輪郭も最大限に滑らか',
} as const;

export default scene;
