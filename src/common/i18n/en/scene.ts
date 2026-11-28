/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How a scene is drawn, in words FluidEQ and FluidWallpapers share: the
 * Quality row of the graph's View menu and of the Studio's Performance tab,
 * and FluidWallpapers' own settings, which take this file as it is
 * (`pnpm sync:fluideq` there). Each choice's line says what it does, and is
 * what the row shows when the pointer rests on it.
 */
const scene = {
  'scene.quality': 'Quality',
  'scene.quality.auto': 'Auto',
  'scene.quality.balanced': 'Balanced',
  'scene.quality.full': 'Full',
  'scene.quality.auto.hint':
    'The sharpest picture your graphics card keeps smooth',
  'scene.quality.balanced.hint':
    'Lighter on the graphics card, never under half size',
  'scene.quality.full.hint': 'Always full size with full edge smoothing',
} as const;

export default scene;
