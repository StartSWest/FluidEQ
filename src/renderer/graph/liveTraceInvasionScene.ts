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

import INVADER_INKS from './invaderInks';
import { setAlpha } from './liveTraceStyle';
import { type createSpaceInvasionPaths } from './spaceInvasionLayout';

// The space fight on the live graph: the formation, its shots and the
// shelter filled, and the formation's outline stroked over them.

interface IPaintInvasionInput {
  invasionPaths: ReturnType<typeof createSpaceInvasionPaths> | undefined;
  context: CanvasRenderingContext2D;
  opacity: number;
  isFilled: boolean;
  shelterPath: Path2D | undefined;
  canvasPaint: string | CanvasGradient;
}

/**
 * The formation, its shots, the shelter and the cabinet's readouts.
 */
export const paintInvasion = ({
  invasionPaths,
  context,
  opacity,
  isFilled,
  shelterPath,
  canvasPaint,
}: IPaintInvasionInput) => {
  if (invasionPaths) {
    // The star field first, three layers, brighter in warp; then the
    // saucer, the bolts and the lasers, the ship with its engines,
    // the bursts, and a soft glow round the formation before the
    // aliens themselves are painted as the figure.
    const ink = INVADER_INKS;
    const { unit, thump } = invasionPaths;
    context.strokeStyle = ink.stars.colour;
    context.lineCap = 'round';
    invasionPaths.stars.forEach((band, layer) => {
      context.lineWidth = ink.stars.width(layer);
      setAlpha(
        context,
        opacity * band.alpha * ink.stars.lift(invasionPaths.warp),
      );
      context.stroke(band.path);
    });
    context.strokeStyle = ink.saucer.colour;
    context.lineWidth = unit * ink.saucer.glowWidth;
    context.lineJoin = 'round';
    setAlpha(context, opacity * ink.saucer.glowAlpha(thump));
    context.stroke(invasionPaths.saucer);
    context.fillStyle = ink.saucer.colour;
    setAlpha(context, opacity * ink.saucer.alpha);
    if (isFilled) {
      context.fill(invasionPaths.saucer);
    } else {
      context.lineWidth = ink.outline;
      context.stroke(invasionPaths.saucer);
    }
    context.fillStyle = ink.saucer.lights;
    setAlpha(context, opacity);
    context.fill(invasionPaths.saucerLights);
    context.strokeStyle = ink.plasma.halo;
    context.lineWidth = unit * ink.plasma.haloWidth;
    setAlpha(context, opacity * ink.plasma.haloAlpha);
    context.stroke(invasionPaths.plasmaFlame);
    context.fillStyle = ink.plasma.flame;
    setAlpha(context, opacity * ink.plasma.flameAlpha);
    context.fill(invasionPaths.plasmaFlame);
    context.fillStyle = ink.plasma.core;
    setAlpha(context, opacity);
    context.fill(invasionPaths.plasmaCore);
    context.strokeStyle = ink.bolts.colour;
    context.lineWidth = unit * ink.bolts.glowWidth;
    setAlpha(context, opacity * ink.bolts.glowAlpha);
    context.stroke(invasionPaths.bolts);
    context.lineWidth = unit * ink.bolts.width;
    setAlpha(context, opacity * ink.bolts.alpha);
    context.stroke(invasionPaths.bolts);
    context.strokeStyle = ink.shots.glow;
    context.lineWidth = unit * ink.shots.glowWidth;
    setAlpha(context, opacity * ink.shots.glowAlpha);
    context.stroke(invasionPaths.shots);
    context.strokeStyle = ink.shots.core;
    context.lineWidth = unit * ink.shots.width;
    setAlpha(context, opacity * ink.shots.alpha);
    context.stroke(invasionPaths.shots);
    // The shelters over the fire that is eating them, so a bolt is
    // seen to stop AT the arch rather than in front of it.
    if (shelterPath) {
      setAlpha(context, opacity);
      if (isFilled) {
        context.fillStyle = ink.shelter;
        context.fill(shelterPath);
      } else {
        context.strokeStyle = ink.shelter;
        context.lineWidth = ink.outline;
        context.stroke(shelterPath);
      }
    }
    // Stroked, every layer of the ship is outlined.
    context.strokeStyle = ink.ship.glow;
    context.lineWidth = ink.ship.glowWidth;
    context.lineJoin = 'round';
    setAlpha(context, opacity * ink.ship.glowAlpha(thump));
    context.stroke(invasionPaths.hull);
    const paintPart = (path: Path2D, colour: string, alpha: number) => {
      setAlpha(context, opacity * alpha);
      if (isFilled) {
        context.fillStyle = colour;
        context.fill(path);
      } else {
        context.strokeStyle = colour;
        context.lineWidth = ink.outline;
        context.stroke(path);
      }
    };
    const { ship } = ink;
    paintPart(invasionPaths.flame, ship.flame.colour, ship.flame.alpha);
    paintPart(invasionPaths.core, ship.core.colour, ship.core.alpha);
    paintPart(invasionPaths.hull, ship.hull.colour, ship.hull.alpha);
    paintPart(invasionPaths.stripes, ship.stripes.colour, ship.stripes.alpha);
    paintPart(invasionPaths.canopy, ship.canopy.colour, ship.canopy.alpha);
    context.fillStyle = ship.flash.colour;
    setAlpha(context, opacity * ship.flash.alpha);
    context.fill(invasionPaths.shipFlash);
    context.fill(invasionPaths.muzzle);
    context.strokeStyle = ink.shield.colour;
    context.lineWidth = unit * ink.shield.glowWidth;
    context.lineJoin = 'round';
    setAlpha(context, opacity * ink.shield.glowAlpha);
    context.stroke(invasionPaths.shield);
    context.fillStyle = ink.shield.colour;
    setAlpha(context, opacity * ink.shield.alpha(thump));
    context.fill(invasionPaths.shield);
    const { wreckage } = invasionPaths;
    if (wreckage) {
      const { glow } = wreckage;
      context.fillStyle = ink.wreck.fire;
      setAlpha(context, opacity * ink.wreck.fireAlpha(glow));
      context.fill(wreckage.fire);
      context.fillStyle = ink.wreck.heart;
      setAlpha(context, opacity * ink.wreck.heartAlpha(glow));
      context.fill(wreckage.heart);
      const flashed = (colour: string) =>
        wreckage.flash ? ink.wreck.flash : colour;
      paintPart(wreckage.hull, flashed(ship.hull.colour), glow);
      paintPart(wreckage.stripes, flashed(ship.stripes.colour), glow);
      paintPart(wreckage.canopy, flashed(ship.canopy.colour), glow);
    }
    // The bursts in the alien's own colour, fading.
    context.fillStyle = canvasPaint;
    invasionPaths.bursts.forEach((band) => {
      setAlpha(context, opacity * band.alpha);
      context.fill(band.path);
    });
    context.strokeStyle = canvasPaint;
    context.lineWidth = ink.formation.glowWidth;
    setAlpha(context, opacity * ink.formation.glowAlpha(thump));
    context.stroke(invasionPaths.shape);
  }
};

interface IStrokeInvasionInput {
  invasionPaths: ReturnType<typeof createSpaceInvasionPaths> | undefined;
  context: CanvasRenderingContext2D;
  opacity: number;
}

/**
 * The formation's outline over its fill.
 */
export const strokeInvasion = ({
  invasionPaths,
  context,
  opacity,
}: IStrokeInvasionInput) => {
  if (invasionPaths) {
    // A hit alien flashes white.
    context.fillStyle = INVADER_INKS.hit.colour;
    setAlpha(context, opacity * INVADER_INKS.hit.alpha);
    context.fill(invasionPaths.flash);
    // The points won, over everything: painted with the rest of the
    // scene they came out under the formation and could not be read.
    context.fillStyle = INVADER_INKS.points.colour;
    setAlpha(context, opacity * INVADER_INKS.points.alpha);
    context.fill(invasionPaths.popups);
    setAlpha(context, opacity * INVADER_INKS.points.fading);
    context.fill(invasionPaths.popupsFading);
  }
};
