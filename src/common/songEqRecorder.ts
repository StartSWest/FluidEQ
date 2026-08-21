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

import { IFilter, IFiltersMap, ISmartEqSettings } from './constants';
import { ISongEqEntry } from './songEq';
import { ISongIdentity } from './songIdentity';
import {
  SONG_EQ_MIN_LISTENED_MS,
  SONG_EQ_SETTLE_MS,
  SONG_EQ_SUSPEND_GRACE_MS,
  advance,
  closeSession,
  listenedAt,
} from './songEqTiming';

// Re-exported: the three constants are part of this module's public surface —
// the shell and the tests import them from here — even though the settle,
// checkpoint and suspend-grace logic that uses them now lives in
// `songEqTiming.ts`, split out to keep this file under its line ceiling.
export { SONG_EQ_MIN_LISTENED_MS, SONG_EQ_SETTLE_MS, SONG_EQ_SUSPEND_GRACE_MS };

/**
 * When a song starts being recorded, when it stops, and what happens in between.
 *
 * A pure reducer with the clock passed in, and that is the whole reason this
 * file exists apart from its shell. The two-minute floor, the settle, the
 * suspend grace and the loan are the four rules that decide whether this
 * feature is trustworthy, and none of them can be tested through a window, an
 * audio element or a real timer without the test becoming slower than the
 * behaviour it checks. `songEqTiming.ts` holds the passage-of-time half of
 * those rules — the settle, the checkpoint and the suspend grace, plus what
 * closing a session means; the event vocabulary and the match/undo/
 * layerChanged decisions live here.
 *
 * `songEqSession.ts` in the renderer owns the subscriptions, the interval and
 * the performing of effects. It holds no rules.
 */

export type TSongEqPhase = 'settling' | 'recording' | 'suspended';

export interface ISongEqSession {
  phase: TSongEqPhase;
  identity: ISongIdentity;
  /** Wall-clock ms accumulated while playing. Never derived from a reported
   * position: players republish those erratically and a seek would inflate it. */
  listenedMs: number;
  /** When the current playing run began; absent while not playing. */
  playingSince?: number;
  /** When `settling` began. */
  settlingSince: number;
  /** When `suspended` began. */
  suspendedSince?: number;
  /** Whether the two-minute checkpoint has already been written. */
  hasCheckpointed: boolean;
  /**
   * Set by a 'forget' event. The session keeps timing — the badge stays
   * honest about a song still playing — but `close` in `songEqTiming.ts`
   * must never commit one marked this way, however long it plays afterwards,
   * or "forget" would just be a way to re-file the same curve a moment
   * later.
   */
  forgotten?: boolean;
  /**
   * What the layer held before a match was applied, and whether there is one.
   *
   * `hasLoan` is separate from `loanLayer` because "there was no layer" is a
   * value worth restoring and is indistinguishable from "no loan" otherwise.
   */
  hasLoan: boolean;
  loanLayer?: ISmartEqSettings;
  /** The exact layer this recorder last put into the chain, so a write from
   * anywhere else is recognisable. */
  written?: ISmartEqSettings;
}

export interface ISongEqRecorderState {
  session?: ISongEqSession;
  deviceId: string;
  isSaveOn: boolean;
  /** The Smart EQ layer as it currently stands. */
  liveLayer?: ISmartEqSettings;
}

export type TSongEqEvent =
  | { kind: 'nowPlaying'; identity?: ISongIdentity; isPlaying: boolean }
  | { kind: 'tick' }
  /** A layer this recorder did not write. Drops the loan — see the case. */
  | { kind: 'layerChanged'; layer?: ISmartEqSettings }
  /**
   * A layer the continuous Smart EQ engine has just written, announced by the
   * writer itself.
   *
   * The loan survives it, and that is the entire point. Ticking the switch on
   * starts a continuous mode, which then writes a fresh measured layer every
   * few seconds into the same context state `layerChanged` watches; each of
   * those looked exactly like a preset load, so the loan was dropped within
   * seconds of every match and the end-of-song restore never ran — leaving
   * one song's curve equalising the next.
   *
   * Announcement rather than comparison, deliberately. An earlier round of
   * this feature guessed at authorship by comparing layers, and a comparison
   * cannot recognise one the main process rebuilt or sanitised on the way
   * back; `isSameLayer` is the backstop for the echo of our own write, not
   * the mechanism.
   */
  | { kind: 'ownWrite'; layer?: ISmartEqSettings }
  | { kind: 'deviceChanged'; deviceId: string }
  | { kind: 'saveToggled'; isSaveOn: boolean }
  | { kind: 'matched'; identity: ISongIdentity; entry?: ISongEqEntry }
  | { kind: 'undo' }
  | { kind: 'closing' }
  /**
   * Forget whatever this output remembers about the song the notice names.
   *
   * `identity` is the notice's own, and it WINS over the session's: the toast
   * lingers about six seconds and the next song settles into a session after
   * two, so for four of those seconds preferring the session would delete a
   * song the button the user is looking at does not name. The session is only
   * the fallback for a notice that has already gone.
   */
  | { kind: 'forget'; identity?: ISongIdentity };

export type TSongEqEffect =
  | { kind: 'lookup'; identity: ISongIdentity; deviceId: string }
  | { kind: 'applyLayer'; settings?: ISmartEqSettings }
  | {
      kind: 'checkpoint';
      identity: ISongIdentity;
      deviceId: string;
      layer: ISmartEqSettings;
    }
  | {
      kind: 'commit';
      identity: ISongIdentity;
      deviceId: string;
      layer: ISmartEqSettings;
    }
  | { kind: 'notice'; identity: ISongIdentity; entry: ISongEqEntry }
  /**
   * Delete whatever this output remembers about this song — the storage side
   * of a 'forget' event, once the reducer has decided whose song it is.
   *
   * The whole identity rather than its key, because the entry is very often
   * filed under a different one: a curve learned from a library file and
   * matched from Spotify lives under `library:<id>`, and a key-only delete
   * asked the store to remove a `system:` entry that was never there — and
   * was answered with a success.
   */
  | { kind: 'forget'; deviceId: string; identity: ISongIdentity };

export const getInitialRecorderState = (): ISongEqRecorderState => ({
  deviceId: '',
  isSaveOn: false,
});

const open = (identity: ISongIdentity, now: number): ISongEqSession => ({
  phase: 'settling',
  identity,
  listenedMs: 0,
  playingSince: now,
  settlingSince: now,
  hasCheckpointed: false,
  hasLoan: false,
});

const sameFilter = (a: IFilter, b: IFilter): boolean =>
  a.id === b.id &&
  a.frequency === b.frequency &&
  a.gain === b.gain &&
  a.quality === b.quality &&
  a.type === b.type;

const sameFilters = (a: IFiltersMap, b: IFiltersMap): boolean => {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  return aKeys.every(
    (key, index) => key === bKeys[index] && sameFilter(a[key], b[key]),
  );
};

/**
 * The layer this compares against comes back to us round-tripped through the
 * main process — rebuilt and re-sanitised by `sanitizeSmartEqSettings` — so
 * a key is never guaranteed to land in the same insertion order it left in.
 * A string compare over that JSON would call every echo of our own write
 * "foreign" and drop the loan on every single match; field-wise, key order
 * cannot matter.
 *
 * Only the fields `sanitizeSmartEqSettings` actually keeps. It rebuilds a
 * layer from `filters`, `intensity` and `apoOverride` alone and drops
 * `status`, `lowFrequency` and `highFrequency` on the floor — a stored entry
 * can carry all three, so a round-tripped echo of this recorder's own write
 * never has them, whatever the original had. Comparing a field the sanitiser
 * discards is comparing something that can never match, which dropped the
 * loan on every match whose entry happened to carry a `status`.
 */
const isSameLayer = (
  a: ISmartEqSettings | undefined,
  b: ISmartEqSettings | undefined,
): boolean => {
  // Two absences are the same absence. The continuous engine writes whatever
  // `buildSmartEqSettings` returns, and a correction that comes out empty is
  // no layer at all — the echo of that write has to be recognisable as ours
  // too, or announcing it would achieve nothing in exactly the case where the
  // engine cleared the borrowed curve.
  if (!a && !b) {
    return true;
  }
  // `filters` is typed as always present and a hand-edited `song-eq.json` can
  // still arrive without it. `Object.keys(undefined)` would throw inside the
  // `useEffect` that dispatches `layerChanged`, and the root ErrorBoundary
  // would replace the entire app over one malformed stored song.
  if (!a || !b || !a.filters || !b.filters) {
    return false;
  }
  return (
    sameFilters(a.filters, b.filters) &&
    a.intensity === b.intensity &&
    // Presence only: the override's own contents are an applied config file,
    // not a value this recorder ever wrote, so it cannot be part of "ours".
    (a.apoOverride === undefined) === (b.apoOverride === undefined)
  );
};

export const reduceSongEq = (
  input: ISongEqRecorderState,
  event: TSongEqEvent,
  now: number,
): [ISongEqRecorderState, TSongEqEffect[]] => {
  const [state, timed] = advance(input, now);
  const { session } = state;

  switch (event.kind) {
    case 'tick':
      return [state, timed];

    case 'saveToggled':
      return [{ ...state, isSaveOn: event.isSaveOn }, timed];

    case 'layerChanged': {
      const next = { ...state, liveLayer: event.layer };
      if (!session?.hasLoan) {
        return [next, timed];
      }
      // Ours if it is exactly what we last wrote. Anything else is a manual
      // run, a preset load or a profile switch, and the loan is off.
      const isOurs = isSameLayer(session.written, event.layer);
      if (isOurs) {
        return [next, timed];
      }
      return [
        {
          ...next,
          session: { ...session, hasLoan: false, loanLayer: undefined },
        },
        timed,
      ];
    }

    case 'ownWrite': {
      const next = { ...state, liveLayer: event.layer };
      if (!session) {
        return [next, timed];
      }
      // `written` moves with it, so the echo of this write coming back
      // through context is recognised as ours too. The loan is untouched:
      // refining a borrowed curve is what the loan is FOR.
      return [
        { ...next, session: { ...session, written: event.layer } },
        timed,
      ];
    }

    case 'matched': {
      if (
        !session ||
        session.phase !== 'recording' ||
        !event.entry ||
        // The lookup is a store read the shell answers later. Skip tracks in
        // between and the answer arrives for a song that is no longer playing.
        event.identity.key !== session.identity.key
      ) {
        return [state, timed];
      }
      return [
        {
          ...state,
          liveLayer: event.entry.settings,
          session: {
            ...session,
            hasLoan: true,
            loanLayer: state.liveLayer,
            written: event.entry.settings,
          },
        },
        [
          ...timed,
          { kind: 'applyLayer', settings: event.entry.settings },
          { kind: 'notice', identity: session.identity, entry: event.entry },
        ],
      ];
    }

    case 'undo': {
      if (!session?.hasLoan) {
        return [state, timed];
      }
      return [
        {
          ...state,
          liveLayer: session.loanLayer,
          session: { ...session, hasLoan: false, loanLayer: undefined },
        },
        [...timed, { kind: 'applyLayer', settings: session.loanLayer }],
      ];
    }

    case 'forget': {
      // The notice's identity wins — see the event's own comment. The session
      // is the fallback for a Forget raised with no notice up.
      const target = event.identity ?? session?.identity;
      if (!target) {
        return [state, timed];
      }
      const forgetEffect: TSongEqEffect = {
        kind: 'forget',
        deviceId: state.deviceId,
        identity: target,
      };
      // Only the open session's OWN song hands its loan back and stops being
      // re-filed at close. Forgetting a song whose notice has outlived it is a
      // store deletion and nothing more: taking the loan off whatever is
      // playing now would undo a match nobody asked about.
      if (!session || session.identity.key !== target.key) {
        return [state, [...timed, forgetEffect]];
      }
      return [
        {
          ...state,
          liveLayer: session.hasLoan ? session.loanLayer : state.liveLayer,
          session: {
            ...session,
            hasLoan: false,
            loanLayer: undefined,
            forgotten: true,
          },
        },
        session.hasLoan
          ? [
              ...timed,
              forgetEffect,
              { kind: 'applyLayer', settings: session.loanLayer },
            ]
          : [...timed, forgetEffect],
      ];
    }

    case 'deviceChanged': {
      if (!session) {
        return [{ ...state, deviceId: event.deviceId }, timed];
      }
      // Committed under the OLD device: the curve was learned on that
      // transducer and belongs to it. The new id is merged on AFTER closing,
      // so the close reads and reports the device the session was on.
      const [closed, closedEffects] = closeSession(
        state,
        session,
        now,
        state.deviceId,
      );
      return [
        { ...closed, deviceId: event.deviceId },
        [...timed, ...closedEffects],
      ];
    }

    case 'closing': {
      if (!session) {
        return [state, timed];
      }
      const [closed, closedEffects] = closeSession(
        state,
        session,
        now,
        state.deviceId,
      );
      return [closed, [...timed, ...closedEffects]];
    }

    case 'nowPlaying': {
      const { identity, isPlaying } = event;

      if (!identity) {
        if (!session) {
          return [state, timed];
        }
        if (session.phase === 'settling') {
          return [{ ...state, session: undefined }, timed];
        }
        const [closed, closedEffects] = closeSession(
          state,
          session,
          now,
          state.deviceId,
        );
        return [closed, [...timed, ...closedEffects]];
      }

      if (session && session.identity.key === identity.key) {
        if (isPlaying) {
          return [
            {
              ...state,
              session: {
                ...session,
                phase: session.phase === 'settling' ? 'settling' : 'recording',
                playingSince: session.playingSince ?? now,
                suspendedSince: undefined,
              },
            },
            timed,
          ];
        }
        if (session.phase === 'settling') {
          return [{ ...state, session: undefined }, timed];
        }
        return [
          {
            ...state,
            session: {
              ...session,
              phase: 'suspended',
              listenedMs: listenedAt(session, now),
              playingSince: undefined,
              suspendedSince: session.suspendedSince ?? now,
            },
          },
          timed,
        ];
      }

      // A different song. Close the old one — unless it never settled, which
      // is somebody clicking through a queue and is worth nothing.
      if (!session || session.phase === 'settling') {
        return [
          { ...state, session: isPlaying ? open(identity, now) : undefined },
          timed,
        ];
      }
      const [closed, closedEffects] = closeSession(
        state,
        session,
        now,
        state.deviceId,
      );
      return [
        { ...closed, session: isPlaying ? open(identity, now) : undefined },
        [...timed, ...closedEffects],
      ];
    }

    default: {
      // TSongEqEvent is a fully-covered discriminated union and every case
      // above returns, so this branch never runs at runtime — a plain
      // `default: return [state, timed];` would be dead code, and the
      // Global Constraints forbid that. Assigning `event` to a
      // `never`-typed const instead means a future event kind that forgets
      // its own case above fails to *compile* here, rather than silently
      // falling through and dropping the event on the floor. ESLint's
      // `default-case` and `consistent-return` still require this branch to
      // exist, since neither rule can see that the switch is exhaustive.
      const exhaustive: never = event;
      throw new Error(`Unhandled songEq event: ${JSON.stringify(exhaustive)}`);
    }
  }
};
