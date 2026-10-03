/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ISongIdentity } from './songIdentity';
import { ISongSound, ISongSoundEntry, sameSongSound } from './songSound';
import {
  ISongSoundOwed,
  ISongSoundSession,
  ISongSoundState,
  TSongSoundEffect,
  TSongSoundEvent,
} from './songSoundEvents';
import { SONG_EQ_SETTLE_MS, SONG_EQ_SUSPEND_GRACE_MS } from './songEqTiming';

export { getInitialSongSoundState } from './songSoundEvents';
export type {
  ISongSoundOwed,
  ISongSoundSession,
  ISongSoundState,
  TSongSoundEffect,
  TSongSoundEvent,
  TSongSoundPhase,
} from './songSoundEvents';

/**
 * When a song's sound is filed, when it is put back on, and what is handed
 * back at its end (`songSound.ts` for what a sound is).
 *
 * A pure reducer with the clock passed in, like the Smart EQ memory's
 * (`songEqRecorder.ts`), whose settle and pause grace it shares: a song has to
 * hold still for two seconds before it is looked up — clicking through a
 * queue must not rewrite the engine once a song — and a pause under a minute
 * is the same play. `songSoundSession.ts` performs the effects and decides
 * nothing.
 *
 * WHAT IS FILED: the sound a song ends with, when it is not the sound it began
 * with — the listener changed the preset, the Tone or a band while it played
 * (Ivan, 2026-10-02: "when I set that preset and when the song ends or skip to
 * another it will save that preset"). A song nobody touched files nothing,
 * so playing a library through leaves no trace, and no floor of listening
 * time: a change made and skipped past is still a choice for that song. Not
 * a change something else made — a profile loaded or saved, a game putting
 * its sound on, the output switching: a song they reached files nothing that
 * play.
 *
 * WHAT IS LENT: a remembered song's sound goes on once it has settled and
 * is the song's while it plays — a change made then is the song's too — and
 * the sound from before it is handed back at its end, so a song with no
 * memory plays with what the listener had, not with the last remembered
 * song's. The hand-back waits for the next song to settle when one follows:
 * handed back at once and replaced two seconds later by the next song's own,
 * two remembered songs in a row would play a moment of a third sound between
 * them. Main keeps a lent sound out of the output's profile until the loan
 * ends, which only an `apply` that is not lent, a `keep` or an output switch
 * does — so every path here that ends a loan says so, even where the sound
 * would not change.
 */

type TStep = [ISongSoundState, TSongSoundEffect[]];

/** Ask for a song's own sound, unless it is the one already playing. */
const lend = (state: ISongSoundState, sound: ISongSound): TStep =>
  state.live && sameSongSound(state.live, sound)
    ? [{ ...state, pending: undefined }, []]
    : [{ ...state, pending: sound }, [{ kind: 'apply', sound, isLent: true }]];

/**
 * Put the listener's own sound back, which ends the loan. Where it already
 * plays the loan still has to end — main would otherwise go on keeping every
 * edit out of the output's profile — and that is a `keep`.
 */
const handBackTo = (state: ISongSoundState, sound: ISongSound): TStep =>
  state.live && sameSongSound(state.live, sound)
    ? [{ ...state, pending: undefined }, [{ kind: 'keep' }]]
    : [{ ...state, pending: sound }, [{ kind: 'apply', sound, isLent: false }]];

const open = (
  state: ISongSoundState,
  identity: ISongIdentity,
  now: number,
): ISongSoundSession => ({
  identity,
  phase: 'settling',
  settlingSince: now,
  baseline: state.owed?.sound ?? state.pending ?? state.live,
  isLoaded: false,
  isKeptOut: false,
});

/** Whether the sound moved since a hand-back was held over it. */
const isTakenOver = (state: ISongSoundState, owed: ISongSoundOwed): boolean =>
  owed.over !== undefined &&
  state.live !== undefined &&
  !sameSongSound(state.live, owed.over);

/**
 * Settle a hand-back held over from the last song: put on, or — where
 * somebody took over the sound since — kept as theirs.
 */
const settleOwed = (state: ISongSoundState, owed: ISongSoundOwed): TStep => {
  const cleared: ISongSoundState = { ...state, owed: undefined };
  return isTakenOver(state, owed)
    ? [cleared, [{ kind: 'keep' }]]
    : handBackTo(cleared, owed.sound);
};

/**
 * End the session: file it if it was edited, and hand back what it borrowed —
 * now, or held for `nextSong` to settle when one follows. A session that
 * never settled is somebody clicking through, and files nothing; a hand-back
 * held for a song that never settled is put on when nothing follows after all.
 * `handBack` is off for a switch of output, which brings its own sound.
 */
const close = (
  state: ISongSoundState,
  { nextSong, handBack }: { nextSong: boolean; handBack: boolean },
): TStep => {
  const { session, live } = state;
  let next: ISongSoundState = { ...state, session: undefined };
  const effects: TSongSoundEffect[] = [];
  if (session && session.phase !== 'settling') {
    if (
      state.isOn &&
      state.deviceId !== '' &&
      !session.isLoaded &&
      !session.isKeptOut &&
      !state.pending &&
      live &&
      session.baseline &&
      !sameSongSound(live, session.baseline)
    ) {
      effects.push({
        kind: 'save',
        deviceId: state.deviceId,
        identity: session.identity,
        sound: live,
      });
    }
    if (handBack && session.handBack) {
      if (nextSong && state.isOn) {
        next = { ...next, owed: { sound: session.handBack, over: live } };
      } else {
        const [handed, handedEffects] = handBackTo(next, session.handBack);
        next = handed;
        effects.push(...handedEffects);
      }
    }
  }
  const { owed } = next;
  if (!nextSong && handBack && owed) {
    const [settled, settledEffects] = settleOwed(next, owed);
    next = settled;
    effects.push(...settledEffects);
  }
  return [next, effects];
};

/** Settling and the pause grace: time passing, carried by any event. */
const advance = (state: ISongSoundState, now: number): TStep => {
  const { session } = state;
  if (!session) {
    return [state, []];
  }
  if (
    session.phase === 'settling' &&
    now - session.settlingSince >= SONG_EQ_SETTLE_MS
  ) {
    return [
      { ...state, session: { ...session, phase: 'playing' } },
      state.isOn && state.deviceId !== '' && !session.isLoaded
        ? [
            {
              kind: 'lookup',
              deviceId: state.deviceId,
              identity: session.identity,
            },
          ]
        : [],
    ];
  }
  if (
    session.phase === 'suspended' &&
    session.suspendedSince !== undefined &&
    now - session.suspendedSince >= SONG_EQ_SUSPEND_GRACE_MS
  ) {
    return close(state, { nextSong: false, handBack: true });
  }
  return [state, []];
};

/**
 * The answer to a lookup, for the song it was asked about. The hand-back held
 * over from the last song is settled here either way: replaced by this
 * song's own sound, or put on — unless the sound moved since it was held,
 * which is somebody taking over, whose sound stays.
 */
const matched = (
  state: ISongSoundState,
  identity: ISongIdentity,
  entry: ISongSoundEntry | undefined,
): TStep => {
  const { session } = state;
  if (
    !session ||
    session.phase === 'settling' ||
    identity.key !== session.identity.key
  ) {
    return [state, []];
  }
  const { owed } = state;
  const isOwedLive = owed !== undefined && !isTakenOver(state, owed);
  // What the song would play with if it had no sound of its own: what is owed
  // to it, or what was last asked for and has not landed, or what plays.
  const before =
    owed && isOwedLive ? owed.sound : (state.pending ?? state.live);
  // Nothing to hand back is nothing to lend against: the window has not heard
  // the sound yet, or it is one this memory does not cover.
  if (!state.isOn || !entry || session.isLoaded || !before) {
    if (!owed) {
      return [state, []];
    }
    const [settled, effects] = settleOwed(state, owed);
    return [
      {
        ...settled,
        session: isOwedLive ? { ...session, baseline: owed.sound } : session,
      },
      effects,
    ];
  }
  const cleared: ISongSoundState = { ...state, owed: undefined };
  if (sameSongSound(before, entry.sound)) {
    // The song's own sound is the listener's own: nothing to lend, and a loan
    // held over from the last song ends on it.
    const [handed, effects] = owed
      ? handBackTo(cleared, entry.sound)
      : [cleared, []];
    return [
      { ...handed, session: { ...session, baseline: entry.sound } },
      effects,
    ];
  }
  const [lent, effects] = lend(cleared, entry.sound);
  return [
    {
      ...lent,
      session: { ...session, baseline: entry.sound, handBack: before },
    },
    [...effects, { kind: 'notice', identity: session.identity, entry }],
  ];
};

/** The song's own sound taken off it, for this play. */
const giveBack = (
  state: ISongSoundState,
  session: ISongSoundSession,
  extra: Partial<ISongSoundSession>,
): TStep => {
  if (!session.handBack) {
    return [{ ...state, session: { ...session, ...extra } }, []];
  }
  const [handed, effects] = handBackTo(state, session.handBack);
  return [
    {
      ...handed,
      session: {
        ...session,
        ...extra,
        baseline: session.handBack,
        handBack: undefined,
      },
    },
    effects,
  ];
};

/**
 * Everything a song borrowed, and anything held over for it, given back now
 * (switching the memory off, and something else putting a sound on).
 */
const giveEverythingBack = (
  state: ISongSoundState,
  extra: Partial<ISongSoundSession>,
): TStep => {
  const { session, owed } = state;
  const [settled, owedEffects] = owed ? settleOwed(state, owed) : [state, []];
  if (!session) {
    return [settled, owedEffects];
  }
  const [next, effects] = giveBack(settled, session, extra);
  return [next, [...owedEffects, ...effects]];
};

const nowPlaying = (
  input: ISongSoundState,
  identity: ISongIdentity | undefined,
  isPlaying: boolean,
  now: number,
): TStep => {
  const state: ISongSoundState = {
    ...input,
    playing: identity ? { identity, isPlaying } : undefined,
  };
  const { session } = state;
  if (!identity) {
    return close(state, { nextSong: false, handBack: true });
  }
  if (session && session.identity.key === identity.key) {
    if (isPlaying) {
      return [
        {
          ...state,
          session: {
            ...session,
            phase: session.phase === 'settling' ? 'settling' : 'playing',
            suspendedSince: undefined,
          },
        },
        [],
      ];
    }
    if (session.phase === 'settling') {
      return [{ ...state, session: undefined }, []];
    }
    return [
      {
        ...state,
        session: {
          ...session,
          phase: 'suspended',
          suspendedSince: session.suspendedSince ?? now,
        },
      },
      [],
    ];
  }
  const [closed, effects] = close(state, {
    nextSong: isPlaying,
    handBack: true,
  });
  return [
    {
      ...closed,
      session: isPlaying ? open(closed, identity, now) : undefined,
    },
    effects,
  ];
};

const deviceChanged = (
  state: ISongSoundState,
  deviceId: string,
  now: number,
): TStep => {
  if (deviceId === state.deviceId) {
    return [state, []];
  }
  if (state.deviceId === '') {
    // The window learning which output it starts on is not a switch: the song
    // playing at launch is the listener's like any other, and is looked up
    // now if it settled before the output was known.
    const { session } = state;
    return [
      { ...state, deviceId },
      session?.phase === 'playing' && state.isOn && !session.isLoaded
        ? [{ kind: 'lookup', deviceId, identity: session.identity }]
        : [],
    ];
  }
  // Filed on the output it was played on, and nothing handed back: the new
  // output brings its own Tone and EQ, and main carried the listener's own
  // preset across — the lent one never reached the old output's profile.
  const [closed, effects] = close(state, { nextSong: false, handBack: false });
  const moved: ISongSoundState = {
    ...closed,
    deviceId,
    pending: undefined,
    owed: undefined,
  };
  const { playing } = moved;
  return [
    {
      ...moved,
      // The song carries on there, reached by the switch: nothing it ends
      // with is the listener's choice, and nothing is lent to it this play.
      session: playing?.isPlaying
        ? { ...open(moved, playing.identity, now), isLoaded: true }
        : undefined,
    },
    [...effects, { kind: 'release' }],
  ];
};

const switched = (state: ISongSoundState, isOn: boolean): TStep => {
  if (isOn === state.isOn) {
    return [state, []];
  }
  const { session } = state;
  if (!isOn) {
    // Off: the song's own sound comes off it, and nothing is filed.
    return giveEverythingBack({ ...state, isOn: false }, {});
  }
  return [
    { ...state, isOn: true },
    session?.phase === 'playing' && !session.isLoaded
      ? [
          {
            kind: 'lookup',
            deviceId: state.deviceId,
            identity: session.identity,
          },
        ]
      : [],
  ];
};

export const reduceSongSound = (
  input: ISongSoundState,
  event: TSongSoundEvent,
  now: number,
): TStep => {
  const [state, timed] = advance(input, now);
  const withTimed = ([next, effects]: TStep): TStep => [
    next,
    [...timed, ...effects],
  ];
  const { session } = state;

  switch (event.kind) {
    case 'tick':
      return [state, timed];

    case 'nowPlaying':
      return withTimed(nowPlaying(state, event.identity, event.isPlaying, now));

    case 'soundChanged': {
      const { sound } = event;
      const isArrived =
        sound !== undefined &&
        state.pending !== undefined &&
        sameSongSound(sound, state.pending);
      // Said when it happens, not at the song's end: another preset put on by
      // the listener's hand while a song plays — never one of this memory's
      // own on its way (`pending`), never on a song something else reached —
      // and only where it is not the preset the song began with, which would
      // file no change of preset at all.
      const willSave =
        state.isOn &&
        state.deviceId !== '' &&
        session !== undefined &&
        !session.isLoaded &&
        !session.isKeptOut &&
        state.pending === undefined &&
        sound !== undefined &&
        state.live !== undefined &&
        session.baseline !== undefined &&
        sound.presetId !== state.live.presetId &&
        sound.presetId !== session.baseline.presetId;
      return [
        {
          ...state,
          live: sound,
          pending: isArrived ? undefined : state.pending,
          // A song opened before the window knew its sound begins with the
          // first one it hears.
          session:
            session && !session.baseline && !state.pending
              ? { ...session, baseline: sound }
              : session,
        },
        willSave && sound && session
          ? [
              ...timed,
              {
                kind: 'willSave',
                identity: session.identity,
                presetId: sound.presetId,
              },
            ]
          : timed,
      ];
    }

    case 'dontSave':
      return [
        { ...state, session: session && { ...session, isKeptOut: true } },
        timed,
      ];

    case 'matched':
      return withTimed(matched(state, event.identity, event.entry));

    case 'applied': {
      // By the object, not by value: a newer ask has replaced it, and this
      // answer is about a sound nobody is waiting for any more.
      if (state.pending !== event.asked) {
        return [state, timed];
      }
      const landed = event.landed ?? state.live;
      return [
        {
          ...state,
          pending: undefined,
          live: landed,
          // What a song was put on with is what landed, so the difference is
          // not read as somebody's edit at its end.
          session:
            session && session.baseline === event.asked
              ? { ...session, baseline: landed }
              : session,
        },
        timed,
      ];
    }

    case 'undo':
      return session ? withTimed(giveBack(state, session, {})) : [state, timed];

    case 'forget': {
      const target = event.identity ?? session?.identity;
      if (!target) {
        return [state, timed];
      }
      const forget: TSongSoundEffect = {
        kind: 'forget',
        deviceId: state.deviceId,
        identity: target,
      };
      // Only the open song's own forgetting hands its sound back; a notice
      // that outlived its song forgets the entry and nothing more.
      if (!session || session.identity.key !== target.key) {
        return [state, [...timed, forget]];
      }
      const [next, effects] = giveBack(state, session, { isKeptOut: true });
      return [next, [...timed, forget, ...effects]];
    }

    case 'yield':
      return withTimed(giveEverythingBack(state, { isLoaded: true }));

    case 'keep':
      // What plays is saved as it is: nothing handed back over it, nothing
      // owed put on over it, and the song files nothing.
      return [
        {
          ...state,
          owed: undefined,
          session: session && {
            ...session,
            isLoaded: true,
            handBack: undefined,
          },
        },
        [...timed, { kind: 'keep' }],
      ];

    case 'deviceChanged':
      return withTimed(deviceChanged(state, event.deviceId, now));

    case 'switched':
      return withTimed(switched(state, event.isOn));

    case 'closing':
      return withTimed(close(state, { nextSong: false, handBack: true }));

    default: {
      // A fully covered union: an event added without a case here fails to
      // compile rather than being dropped.
      const exhaustive: never = event;
      throw new Error(
        `Unhandled songSound event: ${JSON.stringify(exhaustive)}`,
      );
    }
  }
};
