/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  CAVE_CEILING,
  CAVE_WATER,
  type createCaveDripsPaths,
} from './caveDrips';
import { setAlpha } from './liveTraceStyle';

// The cave on the live graph: the rock, the pool and the drips.

interface IPaintCaveInput {
  cavePaths: ReturnType<typeof createCaveDripsPaths> | undefined;
  caveOwnColours: boolean;
  canvasPaint: string | CanvasGradient;
  isFilled: boolean;
  context: CanvasRenderingContext2D;
  opacity: number;
  sceneBase: number;
}

/**
 * The rock, the pool and the falling drips, filled.
 */
export const paintCave = ({
  cavePaths,
  caveOwnColours,
  canvasPaint,
  isFilled,
  context,
  opacity,
  sceneBase,
}: IPaintCaveInput) => {
  if (cavePaths) {
    // The pool first: dark water in the look's colour, glowing with
    // the bass, with the rock reflected in it, then the rings and the
    // splashes on its surface, then the surface line. Filled, the
    // water is a body; stroked, the surface and the rings alone.
    const caveWater = caveOwnColours ? CAVE_WATER : canvasPaint;
    if (isFilled) {
      context.fillStyle = caveWater;
      setAlpha(context, opacity * (0.5 + cavePaths.bass * 0.25));
      context.fill(cavePaths.pool);
      // The rock's reflection, under the water's own shading so it
      // fades with depth rather than poking out of the floor.
      context.save();
      context.clip(cavePaths.pool);
      context.fillStyle = canvasPaint;
      setAlpha(context, opacity * 0.3);
      context.fill(cavePaths.reflections);
      context.restore();
      // Lit at the surface, dark at the bottom: still water.
      const water = context.createLinearGradient(
        0,
        cavePaths.poolTop,
        0,
        sceneBase,
      );
      water.addColorStop(0, 'rgba(255,255,255,0.18)');
      water.addColorStop(0.3, 'rgba(0,0,0,0.25)');
      water.addColorStop(1, 'rgba(0,0,0,0.7)');
      context.fillStyle = water;
      setAlpha(context, opacity);
      context.fill(cavePaths.pool);
    }
    context.strokeStyle = '#fff';
    context.lineWidth = 1;
    cavePaths.ripples.forEach((band) => {
      setAlpha(context, opacity * band.alpha * 0.5);
      context.stroke(band.path);
    });
    context.lineWidth = 1.2;
    setAlpha(context, opacity * 0.8);
    context.stroke(cavePaths.splash);
    context.lineWidth = 1;
    setAlpha(context, opacity * (0.3 + cavePaths.bass * 0.35));
    context.stroke(cavePaths.surface);
  }
};

interface IStrokeCaveInput {
  cavePaths: ReturnType<typeof createCaveDripsPaths> | undefined;
  isFilled: boolean;
  context: CanvasRenderingContext2D;
  opacity: number;
  canvasPaint: string | CanvasGradient;
  caveOwnColours: boolean;
}

/**
 * The rock's edge and the ripples on the pool.
 */
export const strokeCave = ({
  cavePaths,
  isFilled,
  context,
  opacity,
  canvasPaint,
  caveOwnColours,
}: IStrokeCaveInput) => {
  if (cavePaths) {
    // The rock's shading: the flank away from the light darkened, a
    // wet highlight down the lit flank — filled only; stroked, the
    // outline is the rock. Then the bead swelling at every tip, and
    // the drips in flight, each with its shine.
    if (isFilled) {
      context.fillStyle = '#000';
      setAlpha(context, opacity * 0.32);
      context.fill(cavePaths.shade);
      context.fillStyle = '#fff';
      setAlpha(context, opacity * 0.26);
      context.fill(cavePaths.light);
      context.strokeStyle = '#000';
      context.lineWidth = 1;
      setAlpha(context, opacity * 0.22);
      context.stroke(cavePaths.bands);
    }
    context.fillStyle = '#fff';
    setAlpha(context, opacity * 0.55);
    context.fill(cavePaths.beads);
    if (isFilled) {
      context.fillStyle = canvasPaint;
      setAlpha(context, opacity * 0.35);
      context.fill(cavePaths.drips);
      context.fillStyle = '#fff';
      setAlpha(context, opacity * 0.6);
      context.fill(cavePaths.drips);
    } else {
      context.strokeStyle = '#fff';
      context.lineWidth = 1;
      setAlpha(context, opacity * 0.8);
      context.stroke(cavePaths.drips);
    }
    context.fillStyle = '#fff';
    setAlpha(context, opacity * 0.95);
    context.fill(cavePaths.shine);
    // The ceiling last, over the roots: the stalactites grow out from
    // under its ragged edge, so the rock covers them, not the reverse.
    const caveRock = caveOwnColours ? CAVE_CEILING : canvasPaint;
    if (isFilled) {
      context.fillStyle = caveRock;
      setAlpha(context, opacity);
      context.fill(cavePaths.ceiling);
      context.fillStyle = '#000';
      setAlpha(context, opacity * 0.3);
      context.fill(cavePaths.ceiling);
    }
    context.strokeStyle = caveRock;
    context.lineWidth = 1;
    setAlpha(context, opacity * 0.7);
    context.stroke(cavePaths.ceiling);
    context.strokeStyle = '#000';
    setAlpha(context, opacity * 0.6);
    context.stroke(cavePaths.cracks);
  }
};
