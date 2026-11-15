/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The shape of Surprise me's draw in time, apart from anything that draws it
 * (Ivan, 2026-11-13: "that button will do a nice random drawing animation
 * with the cover art, but make sure it's performant").
 *
 * It is Cover Flow's own row (Ivan, 2026-11-14: "remove the surprise me cover
 * art component and use the new cover art, same component, not loading two"):
 * a row of covers runs from the left, slows and stops with the pick in the
 * centre, holds it under its name, and gives the row back. Every frame is
 * asked for by `requestAnimationFrame` and placed by how long the spin has
 * been running, so nothing here waits on a clock and a slow frame lands
 * where it should rather than late.
 */

/** The spin, from a press to the pick in the centre. */
export const DRAW_SPIN_MS = 1400;
/** The pick held in the centre under its name before the row goes back. */
export const DRAW_HOLD_MS = 1100;
/**
 * How many covers the row runs past. Inside the scene's drawn window
 * (`COVER_FLOW_WINDOW`, ten each side, plus the two it keeps beyond), so
 * every cover the spin crosses is asked for on its first frame and none
 * flies past as an empty sleeve.
 */
export const DRAW_TRAVEL = 12;
/** Covers left of where the spin starts, so its first frame is a full row
 * rather than one with an empty left side. */
export const DRAW_LEAD = 6;
/** Covers besides the pick: the lead, the travel, and a side after it. */
export const DRAW_DECK_SIZE = 25;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Fast out of the press, slow into the stop. */
export const easeOutQuart = (t: number): number => 1 - (1 - clamp01(t)) ** 4;

/** Where the row stands `elapsed` ms into a spin from `from` to `to`. */
export const spinPosition = (
  from: number,
  to: number,
  elapsed: number,
  spinMs: number,
): number =>
  spinMs <= 0 || elapsed >= spinMs
    ? to
    : from + (to - from) * easeOutQuart(elapsed / spinMs);

/**
 * The row the draw spins: the others with the pick `DRAW_TRAVEL` past where
 * the spin starts, and `DRAW_LEAD` covers before the start. A small library
 * that answered fewer covers than asked for gives up its lead first, then
 * its travel, so the pick always stands after every cover the row runs past.
 */
export const dealRow = <T>(
  others: readonly T[],
  pick: T,
): { row: T[]; startIndex: number; pickIndex: number } => {
  const pickIndex = Math.min(DRAW_LEAD + DRAW_TRAVEL, others.length);
  const startIndex = Math.max(0, pickIndex - DRAW_TRAVEL);
  return {
    row: [...others.slice(0, pickIndex), pick, ...others.slice(pickIndex)],
    startIndex,
    pickIndex,
  };
};
