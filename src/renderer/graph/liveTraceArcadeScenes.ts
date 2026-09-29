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
  ARCADE_MORTAR,
  ARCADE_SHADE,
  ARCADE_STONE,
  ARCADE_WATER,
  type createStoneArcadePaths,
} from './stoneArcade';
import { setAlpha } from './liveTraceStyle';
import { type createWarpTunnelPaths } from './warpTunnel';

// The arcade and the warp tunnel on the live graph.

interface IPaintArcadeInput {
  arcadePaths: ReturnType<typeof createStoneArcadePaths> | undefined;
  arcadeOwnColours: boolean;
  canvasPaint: string | CanvasGradient;
  context: CanvasRenderingContext2D;
  opacity: number;
  isFilled: boolean;
  sceneBase: number;
}

/**
 * The arcade's sky and skyline, filled.
 */
export const paintArcade = ({
  arcadePaths,
  arcadeOwnColours,
  canvasPaint,
  context,
  opacity,
  isFilled,
  sceneBase,
}: IPaintArcadeInput) => {
  if (arcadePaths) {
    // The night over the parapet: stars, the twinkling ones brighter,
    // the birds when they cross; then the river, lit at the surface,
    // glowing with the bass, with the arcade reflected in it.
    const arcadeWater = arcadeOwnColours ? ARCADE_WATER : canvasPaint;
    context.fillStyle = '#fff';
    setAlpha(context, opacity * 0.35);
    context.fill(arcadePaths.stars);
    setAlpha(context, opacity * (0.7 + arcadePaths.thump * 0.3));
    context.fill(arcadePaths.brightStars);
    context.strokeStyle = '#fff';
    context.lineWidth = 1.2;
    context.lineJoin = 'round';
    setAlpha(context, opacity * 0.8);
    context.stroke(arcadePaths.birds);
    if (isFilled) {
      context.fillStyle = arcadeWater;
      setAlpha(context, opacity * (0.55 + arcadePaths.bass * 0.25));
      context.fill(arcadePaths.river);
      context.save();
      context.clip(arcadePaths.river);
      context.fillStyle = arcadeOwnColours ? ARCADE_STONE : canvasPaint;
      setAlpha(context, opacity * 0.22);
      context.fill(arcadePaths.reflection);
      context.restore();
      const riverShade = context.createLinearGradient(
        0,
        arcadePaths.water,
        0,
        sceneBase,
      );
      riverShade.addColorStop(0, 'rgba(255,255,255,0.14)');
      riverShade.addColorStop(0.3, 'rgba(0,0,0,0.2)');
      riverShade.addColorStop(1, 'rgba(0,0,0,0.65)');
      context.fillStyle = riverShade;
      setAlpha(context, opacity);
      context.fill(arcadePaths.river);
    }
    context.strokeStyle = '#fff';
    context.lineWidth = 1;
    setAlpha(context, opacity * (0.12 + arcadePaths.bass * 0.15));
    context.stroke(arcadePaths.ripples);
  }
};

interface IPaintWarpInput {
  warpPaths: ReturnType<typeof createWarpTunnelPaths> | undefined;
  context: CanvasRenderingContext2D;
  opacity: number;
  canvasPaint: string | CanvasGradient;
}

/**
 * The warp tunnel's rings and streaks.
 */
export const paintWarp = ({
  warpPaths,
  context,
  opacity,
  canvasPaint,
}: IPaintWarpInput) => {
  if (warpPaths) {
    // The sky first, far to near, then the core's glow in the look's
    // colour breathing with the bass, the rings, the rocks; the
    // streaks are the figure and come after, with a glow of their own.
    context.fillStyle = '#fff';
    context.strokeStyle = '#fff';
    context.lineWidth = 1.2;
    context.lineCap = 'round';
    warpPaths.sky.forEach((band, layer) => {
      setAlpha(context, opacity * band.alpha);
      if (layer === 2) {
        context.stroke(band.path);
      } else {
        context.fill(band.path);
      }
    });
    // The core: a white glow that falls off fast, breathing with the
    // bass. A disc of the look's colour here read as a planet.
    const coreRadius = warpPaths.coreRadius * 1.6;
    const core = context.createRadialGradient(
      warpPaths.focusX,
      warpPaths.focusY,
      0,
      warpPaths.focusX,
      warpPaths.focusY,
      coreRadius,
    );
    core.addColorStop(0, 'rgba(255,255,255,0.85)');
    core.addColorStop(0.18, 'rgba(255,255,255,0.28)');
    core.addColorStop(0.5, 'rgba(255,255,255,0.06)');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = core;
    setAlpha(context, opacity);
    context.beginPath();
    context.arc(warpPaths.focusX, warpPaths.focusY, coreRadius, 0, Math.PI * 2);
    context.fill();
    // The waves: each with its wake behind it, a soft wide glow under
    // a bright edge.
    warpPaths.rings.forEach((ring) => {
      context.strokeStyle = canvasPaint;
      context.lineWidth = ring.width;
      setAlpha(context, opacity * ring.alpha * 0.3);
      context.stroke(ring.wake);
      context.strokeStyle = '#fff';
      context.lineWidth = ring.width * 1.2;
      setAlpha(context, opacity * ring.alpha * 0.9);
      context.stroke(ring.path);
    });
    // The rocks: dark bodies edged in the look's colour, and lit up
    // white on the beat.
    // The asteroids: the trail first, then a grey body with its far
    // side in shadow and a crater or two, lit white on the beat, edged
    // in the look's colour.
    context.strokeStyle = canvasPaint;
    context.lineWidth = 2;
    setAlpha(context, opacity * (0.25 + warpPaths.thump * 0.35));
    context.stroke(warpPaths.rockTrails);
    context.fillStyle = '#6b6f78';
    setAlpha(context, opacity);
    context.fill(warpPaths.rocks);
    context.fillStyle = '#000';
    setAlpha(context, opacity * 0.45);
    context.fill(warpPaths.rockShade);
    context.fill(warpPaths.craters);
    context.fillStyle = '#fff';
    setAlpha(context, opacity * warpPaths.thump * 0.5);
    context.fill(warpPaths.rocks);
    context.strokeStyle = canvasPaint;
    context.lineWidth = 1.2 + warpPaths.thump * 1.8;
    setAlpha(context, opacity * (0.8 + warpPaths.thump * 0.2));
    context.stroke(warpPaths.rockEdges);
    // No glow pass over the streaks: at 2560 wide the figure's own
    // stroke is already the frame's biggest cost, see the halo note.
  }
};

interface IStrokeArcadeInput {
  arcadePaths: ReturnType<typeof createStoneArcadePaths> | undefined;
  arcadeOwnColours: boolean;
  canvasPaint: string | CanvasGradient;
  isFilled: boolean;
  context: CanvasRenderingContext2D;
  opacity: number;
}

/**
 * The arcade's outlines over its fill.
 */
export const strokeArcade = ({
  arcadePaths,
  arcadeOwnColours,
  canvasPaint,
  isFilled,
  context,
  opacity,
}: IStrokeArcadeInput) => {
  if (arcadePaths) {
    // The wall over the sky, the openings cut out of it, then the
    // masonry drawn on it: voussoir joints, keystones, capitals and
    // courses, the parapet. Stroked, the wall is its outline.
    const stone = arcadeOwnColours ? ARCADE_STONE : canvasPaint;
    const mortar = arcadeOwnColours ? ARCADE_MORTAR : '#000';
    if (isFilled) {
      // One fill for the wall, in the shaded stone: a second even-odd
      // pass for the shade cost a millisecond on its own.
      context.fillStyle = arcadeOwnColours ? ARCADE_SHADE : canvasPaint;
      setAlpha(context, opacity);
      context.fill(arcadePaths.wall, 'evenodd');
      context.fillStyle = stone;
      setAlpha(context, opacity * 0.9);
      context.fill(arcadePaths.keystones);
    }
    context.strokeStyle = mortar;
    context.lineWidth = 1;
    setAlpha(context, opacity * (isFilled ? 0.55 : 0.8));
    if (!isFilled) {
      // Filled, the openings' edges are the figure's own stroke.
      context.stroke(arcadePaths.wall);
    }
    context.stroke(arcadePaths.joints);
    context.stroke(arcadePaths.keystones);
    setAlpha(context, opacity * (isFilled ? 0.35 : 0.6));
    context.stroke(arcadePaths.courses);
    context.stroke(arcadePaths.parapet);
    // The lanterns: warm, and a flare when the band under them hits.
    context.fillStyle = '#ffd27a';
    setAlpha(context, opacity * 0.25);
    context.fill(arcadePaths.flares);
    context.strokeStyle = '#ffd27a';
    context.lineWidth = 1;
    setAlpha(context, opacity * 0.9);
    context.stroke(arcadePaths.lanterns);
    context.fillStyle = '#fff3c0';
    setAlpha(context, opacity * 0.9);
    context.fill(arcadePaths.lanterns);
    // The embers.
    context.fillStyle = '#ffb060';
    arcadePaths.embers.forEach((band) => {
      setAlpha(context, opacity * band.alpha);
      context.fill(band.path);
    });
  }
};
