/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How finely the Library player's clock is told: the core's player sends the
 * window its playhead at this step (`main/libraryPlayer/playerView.ts`), the
 * window's own element reports at it (`useWindowDeckEvents.ts`), and
 * Karaoke's playlist publishes at it too.
 */

/**
 * The playhead, at the rate the interface can actually use it.
 *
 * Telemetry arrives about forty times a second, and the playhead the core
 * sends on is read by `LibraryPlayerContext` — the provider the whole library
 * tab hangs off. Passed through raw it re-rendered that entire subtree forty
 * times a second, for a clock that displays whole seconds and a scrubber
 * whose own step is 100 ms.
 *
 * That was a tenfold increase introduced by moving the clock to the host: the
 * element reported `timeupdate` four times a second and the player was built
 * around that cadence. Nothing on screen needs more, and the renderer cannot
 * afford it — at forty a second the allocation rate alone drove the heap to its
 * ceiling, and a garbage collector running flat out is a frozen window.
 *
 * A quarter of a second is that original cadence, restored. It is a rounding of
 * the VALUE rather than a rate limit on the frames: the store already drops an
 * update where every field matches, so quantising is what makes it drop them.
 * Nothing waits, nothing is scheduled, and a position that genuinely moves
 * still arrives on the very next frame.
 */
export const TRANSPORT_POSITION_STEP_SECONDS = 0.25;

export const quantizeTransportPosition = (seconds: number): number =>
  Math.round(seconds / TRANSPORT_POSITION_STEP_SECONDS) *
  TRANSPORT_POSITION_STEP_SECONDS;
