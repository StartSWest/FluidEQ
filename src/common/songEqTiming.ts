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

/**
 * When a session settles, checkpoints, times out on the suspend grace, and
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

/** How much has to have been *listened to* before a song is worth keeping.
 * Below this the user was browsing, and browsing should leave no trace. */
export const SONG_EQ_MIN_LISTENED_MS = 120_000;

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
 * Whether continuing to listen, exactly as things stand, ends in a saved
 * entry. The one gate both `close` (does this song get committed) and
 * `advance` (has it earned its two-minute checkpoint) write under — pulled
 * out once so nothing outside this file, including the shell's own "will
 * this be saved" badge, can restate it and quietly drift from it the moment
 * one of the two changes without the other noticing.
 *
 * `forgotten` lives here rather than beside each call site for the same
 * reason: a badge that asked this without it would go on promising a save
 * for a song `close` has already been told never to commit again.
 */
export const willSongEqSave = (
  state: ISongEqRecorderState,
  session: ISongEqSession,
  now: number,
): boolean =>
  !session.forgotten &&
  state.isSaveOn &&
  listenedAt(session, now) >= SONG_EQ_MIN_LISTENED_MS &&
  Boolean(state.liveLayer);

/**
 * End a session: save it if it earned that, hand back the loan if it is still
 * ours, and produce the effects for both.
 *
 * The order is deliberate and load-bearing. Reversed, the refinement would be
 * read off a layer already put back to what preceded the song, and every
 * remembered curve would decay towards whatever was in the chain before it.
 *
 * `forgotten` skips the commit outright, however long the song played: a
 * 'forget' event exists precisely so continuing to listen after it does not
 * quietly re-file the thing just asked to be dropped.
 */
const close = (
  state: ISongEqRecorderState,
  session: ISongEqSession,
  now: number,
  deviceId: string,
): TSongEqEffect[] => {
  const effects: TSongEqEffect[] = [];
  if (willSongEqSave(state, session, now) && state.liveLayer) {
    effects.push({
      kind: 'commit',
      identity: session.identity,
      deviceId,
      layer: state.liveLayer,
    });
  }
  if (session.hasLoan) {
    effects.push({ kind: 'applyLayer', settings: session.loanLayer });
  }
  return effects;
};

/**
 * End a session and put the chain back where it was.
 *
 * State AND effects together, because those two must not be able to disagree:
 * `close` hands the loan back as an effect, so anything that forgets to move
 * `liveLayer` with it goes on believing the borrowed curve is the live one —
 * and commits it under the NEXT song's key.
 */
export const closeSession = (
  state: ISongEqRecorderState,
  session: ISongEqSession,
  now: number,
  deviceId: string,
): [ISongEqRecorderState, TSongEqEffect[]] => [
  {
    ...state,
    session: undefined,
    liveLayer: session.hasLoan ? session.loanLayer : state.liveLayer,
  },
  close(state, session, now, deviceId),
];

/** Settle, checkpoint and grace, all of which are time passing rather than
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
    return closeSession(state, session, now, state.deviceId);
  }

  if (
    session.phase === 'recording' &&
    !session.hasCheckpointed &&
    willSongEqSave(state, session, now) &&
    state.liveLayer
  ) {
    return [
      { ...state, session: { ...session, hasCheckpointed: true } },
      [
        {
          kind: 'checkpoint',
          identity: session.identity,
          deviceId: state.deviceId,
          layer: state.liveLayer,
        },
      ],
    ];
  }

  return [state, []];
};
