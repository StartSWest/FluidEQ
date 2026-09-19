/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the Library player reads from the native host's telemetry, and how
 * finely it reads it.
 *
 * In `src/common` because both processes need the same answer. The renderer
 * turns each frame into the seek bar, the end of a track, the crossfade's cue
 * and the re-cue after a device change; main has to know which frames would
 * change any of that, because behind a minimised window those are the only
 * frames it sends. Two copies of the rule would drift, and a frame main wrongly
 * judged to change nothing is a song that never advances.
 */

import type { IEngineLatency } from '../engineHealth';

/** The fields of a telemetry frame the player acts on, and no others. */
export interface INativeTransportFrame {
  processingLatency?: IEngineLatency;
  processingEndpoint?: string;
  /** Bumped on every endpoint reopen, which leaves every deck empty. */
  deviceGeneration: number;
  /** `DECK_EMPTY`, `DECK_READY` or `DECK_ENDED` — see `deckState.ts`. */
  deckState: number;
  deckPositionSeconds: number;
  /** Zero when the decoder could not say, which is legal for some streams. */
  deckDurationSeconds: number;
}

/**
 * The playhead, at the rate the interface can actually use it.
 *
 * Telemetry arrives about forty times a second, and this position is read by
 * `LibraryPlayerContext` — the provider the whole library tab hangs off. Passed
 * through raw it re-rendered that entire subtree forty times a second, for a
 * clock that displays whole seconds and a scrubber whose own step is 100 ms.
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

/**
 * Would the player do anything different with `next` than with `previous`?
 *
 * Every field it reads, at the precision it reads it: the position at the same
 * quarter second the renderer's store compares, everything else exactly. So a
 * frame this answers `false` for is one the store would have dropped on arrival
 * anyway, and not sending it costs the player nothing.
 *
 * `undefined` for `previous` means nothing has been sent yet, and the first
 * frame always moves the player.
 */
export const transportFrameMoves = (
  previous: INativeTransportFrame | undefined,
  next: INativeTransportFrame,
): boolean =>
  previous === undefined ||
  previous.deviceGeneration !== next.deviceGeneration ||
  previous.deckState !== next.deckState ||
  previous.deckDurationSeconds !== next.deckDurationSeconds ||
  quantizeTransportPosition(previous.deckPositionSeconds) !==
    quantizeTransportPosition(next.deckPositionSeconds);
