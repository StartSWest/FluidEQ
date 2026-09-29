/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * WHETHER THE PACK'S 3D WORLD IS DRAWN IN FRONT OF ITS SHADER (Ivan,
 * 2026-09-28, on Bloom: "it has a flower under the main one").
 *
 * A world pack keeps a real shader: it is the world's sky, and it is the
 * whole scene wherever the world is not drawn - an app older than worlds, a
 * graphics card that refuses this one. So its shader paints the subject too,
 * and with the world in front the painted subject showed round the 3D one and
 * between its petals: the sky cannot see the world over it. A pack that
 * declares this control can tell: FluidEQ holds it at 1 while it draws the
 * world in front (`worldInputs.ts`), and it is the pack's own `value`, 0,
 * wherever the shader plays alone - a value saved for it is never applied
 * (`sceneTuner.ts`). The shader paints its subject only while it reads below
 * a half.
 *
 * A control rather than a uniform of its own, like the time of day
 * (`sceneDaylight.ts`): every FluidEQ declares a pack's controls from the
 * pack itself, so the scene still compiles on an app that has never heard
 * of it, and plays there with its painted subject. Never a slider on screen.
 */
export const SCENE_WORLD_PARAM = 'world';

/**
 * The control as a world pack's `pack.json` declares it. A range, since a
 * scene's controls must have one (`memberScenes.ts`); on an app older than
 * this it is a slider resting at 0, where the painted subject shows.
 */
export const SCENE_WORLD_CONTROL = {
  id: SCENE_WORLD_PARAM,
  names: { en: '3D world in front' },
  min: 0,
  max: 1,
  value: 0,
} as const;

/** The value FluidEQ holds it at while the world is drawn in front. */
export const SCENE_WORLD_DRAWN = 1;
