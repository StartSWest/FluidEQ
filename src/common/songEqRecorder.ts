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

import { ISmartEqSettings } from './constants';
import { ISongEqEntry } from './songEq';
import { ISongIdentity } from './songIdentity';

/**
 * When a song starts being recorded, when it stops, and what happens in between.
 *
 * A pure reducer with the clock passed in, and that is the whole reason this
 * file exists apart from its shell. The two-minute floor, the settle, the
 * suspend grace and the loan are the four rules that decide whether this
 * feature is trustworthy, and none of them can be tested through a window, an
 * audio element or a real timer without the test becoming slower than the
 * behaviour it checks.
 *
 * `songEqSession.ts` in the renderer owns the subscriptions, the interval and
 * the performing of effects. It holds no rules.
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
  | { kind: 'layerChanged'; layer?: ISmartEqSettings }
  | { kind: 'deviceChanged'; deviceId: string }
  | { kind: 'saveToggled'; isSaveOn: boolean }
  | { kind: 'matched'; entry?: ISongEqEntry }
  | { kind: 'undo' }
  | { kind: 'closing' };

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
  | { kind: 'notice'; identity: ISongIdentity; entry: ISongEqEntry };

export const getInitialRecorderState = (): ISongEqRecorderState => ({
  deviceId: '',
  isSaveOn: false,
});

/** Listened time including the run in progress. */
const listenedAt = (session: ISongEqSession, now: number) =>
  session.listenedMs +
  (session.playingSince === undefined ? 0 : now - session.playingSince);

/**
 * End a session: save it if it earned that, hand back the loan if it is still
 * ours, and produce the effects for both.
 *
 * The order is deliberate and load-bearing. Reversed, the refinement would be
 * read off a layer already put back to what preceded the song, and every
 * remembered curve would decay towards whatever was in the chain before it.
 */
const close = (
  state: ISongEqRecorderState,
  session: ISongEqSession,
  now: number,
  deviceId: string,
): TSongEqEffect[] => {
  const effects: TSongEqEffect[] = [];
  const listened = listenedAt(session, now);
  if (
    state.isSaveOn &&
    listened >= SONG_EQ_MIN_LISTENED_MS &&
    state.liveLayer
  ) {
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

const open = (identity: ISongIdentity, now: number): ISongEqSession => ({
  phase: 'settling',
  identity,
  listenedMs: 0,
  playingSince: now,
  settlingSince: now,
  hasCheckpointed: false,
  hasLoan: false,
});

/** Settle, checkpoint and grace, all of which are time passing rather than
 * anything happening. Shared by `tick` and by every event, because an event
 * arriving is also a moment at which time has passed. */
const advance = (
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
    return [
      { ...state, session: undefined },
      close(state, session, now, state.deviceId),
    ];
  }

  if (
    session.phase === 'recording' &&
    !session.hasCheckpointed &&
    state.isSaveOn &&
    state.liveLayer &&
    listenedAt(session, now) >= SONG_EQ_MIN_LISTENED_MS
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

/** A deep compare is the honest test here: "ours" means byte-identical to
 * what this recorder last wrote, not merely present, so a coincidental match
 * from elsewhere is never mistaken for the loan surviving. */
const isSameLayer = (
  a: ISmartEqSettings | undefined,
  b: ISmartEqSettings | undefined,
): boolean => JSON.stringify(a) === JSON.stringify(b);

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

    case 'matched': {
      if (!session || session.phase !== 'recording' || !event.entry) {
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

    case 'deviceChanged': {
      if (!session) {
        return [{ ...state, deviceId: event.deviceId }, timed];
      }
      // Committed under the OLD device: the curve was learned on that
      // transducer and belongs to it.
      return [
        { ...state, deviceId: event.deviceId, session: undefined },
        [...timed, ...close(state, session, now, state.deviceId)],
      ];
    }

    case 'closing': {
      if (!session) {
        return [state, timed];
      }
      return [
        { ...state, session: undefined },
        [...timed, ...close(state, session, now, state.deviceId)],
      ];
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
        return [
          { ...state, session: undefined },
          [...timed, ...close(state, session, now, state.deviceId)],
        ];
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
      const closing =
        session && session.phase !== 'settling'
          ? close(state, session, now, state.deviceId)
          : [];
      return [
        {
          ...state,
          session: isPlaying ? open(identity, now) : undefined,
          // The loan has been handed back by `close`, so what is live now is
          // whatever it restored.
          liveLayer:
            session?.hasLoan === true ? session.loanLayer : state.liveLayer,
        },
        [...timed, ...closing],
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
