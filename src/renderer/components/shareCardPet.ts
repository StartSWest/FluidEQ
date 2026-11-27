/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { drawFurPet, furPalette } from '../pet/furPaint';
import { type IPetPose, REST_POSE } from '../pet/petChoreography';
import { alphaOf, hexOf, type IShareCardInks } from './shareCardInks';

/**
 * THE PET ON THE SHARE CARD, MID-JUMP (Ivan, 2026-11-27: "B with a music
 * wave bg", "add some nice touch it will be of the color of the user app
 * color"). Drawn by the painter the app draws her with (`furPaint.ts`), in a
 * pose of her own choreography's parts: off the ground, stretched up, feet
 * tucked, ears flung out, the "perfect" face a tap earns in the game and the
 * sound in her eyes. Under her a pool of the window's light where she will
 * land, and round her a few twinkles in the window's colours — light, never a
 * shadow (Ivan, 2026-11-19: "no dropshadow always clean").
 */

/** Her jump, in her choreography's own terms (`petPose.ts`). */
export const CHEER_POSE: IPetPose = {
  ...REST_POSE,
  hop: 0.5,
  lean: -0.07,
  swayX: -0.02,
  scaleX: 0.94,
  scaleY: 1.08,
  earLeft: -0.42,
  earRight: 0.4,
  footLeft: 0.7,
  footRight: 0.5,
  pawLeft: 1,
  pawRight: 1,
  furSwing: -0.06,
  furBass: 0.35,
  furMid: 0.45,
  furTreble: 0.7,
  furHat: 0.4,
  speaker: 0.9,
  eyeWide: 1.04,
};

/**
 * Where her feet stand below her square's middle, as a share of it: the
 * painter's own `GROUND`, so `groundY` is where her feet would touch.
 */
const GROUND = 0.345;

/** A pool of light on the floor: an ellipse of `colour`, brightest inside. */
const poolOfLight = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  colour: readonly [number, number, number],
  alpha: number,
) => {
  context.save();
  context.translate(x, y);
  context.scale(1, radiusY / radiusX);
  const light = context.createRadialGradient(0, 0, 0, 0, 0, radiusX);
  light.addColorStop(0, alphaOf(colour, alpha));
  light.addColorStop(0.45, alphaOf(colour, alpha * 0.35));
  light.addColorStop(1, alphaOf(colour, 0));
  context.fillStyle = light;
  context.fillRect(-radiusX, -radiusX, radiusX * 2, radiusX * 2);
  context.restore();
};

/**
 * Where the twinkles stand round her, in her square's sides from her feet:
 * across, up, and the size of each. Placed by eye against her jump so none
 * touches her ears, her headphones or the floor's light.
 */
const TWINKLES = [
  { across: -0.43, up: 0.76, size: 0.05 },
  { across: 0.42, up: 0.79, size: 0.04 },
  { across: 0.45, up: 0.38, size: 0.028 },
  { across: -0.45, up: 0.3, size: 0.032 },
  { across: 0.19, up: 0.92, size: 0.022 },
] as const;

/**
 * One twinkle: a four-pointed star with hollowed sides in `colour`, and a
 * point of white light at its heart.
 */
const twinkle = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  colour: readonly [number, number, number],
) => {
  context.save();
  context.translate(x, y);
  const halo = context.createRadialGradient(0, 0, 0, 0, 0, size * 1.6);
  halo.addColorStop(0, alphaOf(colour, 0.35));
  halo.addColorStop(1, alphaOf(colour, 0));
  context.fillStyle = halo;
  context.fillRect(-size * 1.6, -size * 1.6, size * 3.2, size * 3.2);
  context.fillStyle = hexOf(colour);
  context.beginPath();
  context.moveTo(0, -size);
  [
    [size, 0],
    [0, size],
    [-size, 0],
    [0, -size],
  ].forEach(([toX, toY]) => context.quadraticCurveTo(0, 0, toX, toY));
  context.closePath();
  context.fill();
  const heart = context.createRadialGradient(0, 0, 0, 0, 0, size * 0.32);
  heart.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  heart.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = heart;
  context.fillRect(-size * 0.32, -size * 0.32, size * 0.64, size * 0.64);
  context.restore();
};

/**
 * Her, `art` px square, her feet's ground at (`x`, `groundY`), with the pool
 * of light she will land in and the twinkles round her. `ratio` is the
 * card's device pixels to a px, for her finest lines.
 */
export const drawCheeringPet = (
  context: CanvasRenderingContext2D,
  inks: IShareCardInks,
  x: number,
  groundY: number,
  art: number,
  ratio: number,
) => {
  context.save();
  context.globalCompositeOperation = 'lighter';
  poolOfLight(context, x, groundY, art * 0.58, art * 0.077, inks.light, 0.5);
  poolOfLight(
    context,
    x,
    groundY,
    art * 0.26,
    art * 0.031,
    [255, 255, 255],
    0.45,
  );
  TWINKLES.forEach(({ across, up, size }, index) =>
    twinkle(
      context,
      x + across * art,
      groundY - up * art,
      size * art,
      inks.sparkle[index % inks.sparkle.length],
    ),
  );
  context.restore();

  const pad = art * 0.3;
  const side = art + pad * 2;
  context.save();
  context.translate(x - side / 2, groundY - side / 2 - art * GROUND);
  drawFurPet(context, {
    art,
    pad,
    ratio,
    palette: furPalette(inks.petTone, inks.light),
    pose: CHEER_POSE,
    joy: 1,
    waveTravel: 0.25,
    star: 0,
    starScale: 1,
    starTurn: 0,
    press: 0,
    mood: 'perfect',
  });
  context.restore();
};
