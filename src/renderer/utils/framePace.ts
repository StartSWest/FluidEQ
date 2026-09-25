/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * When a frame loop held to a pace draws: the page's (`useSmoothFrames.ts`)
 * and the scene worker's own, on the same rule.
 *
 * Animation frames arrive a fraction of a millisecond either side of the
 * display's beat, so a pace judged against its exact length skips a whole
 * display frame whenever the frames before it came in a hair short: held to
 * thirty frames a second on a 60 Hz screen, the page's loop drew at 30 or at
 * 20 as the pair of frames before it fell, and the Studio's stage - and the
 * meters it fed - ran at 18 to 30. The worker drew once nine tenths of the
 * pace had gone by, which on a 100 Hz screen is exactly three frames, and
 * there it flickered between 33 and 25. So a frame is due once the pace,
 * less a quarter of the display's own frame, has gone by: the jitter of a
 * fraction of a millisecond is allowed for, a pace is never overrun by a
 * whole frame, and every display settles on one rate - 30 at 60 Hz, 25 at
 * 100, 30 at 120, 29 at 144.
 */
const JITTER_SHARE = 0.25;

/** Faster than 250 Hz or slower than 10 Hz is a measurement error, not a display. */
const SHORTEST_TICK_MS = 4;
const LONGEST_TICK_MS = 100;

/**
 * How long the display's frame is, from this animation frame's timestamp and
 * the last one's: `previousMs` until there have been two.
 */
export const displayTickMs = (
  now: number,
  lastTickAt: number | undefined,
  previousMs: number,
) =>
  lastTickAt === undefined
    ? previousMs
    : Math.min(LONGEST_TICK_MS, Math.max(SHORTEST_TICK_MS, now - lastTickAt));

/**
 * Whether a loop that last drew `elapsedMs` ago, held to `paceMs`, draws now,
 * on a display whose frames are `tickMs` apart. A pace of zero is every
 * frame the display offers.
 */
export const isFrameDue = (elapsedMs: number, paceMs: number, tickMs: number) =>
  paceMs <= 0 || elapsedMs >= paceMs - tickMs * JITTER_SHARE;
