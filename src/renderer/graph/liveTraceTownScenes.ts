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

import { type RefObject } from 'react';
import { setAlpha } from './liveTraceStyle';
import { cityInks, type createCitySkylinePaths } from './citySkyline';
import { type NightSurfaces, paintMoonHalo } from './nightSurfaces';
import { isLightWindow } from '../utils/windowSide';
import { markFill } from './sceneViews/sceneFrame';
import { type createSlopeFieldPaths } from './slopeField';
import { type createCrystalSpikesPaths } from './crystalSpikes';
import { type createBraidStagePaths } from './braidStage';

// The quieter sceneries of the live graph: the field, the city, the
// crystals and the stage, each filled and then stroked.

interface IPaintFieldInput {
  fieldPaths: ReturnType<typeof createSlopeFieldPaths> | undefined;
  enterSceneSpace: () => void;
  context: CanvasRenderingContext2D;
  canvasPaint: string | CanvasGradient;
  opacity: number;
  strokeWidth: number;
}

/**
 * The field's rows and the sky over them.
 */
export const paintField = ({
  fieldPaths,
  enterSceneSpace,
  context,
  canvasPaint,
  opacity,
  strokeWidth,
}: IPaintFieldInput) => {
  if (fieldPaths) {
    // The field first, in the look's own colour: the grid of ticks
    // from faintest to brightest, the beat's band leaving the curve,
    // then the motes riding the flow.
    enterSceneSpace();
    context.lineCap = 'butt';
    context.lineJoin = 'round';
    context.strokeStyle = canvasPaint;
    [...fieldPaths.bands].reverse().forEach((band) => {
      context.lineWidth = band.width;
      setAlpha(context, opacity * band.alpha * (0.85 + fieldPaths.bass * 0.3));
      context.stroke(band.path);
    });
    if (fieldPaths.pulseAlpha > 0) {
      context.lineWidth = Math.max(1, strokeWidth * 0.8);
      setAlpha(context, opacity * fieldPaths.pulseAlpha);
      context.stroke(fieldPaths.pulse);
    }
    context.lineCap = 'round';
    fieldPaths.flow.forEach((band, index) => {
      // The heads white on a dark window, in the window's ink on a light one.
      context.strokeStyle = index === 0 ? markFill(1) : canvasPaint;
      context.lineWidth = band.width;
      setAlpha(context, opacity * band.alpha);
      context.stroke(band.path);
    });
    context.restore();
  }
};

interface IPaintCityInput {
  cityPaths: ReturnType<typeof createCitySkylinePaths> | undefined;
  enterSceneSpace: () => void;
  context: CanvasRenderingContext2D;
  opacity: number;
  nightRef: RefObject<NightSurfaces>;
  ratio: number;
}

/**
 * The city's towers and windows, filled.
 */
export const paintCity = ({
  cityPaths,
  enterSceneSpace,
  context,
  opacity,
  nightRef,
  ratio,
}: IPaintCityInput) => {
  if (cityPaths) {
    // No sky painted: the stars and the moon stand over whatever is
    // behind the graph.
    enterSceneSpace();
    context.fillStyle = cityInks().star;
    // No stars by day: a light window is a daytime sky.
    if (!isLightWindow()) {
      cityPaths.stars.forEach((band) => {
        setAlpha(context, opacity * band.alpha);
        context.fill(band.path);
      });
    }
    setAlpha(context, opacity * cityPaths.layout.haloAlpha);
    paintMoonHalo(
      context,
      nightRef.current,
      cityPaths.moonX,
      cityPaths.moonY,
      cityPaths.moonRadius,
      ratio,
    );
    context.fillStyle = cityInks().moon.colour;
    setAlpha(context, opacity * cityInks().moon.alpha);
    context.beginPath();
    context.arc(
      cityPaths.moonX,
      cityPaths.moonY,
      cityPaths.moonRadius,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.fillStyle = cityInks().crater.colour;
    setAlpha(context, opacity * cityInks().crater.alpha);
    context.fill(cityPaths.craters);
    context.restore();
  }
};

interface IPaintCrystalsInput {
  crystalPaths: ReturnType<typeof createCrystalSpikesPaths> | undefined;
  isFilled: boolean;
  context: CanvasRenderingContext2D;
  sceneBase: number;
  opacity: number;
  plot: { left: number; right: number; top: number; bottom: number };
}

/**
 * The crystals, filled.
 */
export const paintCrystals = ({
  crystalPaths,
  isFilled,
  context,
  sceneBase,
  opacity,
  plot,
}: IPaintCrystalsInput) => {
  // One drawing for every style. A filled style paints the same shape
  // rather than stroking it — which is a fill, not a second figure, so
  // cycling styles never changes what is drawn, only how.
  if (crystalPaths && isFilled) {
    // The floor glows up into the spikes with the bass.
    const floor = context.createLinearGradient(
      0,
      sceneBase - crystalPaths.glowHeight,
      0,
      sceneBase,
    );
    floor.addColorStop(0, 'rgba(255,255,255,0)');
    floor.addColorStop(1, 'rgba(255,255,255,0.07)');
    context.fillStyle = floor;
    setAlpha(context, opacity * (0.3 + crystalPaths.bass * 0.5));
    context.fillRect(
      plot.left,
      sceneBase - crystalPaths.glowHeight,
      plot.right - plot.left,
      crystalPaths.glowHeight,
    );
  }
};

interface IPaintStageInput {
  stagePaths: ReturnType<typeof createBraidStagePaths> | undefined;
  context: CanvasRenderingContext2D;
  canvasPaint: string | CanvasGradient;
  opacity: number;
  plot: { left: number; right: number; top: number; bottom: number };
  sceneBase: number;
  figureStrokeWidth: number;
  figure: Path2D;
}

/**
 * The stage and its lights, filled.
 */
export const paintStage = ({
  stagePaths,
  context,
  canvasPaint,
  opacity,
  plot,
  sceneBase,
  figureStrokeWidth,
  figure,
}: IPaintStageInput) => {
  if (stagePaths) {
    // The floor in the look's colour, brighter with the bass, and the
    // braid reflected in it: the figure again, flipped about the
    // horizon and squashed to a quarter, clipped to the floor.
    context.strokeStyle = canvasPaint;
    context.lineWidth = 1;
    setAlpha(context, opacity * (0.1 + stagePaths.bass * 0.22));
    context.stroke(stagePaths.floor);
    context.save();
    context.beginPath();
    context.rect(
      plot.left,
      stagePaths.horizon,
      plot.right - plot.left,
      sceneBase - stagePaths.horizon,
    );
    context.clip();
    context.translate(0, stagePaths.horizon);
    context.scale(1, -0.28);
    context.translate(0, -stagePaths.horizon);
    context.lineWidth = Math.max(1, figureStrokeWidth);
    // Faint: at a fifth it read as a second braid under the first.
    setAlpha(context, opacity * 0.1);
    context.stroke(figure);
    context.restore();
  }
};

interface IStrokeCityInput {
  cityPaths: ReturnType<typeof createCitySkylinePaths> | undefined;
  context: CanvasRenderingContext2D;
  sceneBase: number;
  opacity: number;
  plot: { left: number; right: number; top: number; bottom: number };
  isFilled: boolean;
}

/**
 * The towers' edges over the city.
 */
export const strokeCity = ({
  cityPaths,
  context,
  sceneBase,
  opacity,
  plot,
  isFilled,
}: IStrokeCityInput) => {
  if (cityPaths) {
    // The city's own light: a haze along the foot of the block with
    // the bass, then the dark windows, the lit ones, and the red
    // beacons on the masts.
    const haze = context.createLinearGradient(
      0,
      sceneBase - cityPaths.hazeHeight,
      0,
      sceneBase,
    );
    const hazeInk = cityInks().haze.rgb.join(',');
    haze.addColorStop(0, `rgba(${hazeInk},0)`);
    haze.addColorStop(1, `rgba(${hazeInk},${cityInks().haze.alpha})`);
    context.fillStyle = haze;
    setAlpha(context, opacity * cityPaths.layout.hazeAlpha);
    context.fillRect(
      plot.left,
      sceneBase - cityPaths.hazeHeight,
      plot.right - plot.left,
      cityPaths.hazeHeight,
    );
    if (isFilled) {
      context.fillStyle = cityInks().dim.colour;
      setAlpha(context, opacity * cityInks().dim.alpha);
      context.fill(cityPaths.dim);
      context.fillStyle = cityInks().lit;
      setAlpha(context, opacity * cityPaths.layout.litAlpha);
      context.fill(cityPaths.lit);
    }
    context.fillStyle = cityInks().beacon.colour;
    setAlpha(context, opacity * cityInks().beacon.alpha);
    context.fill(cityPaths.beacons);
  }
};

interface IStrokeCrystalsInput {
  crystalPaths: ReturnType<typeof createCrystalSpikesPaths> | undefined;
  isFilled: boolean;
  context: CanvasRenderingContext2D;
  opacity: number;
}

/**
 * The crystals' facets over their fill.
 */
export const strokeCrystals = ({
  crystalPaths,
  isFilled,
  context,
  opacity,
}: IStrokeCrystalsInput) => {
  if (crystalPaths) {
    // The crystal's faces — lit on the left, shaded on the right — and
    // the glints at the tips.
    if (isFilled) {
      // A shaded right side on every spike: that is what separates a
      // spike from its neighbour. No lit side — white over the colour
      // lightened it toward pastel — and no edge lines, which read as
      // an outline drawn round the drawing.
      context.fillStyle = '#000';
      setAlpha(context, opacity * 0.26);
      context.fill(crystalPaths.shade);
    }
    context.strokeStyle = '#fff';
    context.lineWidth = 1.2;
    context.lineCap = 'round';
    setAlpha(context, opacity * 0.95);
    context.stroke(crystalPaths.glints);
  }
};

interface IStrokeStageInput {
  stagePaths: ReturnType<typeof createBraidStagePaths> | undefined;
  context: CanvasRenderingContext2D;
  opacity: number;
}

/**
 * The stage's edges over its fill.
 */
export const strokeStage = ({
  stagePaths,
  context,
  opacity,
}: IStrokeStageInput) => {
  if (stagePaths) {
    context.fillStyle = '#fff';
    stagePaths.motes.forEach((band) => {
      setAlpha(context, opacity * band.alpha);
      context.fill(band.path);
    });
    context.strokeStyle = '#fff';
    context.lineWidth = 1.3;
    context.lineJoin = 'round';
    setAlpha(context, opacity * 0.9);
    context.stroke(stagePaths.sparks);
  }
};
