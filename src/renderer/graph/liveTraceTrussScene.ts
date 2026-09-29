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

import { setAlpha } from './liveTraceStyle';
import { TRUSS_INKS } from './trussBridge';
import { fireworkColour } from './bridgeFireworks';
import { type createTrussBridgePaths } from './trussBridgeLayout';

// The truss bridge on the live graph: its scenery and deck filled in the
// curve pass, and its lines stroked over them.

interface IPaintTrussSceneryInput {
  trussPaths: ReturnType<typeof createTrussBridgePaths> | undefined;
  context: CanvasRenderingContext2D;
  opacity: number;
  canvasPaint: string | CanvasGradient;
  strokeWidth: number;
  plot: { left: number; right: number; top: number; bottom: number };
  paintLowRes: (draw: (target: CanvasRenderingContext2D) => void) => void;
  isFilled: boolean;
}

/**
 * The bridge's scenery and deck, filled.
 */
export const paintTrussScenery = ({
  trussPaths,
  context,
  opacity,
  canvasPaint,
  strokeWidth,
  plot,
  paintLowRes,
  isFilled,
}: IPaintTrussSceneryInput) => {
  if (trussPaths) {
    context.fillStyle = '#fff';
    setAlpha(context, opacity * TRUSS_INKS.stars.dim);
    context.fill(trussPaths.stars);
    setAlpha(context, opacity * TRUSS_INKS.stars.bright(trussPaths.thump));
    context.fill(trussPaths.brightStars);
    /**
     * The truss under the deck, and on a beat its glow.
     *
     * The glow pass goes on the low-resolution surface with the
     * water. It is the widest stroking in the scene — twelve passes
     * over every member of a full-screen truss at six pixels — and
     * it was ten milliseconds a frame on its own, which is the whole
     * frame budget for a blur nobody can see the edge of.
     */
    const bridgeGlow = trussPaths.thump;
    const { member } = TRUSS_INKS;
    const paintMembers = (
      target: CanvasRenderingContext2D,
      glowing: boolean,
    ) => {
      trussPaths.members.forEach((band, depth) => {
        const fade = member.fade(depth);
        band.forEach((members, bin) => {
          const burn = member.burn(bin);
          target.strokeStyle = canvasPaint;
          if (glowing) {
            target.lineWidth =
              member.width(strokeWidth) + member.glowWiden * bridgeGlow;
            setAlpha(
              target,
              opacity * fade * burn * bridgeGlow * member.glowAlpha,
            );
          } else {
            target.lineWidth = member.width(strokeWidth);
            setAlpha(target, opacity * Math.min(1, fade * burn));
          }
          target.stroke(members);
        });
      });
    };
    paintMembers(context, false);
    context.strokeStyle = canvasPaint;
    setAlpha(context, opacity * TRUSS_INKS.footing);
    context.stroke(trussPaths.footing);
    const hazeTop = trussPaths.horizon - trussPaths.horizonHaze;
    const paintSea = (target: CanvasRenderingContext2D) => {
      if (bridgeGlow > 0) {
        paintMembers(target, true);
      }
      target.fillStyle = canvasPaint;
      trussPaths.sea.forEach((strip, index) => {
        setAlpha(target, opacity * TRUSS_INKS.sea(index, trussPaths.bass));
        target.fill(strip);
      });
      // On the water's surface, because it is a soft gradient over
      // the same wide area and costs the same to blend.
      const haze = target.createLinearGradient(
        0,
        hazeTop,
        0,
        trussPaths.horizon + trussPaths.horizonHaze * TRUSS_INKS.haze.below,
      );
      TRUSS_INKS.haze.stops.forEach(({ at, alpha }) => {
        haze.addColorStop(at, `rgba(255,255,255,${alpha})`);
      });
      target.fillStyle = haze;
      setAlpha(target, opacity * TRUSS_INKS.haze.alpha(trussPaths.bass));
      target.fillRect(
        plot.left - (plot.right - plot.left),
        hazeTop,
        (plot.right - plot.left) * 3,
        trussPaths.horizonHaze * (1 + TRUSS_INKS.haze.below),
      );
    };
    paintLowRes(paintSea);
    context.strokeStyle = '#fff';
    context.lineWidth = TRUSS_INKS.horizon.width;
    setAlpha(context, opacity * TRUSS_INKS.horizon.alpha);
    context.beginPath();
    context.moveTo(plot.left - (plot.right - plot.left), trussPaths.horizon);
    context.lineTo(plot.right + (plot.right - plot.left), trussPaths.horizon);
    context.stroke();
    const { body, outline } = TRUSS_INKS;
    context.fillStyle = isFilled ? canvasPaint : body.openColour;
    setAlpha(context, opacity * (isFilled ? body.filled : body.open));
    context.fill(trussPaths.piers);
    context.fill(trussPaths.towers);
    context.fill(trussPaths.towersBelow);
    context.strokeStyle = canvasPaint;
    context.lineWidth = outline.width;
    setAlpha(context, opacity * outline.piers);
    context.stroke(trussPaths.piers);
    setAlpha(context, opacity * outline.towers);
    context.stroke(trussPaths.towers);
    context.stroke(trussPaths.towersBelow);
    context.lineWidth = TRUSS_INKS.bracing.width;
    setAlpha(context, opacity * TRUSS_INKS.bracing.alpha);
    context.stroke(trussPaths.bracing);
    context.stroke(trussPaths.bracingBelow);
    context.lineWidth = TRUSS_INKS.hangers.width;
    setAlpha(context, opacity * TRUSS_INKS.hangers.alpha);
    context.stroke(trussPaths.hangers);
    const { cable } = TRUSS_INKS;
    context.strokeStyle = canvasPaint;
    context.lineWidth = cable.tintWidth(trussPaths.bass);
    setAlpha(context, opacity * cable.tintAlpha(trussPaths.bass));
    context.stroke(trussPaths.cables);
    context.strokeStyle = '#fff';
    context.lineWidth = cable.wireWidth(trussPaths.bass, trussPaths.thump);
    setAlpha(
      context,
      opacity * cable.wireAlpha(trussPaths.bass, trussPaths.thump),
    );
    context.stroke(trussPaths.cables);
  }
};

interface IStrokeTrussBridgeInput {
  trussPaths: ReturnType<typeof createTrussBridgePaths> | undefined;
  context: CanvasRenderingContext2D;
  opacity: number;
  figure: Path2D;
  isFilled: boolean;
  canvasPaint: string | CanvasGradient;
}

/**
 * The bridge's lines over its fill.
 */
export const strokeTrussBridge = ({
  trussPaths,
  context,
  opacity,
  figure,
  isFilled,
  canvasPaint,
}: IStrokeTrussBridgeInput) => {
  if (trussPaths) {
    context.strokeStyle = TRUSS_INKS.asphalt.colour;
    context.lineWidth = trussPaths.roadHalf * 2;
    setAlpha(context, opacity * TRUSS_INKS.asphalt.alpha);
    context.stroke(figure);
    context.strokeStyle = '#fff';
    context.lineWidth = TRUSS_INKS.edge.width;
    setAlpha(context, opacity * TRUSS_INKS.edge.alpha);
    context.stroke(trussPaths.edges);
    context.lineWidth = TRUSS_INKS.dash.width(trussPaths.roadHalf);
    setAlpha(context, opacity * TRUSS_INKS.dash.alpha);
    context.stroke(trussPaths.dashes);
    const { car: carInk } = TRUSS_INKS;
    trussPaths.cars.forEach((car) => {
      context.strokeStyle = car.colour;
      context.lineJoin = 'round';
      carInk.glow.forEach((glow) => {
        context.lineWidth = glow.width(car.level);
        setAlpha(context, opacity * car.level * glow.alpha);
        context.stroke(car.body);
      });
      if (isFilled) {
        context.fillStyle = car.colour;
        setAlpha(context, opacity);
        context.fill(car.body);
        context.fillStyle = carInk.dark;
        context.fill(car.dark);
      } else {
        context.lineWidth = carInk.outline;
        setAlpha(context, opacity);
        context.stroke(car.body);
        setAlpha(context, opacity * carInk.darkOutline);
        context.stroke(car.dark);
      }
      context.strokeStyle = '#fff';
      context.lineWidth = carInk.rim.width;
      setAlpha(context, opacity * carInk.rim.alpha);
      context.stroke(car.wheels);
      context.fillStyle = car.colour;
      setAlpha(context, opacity * carInk.hub);
      context.fill(car.hubs);
    });
    context.fillStyle = '#fff';
    setAlpha(context, opacity * TRUSS_INKS.cone(trussPaths.thump));
    context.fill(trussPaths.lampCones);
    context.fillStyle = canvasPaint;
    setAlpha(context, opacity * TRUSS_INKS.lampOff);
    context.fill(trussPaths.lampsOff);
    context.fillStyle = '#fff';
    setAlpha(context, opacity * TRUSS_INKS.lampOn(trussPaths.thump));
    context.fill(trussPaths.lampsOn);
    context.strokeStyle = '#fff';
    context.lineWidth = TRUSS_INKS.reflection.width;
    setAlpha(context, opacity * TRUSS_INKS.reflection.alpha(trussPaths.thump));
    context.stroke(trussPaths.reflections);
    // Fireworks. Each burst arrives as bands painted back to front:
    // the coolest, faintest end of the tail first, the white-hot head
    // last, so one shell shows the whole colour ramp at once. See
    // bridgeFireworks for why that is what stops them reading cheap.
    const { firework: fireworkInk } = TRUSS_INKS;
    context.lineCap = 'butt';
    trussPaths.fireworks.forEach((firework) => {
      const head = firework.bands[firework.bands.length - 1];
      if (firework.reflection) {
        context.strokeStyle = fireworkColour(
          head.hue,
          fireworkInk.reflectionLightness,
        );
        context.lineWidth = fireworkInk.reflectionWidth;
        setAlpha(context, opacity * firework.reflectionAlpha);
        context.stroke(firework.reflection);
      }
      if (firework.flash) {
        context.fillStyle = '#fff';
        setAlpha(context, opacity * fireworkInk.flash);
        context.fill(firework.flash);
      }
      if (firework.ring) {
        context.strokeStyle = '#fff';
        context.lineWidth = firework.ringWidth;
        setAlpha(context, opacity * firework.ringAlpha);
        context.stroke(firework.ring);
      }
      firework.bands.forEach((band) => {
        context.strokeStyle = fireworkColour(band.hue, band.lightness);
        context.lineWidth = band.width;
        context.lineCap = band.round ? 'round' : 'butt';
        setAlpha(context, opacity * band.alpha);
        context.stroke(band.path);
      });
      if (firework.twinkle) {
        context.strokeStyle = '#fff';
        context.lineWidth = fireworkInk.twinkle.width;
        setAlpha(context, opacity * fireworkInk.twinkle.alpha);
        context.stroke(firework.twinkle);
      }
    });
  }
};
