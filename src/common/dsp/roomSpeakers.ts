/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Mute and solo on the Room's speakers.
 *
 * ONE state: the mutes. A solo is not a second thing kept beside them — it
 * is the other six speakers muted and its own open, which is what pressing
 * Solo writes and what "soloed" is read back from. So the two can never
 * disagree: soloing a muted speaker opens it, soloing another speaker moves
 * the solo there, and letting go opens all seven. The sub is never part of
 * it: bass management sends every speaker's bass down its path, so muting it
 * for a solo would take the low end off the very speaker being listened to.
 */

import { ROOM_SPEAKERS } from './chain';

/** The speaker heard alone — the only one of the seven open — or none. */
export const roomSolo = (mutes: readonly boolean[]): number | null => {
  const open = mutes
    .slice(0, ROOM_SPEAKERS)
    .flatMap((mute, at) => (mute ? [] : [at]));
  return open.length === 1 ? open[0] : null;
};

/** `which` heard alone: open, whatever it was, and the other six muted. */
export const withSolo = (mutes: readonly boolean[], which: number): boolean[] =>
  mutes.map((mute, at) => (at < ROOM_SPEAKERS ? at !== which : mute));

/** The solo let go: all seven open, the sub as it was. */
export const withoutSolo = (mutes: readonly boolean[]): boolean[] =>
  mutes.map((mute, at) => (at < ROOM_SPEAKERS ? false : mute));

/**
 * The mutes, with a solo let go if what is playing does not reach its
 * speaker; the same array when there is nothing to let go.
 *
 * A stereo stream on the front stage feeds the front pair and nothing else,
 * a 5.1 one no rears. A solo left on a speaker nothing reaches mutes the ones
 * that do get sound to play one that does not: a room gone quiet with its
 * switch on.
 */
export const withSoloWhileFed = (
  mutes: readonly boolean[],
  fed: readonly boolean[],
): readonly boolean[] => {
  const solo = roomSolo(mutes);
  return solo !== null && fed[solo] !== true ? withoutSolo(mutes) : mutes;
};

/** A speaker's own mute, as the wire spells it. */
const WIRE_MUTED = 1;
/** Muted by a solo standing on another speaker. */
const WIRE_HUSHED = 2;

/**
 * The eight mutes as the engine is sent them: `WIRE_MUTED`, except that the
 * six a solo mutes go as `WIRE_HUSHED`.
 *
 * Because only the engine knows what is playing, and the page that lets an
 * unreachable solo go (`withSoloWhileFed`) is only there while the Room's
 * section is open. Told which mutes are a solo's, the engine drops them when
 * nothing it is playing reaches the soloed speaker (`room_kernels.cpp`), and
 * the room plays instead of going quiet. An engine from before this reads
 * any value but 0 as muted, which is the solo as it always was.
 */
export const roomMuteWire = (mutes: readonly boolean[]): number[] => {
  const solo = roomSolo(mutes);
  return mutes.map((mute, at) => {
    if (!mute) {
      return 0;
    }
    return solo !== null && at < ROOM_SPEAKERS ? WIRE_HUSHED : WIRE_MUTED;
  });
};
