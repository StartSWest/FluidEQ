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
  type createCountryFencePaths,
  FENCE_FIREFLY,
  FENCE_GRAIN,
  FENCE_GRASS,
  FENCE_GRASS_LIT,
  FENCE_HILL_FAR,
  FENCE_HILL_NEAR,
  FENCE_RAIL,
  FENCE_SKY_HORIZON,
  FENCE_SKY_TOP,
  FENCE_SUN,
  FENCE_TREE_DARK,
  FENCE_TREE_LIGHT,
  FENCE_TRUNK,
} from './countryFence';
import { setAlpha } from './liveTraceStyle';

// The fence on the live graph: the boards and the field behind them.

interface IPaintFenceInput {
  fencePaths: ReturnType<typeof createCountryFencePaths> | undefined;
  isFilled: boolean;
  context: CanvasRenderingContext2D;
  sceneFrame: { top: number; bottom: number };
  fenceOwnColours: boolean;
  opacity: number;
  canvasPaint: string | CanvasGradient;
}

/**
 * The field and the fence's boards, filled.
 */
export const paintFence = ({
  fencePaths,
  isFilled,
  context,
  sceneFrame,
  fenceOwnColours,
  opacity,
  canvasPaint,
}: IPaintFenceInput) => {
  if (fencePaths) {
    // Golden hour, back to front: the sky, the sun's glow breathing
    // with the bass, the clouds, the far hills, the trees, the near
    // hill, then the rails and posts the pickets stand against.
    // Stroked, the land is outlines and the sky is left dark.
    if (isFilled) {
      const sky = context.createLinearGradient(
        0,
        sceneFrame.top,
        0,
        fencePaths.ground,
      );
      sky.addColorStop(0, fenceOwnColours ? FENCE_SKY_TOP : '#000');
      sky.addColorStop(1, fenceOwnColours ? FENCE_SKY_HORIZON : '#000');
      context.fillStyle = sky;
      setAlpha(context, opacity * (fenceOwnColours ? 1 : 0));
      context.fillRect(
        fencePaths.skyFrom,
        sceneFrame.top,
        fencePaths.skyTo - fencePaths.skyFrom,
        fencePaths.ground - sceneFrame.top,
      );
      // The field carries on to the bottom of the window, so a short
      // wave leaves grass under the fence rather than a black band.
      context.fillStyle = fenceOwnColours ? FENCE_HILL_NEAR : '#000';
      context.fillRect(
        fencePaths.skyFrom,
        fencePaths.ground,
        fencePaths.skyTo - fencePaths.skyFrom,
        Math.max(0, sceneFrame.bottom - fencePaths.ground),
      );
      const sun = context.createRadialGradient(
        fencePaths.sunX,
        fencePaths.sunY,
        0,
        fencePaths.sunX,
        fencePaths.sunY,
        fencePaths.sunRadius * 3,
      );
      sun.addColorStop(0, 'rgba(255,241,196,1)');
      sun.addColorStop(0.3, 'rgba(255,220,150,0.55)');
      sun.addColorStop(1, 'rgba(255,200,120,0)');
      context.fillStyle = sun;
      setAlpha(context, opacity * (0.7 + fencePaths.bass * 0.3));
      context.beginPath();
      context.arc(
        fencePaths.sunX,
        fencePaths.sunY,
        fencePaths.sunRadius * 3,
        0,
        Math.PI * 2,
      );
      context.fill();
      context.fillStyle = FENCE_SUN;
      setAlpha(context, opacity * 0.9);
      context.beginPath();
      context.arc(
        fencePaths.sunX,
        fencePaths.sunY,
        fencePaths.sunRadius,
        0,
        Math.PI * 2,
      );
      context.fill();
      context.fillStyle = '#fff';
      setAlpha(context, opacity * 0.55);
      context.fill(fencePaths.clouds);
    }
    const paintLand = (
      path: Path2D,
      colour: string | CanvasGradient,
      alpha: number,
    ) => {
      setAlpha(context, opacity * alpha);
      if (isFilled) {
        context.fillStyle = colour;
        context.fill(path);
      } else {
        context.strokeStyle = colour;
        context.lineWidth = 1;
        context.stroke(path);
      }
    };
    const own = fenceOwnColours;
    paintLand(fencePaths.farHill, own ? FENCE_HILL_FAR : '#3a3a3a', 1);
    paintLand(fencePaths.trunks, own ? FENCE_TRUNK : '#555', 1);
    paintLand(fencePaths.canopyDark, own ? FENCE_TREE_DARK : '#2a2a2a', 1);
    paintLand(fencePaths.canopyLight, own ? FENCE_TREE_LIGHT : '#444', 1);
    paintLand(fencePaths.nearHill, own ? FENCE_HILL_NEAR : '#2e2e2e', 1);
    paintLand(fencePaths.rails, own ? FENCE_RAIL : canvasPaint, 0.95);
    paintLand(fencePaths.posts, own ? FENCE_RAIL : canvasPaint, 1);
    context.strokeStyle = own ? FENCE_GRAIN : '#000';
    context.lineWidth = 1;
    setAlpha(context, opacity * 0.5);
    context.stroke(fencePaths.posts);
  }
};

interface IStrokeFenceInput {
  fencePaths: ReturnType<typeof createCountryFencePaths> | undefined;
  fenceOwnColours: boolean;
  context: CanvasRenderingContext2D;
  opacity: number;
  isFilled: boolean;
}

/**
 * The boards' edges over them.
 */
export const strokeFence = ({
  fencePaths,
  fenceOwnColours,
  context,
  opacity,
  isFilled,
}: IStrokeFenceInput) => {
  if (fencePaths) {
    // The wood's grain and knots on the pickets; then the grass in
    // front of the fence in two greens, the fireflies in it, and the
    // birds over everything.
    const own = fenceOwnColours;
    context.strokeStyle = own ? FENCE_GRAIN : '#000';
    context.lineWidth = 1;
    setAlpha(context, opacity * (isFilled ? 0.35 : 0.6));
    context.stroke(fencePaths.grain);
    context.fillStyle = own ? FENCE_GRAIN : '#000';
    setAlpha(context, opacity * 0.45);
    context.fill(fencePaths.knots);
    context.lineCap = 'round';
    context.lineWidth = Math.max(1.4, fencePaths.sunRadius * 0.045);
    context.strokeStyle = own ? FENCE_GRASS : '#3a6a3a';
    setAlpha(context, opacity * 0.95);
    context.stroke(fencePaths.grass);
    context.strokeStyle = own ? FENCE_GRASS_LIT : '#5a8a4a';
    context.stroke(fencePaths.grassLit);
    context.fillStyle = FENCE_FIREFLY;
    fencePaths.fireflies.forEach((band) => {
      setAlpha(context, opacity * band.alpha);
      context.fill(band.path);
    });
    context.strokeStyle = '#2a2a2a';
    context.lineWidth = 1.4;
    context.lineJoin = 'round';
    setAlpha(context, opacity * 0.85);
    context.stroke(fencePaths.birds);
  }
};
