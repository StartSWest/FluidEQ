/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A scene's single colour (contract 9): `{ "type": "colour", "value":
 * "#00b3a4" }` among `params`, one colour its member picks in the Studio.
 * The shader gets `uniform vec3 uColour_<id>` in LINEAR light, converted
 * from the sRGB the member picked, as a palette's texture is read. It does
 * not count toward the eight sliders. An older FluidEQ reads the entry as a
 * slider that moves nothing, and a shader naming `uColour_<id>` fails to
 * compile there and plays the scene's fallback form. This file imports
 * only `scenePalette.ts`, so the server checks colours with these very bytes
 * (`vendor-member-rules.mjs`).
 */

import { hexToLinear } from './scenePalette';

export const COLOUR_TYPE = 'colour';
/** Single colours a scene may carry, apart from its sliders and palettes. */
export const MAX_SCENE_COLOURS = 4;

// Named apart from every other vendored module's: the server bundles them into
// one scope (`tools/bundle-functions.mjs`).
const COLOUR_HEX = /^#[0-9a-f]{6}$/i;

export const uniformNameForColour = (id: string): string => `uColour_${id}`;

/** Whether a `params` entry declares a single colour. */
export const isColourEntry = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  (value as { type?: unknown }).type === COLOUR_TYPE;

/** A colour as a scene writes one, lower-cased, or nothing. */
export const readColourValue = (value: unknown): string | null =>
  typeof value === 'string' && COLOUR_HEX.test(value)
    ? value.toLowerCase()
    : null;

/** `#rrggbb` in linear light, as the shader is handed it: the very conversion
 * a palette's stops go through, so a colour and a palette stop of the same hex
 * reach the shader as the same light. */
export const colourLinear = (hex: string): [number, number, number] =>
  hexToLinear(hex);
