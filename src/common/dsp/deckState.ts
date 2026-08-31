/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What a native deck is doing, as the telemetry frame reports it.
 *
 * The same numbers as `FeqDeckState` in `native/dsp-core/include/fluideq/
 * player.h`, written a second time because TypeScript cannot ask a C compiler
 * for an enum — the same arrangement, and the same hazard, as the frame sizes
 * in `wire.ts`.
 *
 * In `src/common` rather than beside the decoder because both sides read them:
 * main decodes the frame and the renderer decides what the seek bar and the
 * queue do with it.
 */
export const DECK_EMPTY = 0;
/** Loaded and able to play, whether or not the transport is running. */
export const DECK_READY = 1;
/**
 * The decoder reached the end of the file.
 *
 * This is end-of-track, and it is the signal the queue advances on. It used to
 * come from an `ended` event on a muted `<audio>` element decoding the same
 * file a second time, which is one of the two clocks that removal got rid of.
 */
export const DECK_ENDED = 2;

export type TDeckState =
  typeof DECK_EMPTY | typeof DECK_READY | typeof DECK_ENDED;
