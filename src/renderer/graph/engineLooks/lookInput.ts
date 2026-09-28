/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { rampAt } from '../lookColours';
import type { IAnalysisBand } from '../analysis/analysisFrame';
import type {
  ISceneReading,
  ISceneStand,
  TSceneInk,
} from '../sceneViews/sceneFrame';
import {
  LOOK_INKS,
  LOOK_VECTORS,
  MAX_SPRITES,
  SPRITE_FLOATS,
  type IEngineLookInput,
} from './engineLookInput';

/**
 * Filling what a look hands the engine (`engineLookInput.ts`): the vectors
 * every look shares, laid out as `lookGlsl.ts` reads them, and the colours.
 * One input per look, written in place frame after frame; the worker is
 * handed a copy of it with the frame.
 */

const INK_MODE: Record<TSceneInk, number> = {
  flat: 0,
  frequency: 1,
  level: 2,
  heat: 3,
};

export const createLookInput = (style: string): IEngineLookInput => ({
  style,
  data: new Float32Array(4),
  width: 1,
  rows: 1,
  vectors: new Float32Array(LOOK_VECTORS * 4),
  inks: new Float32Array(LOOK_INKS * 3),
  inkCount: 1,
  mateInks: new Float32Array(LOOK_INKS * 3),
  mateInkCount: 1,
  bloom: 0,
  sprites: new Float32Array(0),
  spriteCount: 0,
  spritesUnder: 0,
});

/**
 * Every sprite pushed so far is scenery, drawn under the picture; the ones
 * pushed after are drawn over it.
 */
export const spritesSoFarUnder = (input: IEngineLookInput): void => {
  input.spritesUnder = input.spriteCount;
};

/**
 * One sprite drawn over the picture (`SPRITE_FLOATS`): at `x`, `y` in CSS
 * pixels, `radius` across, `alpha` solid, in `colour` (0..1, straight), with
 * an edge `soft` from 0 (a disc) to 1 (a glow). Past `MAX_SPRITES` a frame
 * draws no more.
 */
const pushShape = (
  input: IEngineLookInput,
  x: number,
  y: number,
  halfWidth: number,
  halfHeight: number,
  alpha: number,
  colour: readonly [number, number, number],
  soft: number,
  rect: boolean,
): void => {
  if (
    input.spriteCount >= MAX_SPRITES ||
    halfWidth <= 0 ||
    halfHeight <= 0 ||
    alpha <= 0
  ) {
    return;
  }
  const needed = (input.spriteCount + 1) * SPRITE_FLOATS;
  if (input.sprites.length < needed) {
    const grown = new Float32Array(
      Math.min(
        MAX_SPRITES * SPRITE_FLOATS,
        Math.max(needed, input.sprites.length * 2, 64 * SPRITE_FLOATS),
      ),
    );
    grown.set(input.sprites);
    input.sprites = grown;
  }
  const at = input.spriteCount * SPRITE_FLOATS;
  input.sprites.set(
    [
      x,
      y,
      halfWidth,
      halfHeight,
      colour[0],
      colour[1],
      colour[2],
      alpha,
      soft,
      rect ? 1 : 0,
      0,
      0,
    ],
    at,
  );
  input.spriteCount += 1;
};

export const pushSprite = (
  input: IEngineLookInput,
  x: number,
  y: number,
  radius: number,
  alpha: number,
  colour: readonly [number, number, number],
  soft = 0,
): void => pushShape(input, x, y, radius, radius, alpha, colour, soft, false);

/** A rectangle sprite centred on `x`, `y`: a star's square, a glint's dash. */
export const pushRectSprite = (
  input: IEngineLookInput,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha: number,
  colour: readonly [number, number, number],
): void =>
  pushShape(input, x, y, width / 2, height / 2, alpha, colour, 0, true);

/**
 * The look's ramp at `t`, moved toward white by `whiten`, as 0..1 channels:
 * what a sprite is coloured with, as `lookLightInk` colours the picture.
 */
export const lightRamp = (
  colours: readonly string[],
  t: number,
  whiten = 0,
): [number, number, number] => {
  const [red, green, blue] = rampAt(colours, Math.min(1, Math.max(0, t)));
  const w = Math.min(1, Math.max(0, whiten));
  const lift = (channel: number) => channel / 255 + (1 - channel / 255) * w;
  return [lift(red), lift(green), lift(blue)];
};

/** The input's texels for `width` by `rows`, reused while the size holds. */
export const sizeLookData = (
  input: IEngineLookInput,
  width: number,
  rows: number,
): Float32Array => {
  const across = Math.max(1, Math.round(width));
  const down = Math.max(1, Math.round(rows));
  if (input.width !== across || input.rows !== down) {
    input.width = across;
    input.rows = down;
    input.data = new Float32Array(across * down * 4);
  }
  return input.data;
};

/** `uLook[index]`, set from four numbers. */
export const setLookVector = (
  input: IEngineLookInput,
  index: number,
  x: number,
  y: number,
  z: number,
  w: number,
): void => {
  const at = index * 4;
  input.vectors[at] = x;
  input.vectors[at + 1] = y;
  input.vectors[at + 2] = z;
  input.vectors[at + 3] = w;
};

/**
 * Where each copy of the figure stands (`uLook[8]` and `uLook[9]`), from the
 * look's own function for it — the one its 2D drawing reads.
 */
export const setLookStands = (
  input: IEngineLookInput,
  bands: readonly IAnalysisBand[],
  standOf: (band: IAnalysisBand) => ISceneStand,
): void => {
  [0, 1].forEach((copy) => {
    const band = bands[copy];
    if (band) {
      const { floor, up, reach } = standOf(band);
      setLookVector(input, 8 + copy, floor, up, reach, 1);
    } else {
      setLookVector(input, 8 + copy, 0, 0, 0, 0);
    }
  });
};

/**
 * A ramp as the stops the 2D looks sample (`rampAt`), written into `inks`:
 * evenly spaced, and interpolated the same way in the shader (`lookInk`).
 * Answers how many stops were written.
 */
export const writeInks = (
  inks: Float32Array,
  colours: readonly string[],
): number => {
  const count = Math.min(LOOK_INKS, Math.max(1, colours.length));
  for (let stop = 0; stop < count; stop += 1) {
    const [red, green, blue] = rampAt(
      colours,
      count === 1 ? 0 : stop / (count - 1),
    );
    inks[stop * 3] = red / 255;
    inks[stop * 3 + 1] = green / 255;
    inks[stop * 3 + 2] = blue / 255;
  }
  return count;
};

/** Where each copy of the figure stands in the band (`uLook[2]`, `uLook[3]`). */
export const setLookBands = (
  input: IEngineLookInput,
  bands: readonly IAnalysisBand[],
): void => {
  [0, 1].forEach((copy) => {
    const band = bands[copy];
    if (band) {
      setLookVector(
        input,
        2 + copy,
        band.top,
        band.bottom,
        band.flipped ? 1 : 0,
        1,
      );
    } else {
      setLookVector(input, 2 + copy, 0, 0, 0, 0);
    }
  });
};

/** The shared vectors and the colours, from the frame's reading. */
export const readLookInput = (
  input: IEngineLookInput,
  reading: ISceneReading,
): void => {
  const { plot, look, music, bands, colours } = reading;
  // A frame's sprites are its own: each step pushes what it draws this time.
  input.spriteCount = 0;
  input.spritesUnder = 0;
  setLookVector(input, 0, reading.window.width, reading.window.height, 0, 0);
  setLookVector(input, 1, plot.left, plot.right, plot.top, plot.bottom);
  setLookBands(input, bands);
  setLookVector(
    input,
    4,
    INK_MODE[look.ink],
    look.filled ? 1 : 0,
    look.opacity,
    look.lineWidth,
  );
  setLookVector(
    input,
    5,
    look.accents ? 1 : 0,
    music.pulse,
    reading.glow,
    music.energy,
  );
  input.inkCount = writeInks(input.inks, colours);
};
