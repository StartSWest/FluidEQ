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
 * A ring of covers spins, slows and stops with the pick in front; the pick
 * steps forward while the others step back; then it flies into the player.
 * Every frame is asked for by `requestAnimationFrame` and placed by how long
 * the draw has been running — nothing here waits on a clock, and a slow frame
 * lands where it should rather than late.
 */

/** The spin, from a press to the pick in front. */
export const DRAW_SPIN_MS = 1150;
/** The pick stepping forward while the rest of the deck steps back. */
export const DRAW_LAND_MS = 360;
/** The pick flying into the player's cover. */
export const DRAW_FLY_MS = 420;
/** Covers on the ring besides the pick: enough to read as the library. */
export const DRAW_DECK_SIZE = 19;
/** Whole turns before the stop, so even a pick beside the start goes round. */
const TURNS = 2;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Fast out of the press, slow into the stop. */
export const easeOutQuart = (t: number): number => 1 - (1 - clamp01(t)) ** 4;

/** A step forward that overshoots a touch and settles. */
export const easeOutBack = (t: number): number => {
  const u = clamp01(t) - 1;
  return 1 + 2.2 * u ** 3 + 1.2 * u ** 2;
};

/** How far apart the cards stand: one card and a gap each, never cramped. */
export const ringRadius = (cards: number): number =>
  Math.max(3.2, (cards * 1.22) / (2 * Math.PI));

/** Where card `index` of `cards` stands on the ring, in radians. */
export const cardAngle = (index: number, cards: number): number =>
  (index / cards) * Math.PI * 2;

/** The ring's turn that puts the card at `angle` in front, after the turns. */
export const stopRotation = (angle: number): number =>
  -angle - TURNS * Math.PI * 2;

/**
 * How lit a card is by where it faces: full in front, dim at the sides, so
 * the ring reads as depth rather than as a row.
 */
export const cardLight = (angle: number, rotation: number): number =>
  0.26 + 0.74 * Math.max(0, Math.cos(angle + rotation)) ** 1.6;

export interface IDrawFrame {
  /** The ring's turn. */
  rotation: number;
  /** 1 at the start of the spin and 0 at the stop: the cards' stretch. */
  speed: number;
  /** 0 until the stop, then up to 1 as the pick steps forward. */
  landing: number;
  /** The landing is over: time for the pick to fly. */
  isLanded: boolean;
}

/** Everything a frame `elapsed` ms into the draw needs. */
export const drawFrameAt = (elapsed: number, stop: number): IDrawFrame => {
  const spun = clamp01(elapsed / DRAW_SPIN_MS);
  const landing = clamp01((elapsed - DRAW_SPIN_MS) / DRAW_LAND_MS);
  return {
    rotation: stop * easeOutQuart(spun),
    speed: (1 - spun) ** 3,
    landing,
    isLanded: elapsed >= DRAW_SPIN_MS + DRAW_LAND_MS,
  };
};

/**
 * The ring: the others, with the pick at a place drawn at random among them,
 * so where it lands on the ring tells nothing about which it is.
 */
export const dealDeck = <T>(
  others: readonly T[],
  pick: T,
  random: () => number = Math.random,
): { deck: T[]; pickIndex: number } => {
  const pickIndex = Math.floor(random() * (others.length + 1));
  return {
    deck: [...others.slice(0, pickIndex), pick, ...others.slice(pickIndex)],
    pickIndex,
  };
};
