/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A subject cut out of the flat colour ChatGPT was asked to stand it on.
 *
 * Codex's image tool has no transparency of its own, so a subject is drawn on
 * one flat key colour and the colour is taken out here (gpt-studio's
 * approach, without its FFmpeg). Two things make the difference between a
 * cut-out and a sticker with a halo:
 *
 * - The key is read from the picture's own border, not assumed: the model
 *   paints "pure green" anywhere from #00ff00 to #2bd94a. Only when the border
 *   is not one colour is the asked-for key used.
 * - An edge pixel is part subject and part key. Its alpha comes from how far
 *   it is from the key, and its colour is unmixed — the key's share taken out
 *   — so a soft edge keeps the subject's own hue instead of a green fringe
 *   (the art section of the brief asks the same of anything packed).
 *
 * Pixels are four channels, alpha last, in whatever colour order the caller
 * holds them; the key is given in that same order.
 */

/** Below this distance from the key a pixel is background. */
const CLEAR_DISTANCE = 30;
/** Above it, subject. Between, an edge, partly both. */
const SOLID_DISTANCE = 90;
/** A border is one colour when this share of it is within CLEAR of its median. */
const UNIFORM_SHARE = 0.9;

export type TKey = readonly [number, number, number];

const distance = (pixels: Uint8Array, at: number, key: TKey) =>
  Math.hypot(
    pixels[at] - key[0],
    pixels[at + 1] - key[1],
    pixels[at + 2] - key[2],
  );

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

/** Every pixel on the picture's edge, as offsets into `pixels`. */
const borderOffsets = (width: number, height: number): number[] => {
  const offsets: number[] = [];
  for (let x = 0; x < width; x += 1) {
    offsets.push(x * 4, ((height - 1) * width + x) * 4);
  }
  for (let y = 1; y < height - 1; y += 1) {
    offsets.push(y * width * 4, (y * width + width - 1) * 4);
  }
  return offsets;
};

/** The border's own colour, when it is one; otherwise undefined. */
export const borderKey = (
  pixels: Uint8Array,
  width: number,
  height: number,
): TKey | undefined => {
  const border = borderOffsets(width, height);
  const channel = (offset: number) =>
    median(border.map((at) => pixels[at + offset]));
  const key: TKey = [channel(0), channel(1), channel(2)];
  const near = border.filter(
    (at) => distance(pixels, at, key) < CLEAR_DISTANCE,
  ).length;
  return near >= border.length * UNIFORM_SHARE ? key : undefined;
};

/** How far into the subject, in pixels, the key's light is taken back out. */
const SPILL_BAND = 3;

/**
 * The key's light taken off the subject's rim. A model draws a subject on
 * green the way a photographer lights one on a green screen: its outermost
 * pixels catch the green, and once the background is gone they read as a
 * green outline — measured on a snow-dusted pine cone, the first picture
 * made this way. Within a few pixels of the cut, each channel the key is
 * bright in is held to the brightest of the others, the standard despill;
 * deeper in, the subject's own colours are left exactly as drawn.
 */
const despill = (
  pixels: Uint8Array,
  width: number,
  height: number,
  key: TKey,
) => {
  const keyed = [0, 1, 2].filter((channel) => key[channel] > 127);
  const others = [0, 1, 2].filter((channel) => key[channel] <= 127);
  if (keyed.length === 0 || others.length === 0) {
    return;
  }
  // Every pixel within SPILL_BAND of one that is not fully solid.
  let band = new Uint8Array(width * height);
  for (let index = 0; index < band.length; index += 1) {
    band[index] = pixels[index * 4 + 3] < 255 ? 1 : 0;
  }
  for (let step = 0; step < SPILL_BAND; step += 1) {
    const grown = band.slice();
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        if (
          !band[index] &&
          ((x > 0 && band[index - 1]) ||
            (x < width - 1 && band[index + 1]) ||
            (y > 0 && band[index - width]) ||
            (y < height - 1 && band[index + width]))
        ) {
          grown[index] = 1;
        }
      }
    }
    band = grown;
  }
  for (let index = 0; index < band.length; index += 1) {
    const at = index * 4;
    if (band[index] && pixels[at + 3] > 0) {
      const limit = Math.max(...others.map((channel) => pixels[at + channel]));
      keyed.forEach((channel) => {
        pixels[at + channel] = Math.min(pixels[at + channel], limit);
      });
    }
  }
};

/**
 * Takes the key out of `pixels` in place, its light off the rim with it,
 * and returns the alpha now at the four corners, which the caller checks: a
 * corner still opaque means the background was not the flat colour asked
 * for.
 *
 * Written straight (not premultiplied): the caller premultiplies if its
 * format wants it (`premultiply`).
 */
export const keyOut = (
  pixels: Uint8Array,
  width: number,
  height: number,
  asked: TKey,
): number[] => {
  const key = borderKey(pixels, width, height) ?? asked;
  for (let at = 0; at < pixels.length; at += 4) {
    const away = distance(pixels, at, key);
    if (away <= CLEAR_DISTANCE) {
      pixels[at] = 0;
      pixels[at + 1] = 0;
      pixels[at + 2] = 0;
      pixels[at + 3] = 0;
    } else if (away < SOLID_DISTANCE) {
      const alpha = (away - CLEAR_DISTANCE) / (SOLID_DISTANCE - CLEAR_DISTANCE);
      // The edge pixel is alpha·subject + (1 − alpha)·key: solved for the
      // subject, so its colour carries no key.
      for (let channel = 0; channel < 3; channel += 1) {
        const unmixed =
          (pixels[at + channel] - (1 - alpha) * key[channel]) / alpha;
        pixels[at + channel] = Math.round(Math.min(255, Math.max(0, unmixed)));
      }
      pixels[at + 3] = Math.round(alpha * 255);
    }
  }
  despill(pixels, width, height, key);
  const corner = (x: number, y: number) => pixels[(y * width + x) * 4 + 3];
  return [
    corner(0, 0),
    corner(width - 1, 0),
    corner(0, height - 1),
    corner(width - 1, height - 1),
  ];
};

/** Straight alpha to premultiplied, in place. */
export const premultiply = (pixels: Uint8Array) => {
  for (let at = 0; at < pixels.length; at += 4) {
    const alpha = pixels[at + 3] / 255;
    pixels[at] = Math.round(pixels[at] * alpha);
    pixels[at + 1] = Math.round(pixels[at + 1] * alpha);
    pixels[at + 2] = Math.round(pixels[at + 2] * alpha);
  }
};
