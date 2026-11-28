/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * When a frame loop held to a pace draws: the page's (`useSmoothFrames.ts`)
 * and the scene worker's own, on the same rules.
 *
 * Animation frames arrive a fraction of a millisecond either side of the
 * display's beat, so a pace judged against its exact length skips a whole
 * display frame whenever the frames before it came in a hair short: held to
 * thirty frames a second on a 60 Hz screen, the page's loop drew at 30 or at
 * 20 as the pair of frames before it fell, and the Studio's stage - and the
 * meters it fed - ran at 18 to 30. The worker drew once nine tenths of the
 * pace had gone by, which on a 100 Hz screen is exactly three frames, and
 * there it flickered between 33 and 25. So a frame is due once its time,
 * less a quarter of the display's own frame, has come: the jitter of a
 * fraction of a millisecond is allowed for, and a pace is never overrun by a
 * whole frame.
 *
 * Two rules stand on that allowance. A ceiling on the window's own drawings
 * (`isFrameDue`) counts from the last frame drawn, so every display settles
 * on one even rate at or under it - 30 at 60 Hz, 25 at 100, 30 at 120, 29 at
 * 144. A rate somebody chose (`createPaceSchedule`) keeps a schedule
 * instead, and averages the rate itself on every display.
 */
const JITTER_SHARE = 0.25;

/**
 * The fastest the window's own drawings are redrawn: the meters, the
 * titlebar wave, the graph's trace, the karaoke words and the ambient layer.
 * A scene keeps the rate its listener chose (`useSceneRunner.ts`).
 *
 * Every display up to 200 Hz is drawn on every frame it offers, as before:
 * `isFrameDue` lets a frame through once the pace less a quarter of a frame
 * has gone by, so 165 Hz (6.06 ms) and 200 Hz (5 ms, due from 4.81) pass.
 * A 240 Hz display (4.17 ms, due from 5.02) is drawn on every other frame,
 * 120 a second, and 360 Hz on every other, 180. Measured in the running
 * window on Ivan's 240 Hz screen with music playing (2026-11-16): the main
 * thread was 96% busy and reached 75 to 93 frames a second, each frame
 * repainting five canvases - the ambient layer alone the whole 2560 by 1391
 * window, screened over everything, which kept the graphics process at 94%.
 * A 120 Hz step is nothing an eye follows in a meter's ease or a drifting
 * petal; a frame that costs half the window's time is.
 *
 * Not the thirty-a-second cap Ivan took out on 2026-09-27
 * (`THIRTY_A_SECOND_MS`): that held a 60 Hz screen to half its rate and was
 * visibly stepped; this changes nothing on any screen of 200 Hz or less.
 */
export const WINDOW_DRAWING_PACE_MS = 1000 / 165;

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

/**
 * The frames of a rate somebody chose: a scene's "60 a second", a
 * consumer's own pace. One schedule for the page's loop and the scene
 * worker's, so the rate the listener picked is the rate the picture changes
 * at, on any display.
 *
 * Counting from the last frame drawn, as `isFrameDue` does, a rate is
 * rounded down to a whole number of the display's frames between every two:
 * sixty a second was fifty on a 100 Hz screen, forty-eight on a 144 Hz one,
 * and the row saying "60 a second" stood over a stage reading fifty. Here
 * each frame has a slot, and the next slot is one pace after this one's
 * rather than after the moment it was drawn, so a beat that does not divide
 * the pace draws it on average - sixty on a 100 Hz screen is two refreshes,
 * two, then one. Where the beat divides the pace (sixty at 60, 120 or 240 Hz,
 * thirty at 60) every gap is the same and nothing differs from counting.
 *
 * A frame more than a pace past its slot (a stall, a window that was away,
 * a pace just made much shorter) starts the schedule again from itself
 * instead of drawing the missed frames back to back.
 */
export interface IPaceSchedule {
  /**
   * Whether the display's frame at `now` is due, held to `paceMs` on a
   * display whose frames are `tickMs` apart. A pace of zero is every frame
   * the display offers.
   */
  isDue(now: number, paceMs: number, tickMs: number): boolean;
  /**
   * A frame was drawn at `now`, held to `paceMs`: it takes its slot. Told
   * only of frames that reached the screen, so one the GPU made wait is
   * tried again on the display's next frame rather than a pace later.
   */
  drawn(now: number, paceMs: number): void;
  /**
   * Starts the schedule again: from the slot of a frame at `at`, whose next
   * is a pace later, or from none, so the next frame is due at once.
   */
  restart(at?: number): void;
}

export const createPaceSchedule = (): IPaceSchedule => {
  /** The slot of the last frame drawn, on the frames' own clock. */
  let slotAt: number | undefined;
  return {
    isDue: (now, paceMs, tickMs) =>
      slotAt === undefined ||
      paceMs <= 0 ||
      now >= slotAt + paceMs - tickMs * JITTER_SHARE,
    drawn: (now, paceMs) => {
      const next = slotAt === undefined || paceMs <= 0 ? now : slotAt + paceMs;
      slotAt = now - next >= paceMs ? now : next;
    },
    restart: (at) => {
      slotAt = at;
    },
  };
};
