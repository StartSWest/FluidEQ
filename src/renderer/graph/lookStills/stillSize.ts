/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The size the shipped stills are drawn at (`scripts/look-stills`) and laid
 * out by (`ShippedLookStill`), and the kinds of window each is drawn for:
 * one place, with nothing of the window's in it, so the generator can read
 * it outside a window and the two cannot disagree.
 */

/** Which side of the Brightness the window is on. */
export type TStillSide = 'dark' | 'light';

/**
 * How many colours the window hands a look: its first colour alone (seven
 * copies of it, `windowTintStops`), or seven different stops - the Tint's
 * gradient to a second colour, or a Plus scene's rainbow. The drawings take
 * different paths for the two (a one-colour Spectrogram builds a ramp from
 * its ground, `windowLevelRamps`), so each look ships a still for each.
 */
export type TStillColours = 'one' | 'many';

export const STILL_SIDES: readonly TStillSide[] = ['dark', 'light'];
export const STILL_COLOURS: readonly TStillColours[] = ['one', 'many'];

/** The plate a still is drawn for, in CSS pixels: the grid's usual tile. */
export const STILL_BOX = { width: 160, height: 90 } as const;

/**
 * Device pixels per CSS pixel: 256 x 144, sharp on the grid's tile at a
 * display's 150% and still crisp on one grown to fill a wide window, at
 * two thirds of the bytes twice the pixels took.
 */
export const STILL_SCALE = 1.6;

/** A layer's size in its picture, in pixels. */
export const STILL_PIXELS = {
  width: Math.round(STILL_BOX.width * STILL_SCALE),
  height: Math.round(STILL_BOX.height * STILL_SCALE),
} as const;

/**
 * Clear rows between a picture's layers, stacked top to bottom: scaled onto
 * the plate, a layer's edge samples the gap, never the next layer.
 */
export const STILL_GAP = 2;
