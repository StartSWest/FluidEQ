/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

// From `songEqEvents.ts` rather than `songEqRecorder.ts`, which re-exports
// them: importing them from the recorder would put these two files in a cycle,
// since the recorder imports this one's functions.
import type {
  ISongEqRecorderState,
  ISongEqSession,
  TSongEqEffect,
} from './songEqEvents';
import type { ISongIdentity } from './songIdentity';

/**
 * When a session settles, times out on the suspend grace, and
 * what "closing" one means — the passage of time, independent of which event
 * carried the clock forward.
 *
 * Split out of `songEqRecorder.ts` to keep that file under its line-length
 * ceiling. `closeSession` binds ending a session's STATE to the effects that
 * end it, because those two must not be able to disagree about the loan —
 * see its own comment — and `advance` is the one path that can trigger a
 * close on its own, when the suspend grace runs out with nobody watching.
 * The event vocabulary, the match/undo/layerChanged rules and `reduceSongEq`
 * itself stay in `songEqRecorder.ts`.
 */

/**
 * How long an identity must hold still before anything happens.
 *
 * It gates the recording AND the match. Clicking through a queue would
 * otherwise open and close a session several times a second and — far more
 * expensively — rewrite the Equalizer APO config once per skipped track,
 * because every match is a write and a reload. Two seconds into a three-minute
 * song is nothing; two seconds of skipping is six config rewrites avoided.
 */
export const SONG_EQ_SETTLE_MS = 2_000;

/**
 * Whether a song settles as it starts, rather than once it has held still for
 * `SONG_EQ_SETTLE_MS`, in Smart correction's memory. (Auto EQ's song sounds
 * have no settle at all: `open` in `songSoundSteps.ts`.)
 *
 * The settle has no clock of its own (there are no timers here); it is moved
 * on by what the players report — the app's own players a position several
 * times a second, a computer sending its sound one every second. Another
 * program on this machine reports only what Windows tells, and Windows tells
 * a position only when that player republishes one (`native/media-watch`): a
 * browser tab, or a player that publishes no timeline, says nothing more
 * until the song changes. Such a song never settled: it was never looked up
 * and its correction never went on (Ivan, 2026-11-20: "not working well for
 * live audio, is not detecting always"). With no clock to wait on, it settles
 * at once. Skipping through such a player's queue then costs a lookup and,
 * where a song has a correction, a write per song; an answer about a song
 * that is no longer playing is turned away by its key.
 */
export const settlesAtOnce = (identity: ISongIdentity): boolean =>
  identity.source === 'system';

/**
 * How long a stopped session waits before it is really over.
 *
 * Playback stopping is usually a pause. Closing on it would file a
 * half-learned curve and then raise a fresh notice on resume, so the same
 * identity returning inside this window picks the session back up with its
 * listened total and its loan intact.
 */
export const SONG_EQ_SUSPEND_GRACE_MS = 60_000;

/** Listened time including the run in progress. */
export const listenedAt = (session: ISongEqSession, now: number) =>
  session.listenedMs +
  (session.playingSince === undefined ? 0 : now - session.playingSince);

/**
 * End a session: hand back the loan if it is still ours, and take off a
 * correction measured for the song this play, and produce the effects.
 * Nothing is saved here: a song's correction is saved the moment it is done
 * (`held` in `songEqRecorder.ts`).
 *
 * The two are one: a correction measured for this song (`isMeasured`) is
 * taken off as the loan is, to flat. Left on, a song with nothing kept for it
 * played the last song's curve until it had been measured itself, a minute
 * later or never.
 */
const close = (session: ISongEqSession): TSongEqEffect[] =>
  session.hasLoan || session.isMeasured
    ? [
        {
          kind: 'applyLayer',
          settings: session.hasLoan ? session.loanLayer : undefined,
        },
      ]
    : [];

/**
 * End a session and put the chain back where it was.
 *
 * State AND effects together, because those two must not be able to disagree:
 * `close` hands the layer back as an effect, so anything that forgets to move
 * `liveLayer` with it goes on believing the borrowed curve is the live one.
 */
export const closeSession = (
  state: ISongEqRecorderState,
  session: ISongEqSession,
): [ISongEqRecorderState, TSongEqEffect[]] => {
  let { liveLayer } = state;
  if (session.hasLoan) {
    liveLayer = session.loanLayer;
  } else if (session.isMeasured) {
    liveLayer = undefined;
  }
  return [{ ...state, session: undefined, liveLayer }, close(session)];
};

/** Settle and grace, both of which are time passing rather than
 * anything happening. Shared by `tick` and by every event, because an event
 * arriving is also a moment at which time has passed. */
export const advance = (
  state: ISongEqRecorderState,
  now: number,
): [ISongEqRecorderState, TSongEqEffect[]] => {
  const { session } = state;
  if (!session) {
    return [state, []];
  }

  if (
    session.phase === 'settling' &&
    now - session.settlingSince >= SONG_EQ_SETTLE_MS
  ) {
    return [
      { ...state, session: { ...session, phase: 'recording' } },
      // The lookup happens whether or not the tick is on: the tick governs
      // recording, never using what is already known.
      [
        {
          kind: 'lookup',
          identity: session.identity,
          deviceId: state.deviceId,
        },
      ],
    ];
  }

  if (
    session.phase === 'suspended' &&
    session.suspendedSince !== undefined &&
    now - session.suspendedSince >= SONG_EQ_SUSPEND_GRACE_MS
  ) {
    return closeSession(state, session);
  }

  return [state, []];
};
