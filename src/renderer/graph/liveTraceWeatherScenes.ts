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
  type createRainstormPaths,
  STORM_BOLT,
  STORM_RAIN,
  STORM_WATER,
} from './rainstorm';
import { setAlpha } from './liveTraceStyle';
import {
  BARK_COLOUR,
  COAL_COLOUR,
  type createBonfirePaths,
  FIRE_CORE,
  FIRE_MID,
  GRAIN_COLOUR,
  LOG_COLOUR,
  SMOKE_COLOUR,
} from './bonfire';

// The storm and the bonfire on the live graph, each filled and then
// stroked.

interface IPaintStormInput {
  stormPaths: ReturnType<typeof createRainstormPaths> | undefined;
  stormOwnColours: boolean;
  canvasPaint: string | CanvasGradient;
  isFilled: boolean;
  context: CanvasRenderingContext2D;
  opacity: number;
  sceneBase: number;
}

/**
 * The storm's clouds and rain, filled.
 */
export const paintStorm = ({
  stormPaths,
  stormOwnColours,
  canvasPaint,
  isFilled,
  context,
  opacity,
  sceneBase,
}: IPaintStormInput) => {
  if (stormPaths) {
    // The water first, lit at the surface and dark below, glowing with
    // the bass; the rings and splashes of the landings; then the rain
    // falling toward it, the cloud painted over the top of it after.
    const stormWater = stormOwnColours ? STORM_WATER : canvasPaint;
    const stormRain = stormOwnColours ? STORM_RAIN : canvasPaint;
    if (isFilled) {
      context.fillStyle = stormWater;
      setAlpha(context, opacity * (0.55 + stormPaths.bass * 0.3));
      context.fill(stormPaths.pool);
      const poolShade = context.createLinearGradient(
        0,
        stormPaths.water,
        0,
        sceneBase,
      );
      poolShade.addColorStop(0, 'rgba(255,255,255,0.12)');
      poolShade.addColorStop(0.35, 'rgba(0,0,0,0.2)');
      poolShade.addColorStop(1, 'rgba(0,0,0,0.6)');
      context.fillStyle = poolShade;
      setAlpha(context, opacity);
      context.fill(stormPaths.pool);
    }
    context.strokeStyle = '#fff';
    context.lineWidth = 1;
    setAlpha(context, opacity * (0.25 + stormPaths.bass * 0.3));
    context.stroke(stormPaths.surface);
    stormPaths.rings.forEach((band) => {
      setAlpha(context, opacity * band.alpha * 0.6);
      context.stroke(band.path);
    });
    setAlpha(context, opacity * 0.8);
    context.stroke(stormPaths.splashes);
    context.strokeStyle = stormRain;
    context.lineCap = 'round';
    context.lineWidth = 1.2;
    setAlpha(context, opacity * 0.55);
    context.stroke(stormPaths.rain);
    context.fillStyle = '#fff';
    setAlpha(context, opacity * 0.85);
    context.fill(stormPaths.heads);
  }
};

interface IPaintBonfireInput {
  firePaths: ReturnType<typeof createBonfirePaths> | undefined;
  context: CanvasRenderingContext2D;
  opacity: number;
  isFilled: boolean;
  sceneBase: number;
  fireOwnColours: boolean;
  canvasPaint: string | CanvasGradient;
}

/**
 * The bonfire's flames and embers, filled.
 */
export const paintBonfire = ({
  firePaths,
  context,
  opacity,
  isFilled,
  sceneBase,
  fireOwnColours,
  canvasPaint,
}: IPaintBonfireInput) => {
  if (firePaths) {
    // The smoke first, far behind; then the ground's glow breathing
    // with the bass; then the logs with their coals in the gaps.
    context.fillStyle = SMOKE_COLOUR;
    firePaths.smoke.forEach((band) => {
      setAlpha(context, opacity * band.alpha * 0.6);
      context.fill(band.path);
    });
    if (isFilled) {
      const glow = context.createRadialGradient(
        firePaths.glowX,
        sceneBase,
        0,
        firePaths.glowX,
        sceneBase,
        firePaths.glowRadius,
      );
      glow.addColorStop(0, 'rgba(255,140,40,0.35)');
      glow.addColorStop(0.5, 'rgba(255,90,20,0.1)');
      glow.addColorStop(1, 'rgba(255,60,10,0)');
      context.fillStyle = glow;
      setAlpha(context, opacity * (0.6 + firePaths.bass * 0.4));
      context.beginPath();
      context.arc(
        firePaths.glowX,
        sceneBase,
        firePaths.glowRadius,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
    // The coal bed first, then the logs over it: body, bark grain,
    // the end rings, and the cracks glowing through with the bass.
    const coal = fireOwnColours ? COAL_COLOUR : canvasPaint;
    context.fillStyle = coal;
    setAlpha(context, opacity * (0.35 + firePaths.bass * 0.65));
    context.fill(firePaths.coals);
    if (isFilled) {
      context.fillStyle = fireOwnColours ? LOG_COLOUR : '#1a1a1a';
      setAlpha(context, opacity);
      context.fill(firePaths.logs);
    }
    context.strokeStyle = fireOwnColours ? BARK_COLOUR : canvasPaint;
    context.lineWidth = 1.2;
    setAlpha(context, opacity * (isFilled ? 0.9 : 0.7));
    context.stroke(firePaths.logs);
    context.stroke(firePaths.bark);
    context.strokeStyle = fireOwnColours ? GRAIN_COLOUR : canvasPaint;
    context.lineWidth = 1;
    setAlpha(context, opacity * 0.8);
    context.stroke(firePaths.rings);
    context.strokeStyle = coal;
    context.lineWidth = 1.6;
    setAlpha(context, opacity * (0.3 + firePaths.bass * 0.7));
    context.stroke(firePaths.cracks);
  }
};

interface IStrokeStormInput {
  stormPaths: ReturnType<typeof createRainstormPaths> | undefined;
  context: CanvasRenderingContext2D;
  opacity: number;
  plot: { left: number; right: number; top: number; bottom: number };
  sceneFrame: { top: number; bottom: number };
}

/**
 * The clouds' edges and the bolts over the storm.
 */
export const strokeStorm = ({
  stormPaths,
  context,
  opacity,
  plot,
  sceneFrame,
}: IStrokeStormInput) => {
  if (stormPaths) {
    // The lightning: a wide soft glow, the bolt, its forks; and the
    // flash, a wash of white over the whole plot that fades in a few
    // frames.
    if (stormPaths.boltLife > 0) {
      context.strokeStyle = STORM_BOLT;
      context.lineJoin = 'round';
      context.lineWidth = 7;
      setAlpha(context, opacity * stormPaths.boltLife * 0.25);
      context.stroke(stormPaths.bolt);
      context.lineWidth = 2;
      setAlpha(context, opacity * stormPaths.boltLife);
      context.stroke(stormPaths.bolt);
      context.lineWidth = 1.2;
      setAlpha(context, opacity * stormPaths.boltLife * 0.8);
      context.stroke(stormPaths.fork);
    }
    if (stormPaths.flash > 0.02) {
      context.fillStyle = '#fff';
      setAlpha(context, opacity * stormPaths.flash * 0.3);
      context.fillRect(
        plot.left - (plot.right - plot.left),
        sceneFrame.top,
        (plot.right - plot.left) * 3,
        sceneFrame.bottom - sceneFrame.top,
      );
    }
  }
};

interface IStrokeBonfireInput {
  firePaths: ReturnType<typeof createBonfirePaths> | undefined;
  context: CanvasRenderingContext2D;
  opacity: number;
  isFilled: boolean;
  fireOwnColours: boolean;
  canvasPaint: string | CanvasGradient;
}

/**
 * The flames' edges over the fire.
 */
export const strokeBonfire = ({
  firePaths,
  context,
  opacity,
  isFilled,
  fireOwnColours,
  canvasPaint,
}: IStrokeBonfireInput) => {
  if (firePaths) {
    // The hotter middle and the white-hot core over the outer flame,
    // then the sparks. Stroked, the layers are outlines.
    const paintLayer = (path: Path2D, colour: string, alpha: number) => {
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
    paintLayer(firePaths.mid, fireOwnColours ? FIRE_MID : '#fff', 0.55);
    paintLayer(firePaths.core, fireOwnColours ? FIRE_CORE : '#fff', 0.85);
    context.fillStyle = fireOwnColours ? FIRE_MID : '#fff';
    firePaths.sparks.forEach((band, index) => {
      if (index === 0) {
        context.fillStyle = '#fff';
      } else {
        context.fillStyle = fireOwnColours ? COAL_COLOUR : canvasPaint;
      }
      setAlpha(context, opacity * band.alpha);
      context.fill(band.path);
    });
  }
};
