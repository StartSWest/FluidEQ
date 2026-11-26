/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ISongSound, sameSongSound } from './songSound';
import {
  ISongSoundState,
  TSongSoundEffect,
  TSongSoundEvent,
} from './songSoundEvents';
import {
  advance,
  close,
  deviceChanged,
  giveBack,
  giveEverythingBack,
  matched,
  nowPlaying,
  TStep,
} from './songSoundSteps';
import { withWorking, withoutWorking } from './songSoundWorking';
import {
  picked,
  putOn,
  reconsider,
  revert,
  saveNow,
  switched,
} from './songSoundChoices';

export { getInitialSongSoundState } from './songSoundEvents';
export type {
  IAlbumSoundMatch,
  ISongSoundOwed,
  ISongSoundParts,
  ISongSoundSession,
  ISongSoundState,
  TSongSoundEffect,
  TSongSoundEvent,
  TSongSoundOwner,
  TSongSoundPhase,
} from './songSoundEvents';

/**
 * When a song's sound is filed, when it is put back on, and what is handed
 * back at its end (`songSound.ts` for what a sound is, `songSoundMemory.ts`
 * for where it is kept).
 *
 * A pure reducer with the clock passed in, like the Smart EQ memory's
 * (`songEqRecorder.ts`), whose pause grace it shares: a pause under a minute
 * is the same play. Unlike that memory a song is looked up the moment it is
 * named, with no settle (`open` in `songSoundSteps.ts` says why).
 * `songSoundSession.ts` performs the effects and decides nothing.
 *
 * WHAT IS FILED: what plays, when the listener presses "Save for this song"
 * or, over a saved sound they changed, Save changes (`saveNow`) — never a
 * song's end (Ivan approved explicit saving, 2026-11-20: "ok with auto eq
 * song save"). A change made while a saved sound plays is heard at once and
 * shown as "Changed, not saved", with Back to saved (`revert`); left unsaved,
 * it stays the song's working version and plays, still shown as changed,
 * the next time the song does (`songSoundWorking.ts`). Over its album's
 * sound a save is the song's alone; an album changes in
 * the Library only (Ivan, 2026-11-19). It used to be filed by itself at the
 * song's end: nothing on screen said so, and Clear EQ pressed during a saved
 * song saved it flat.
 *
 * WHAT IS LENT: a remembered song's sound goes on as its lookup answers and
 * is the song's while it plays — lent even when it is the listener's own, so
 * nothing changed while it plays reaches their EQ (`lendAsOwn`) — and the
 * listener's own sound, exactly as they left it, is handed back at its end,
 * so a song with no memory plays with what the listener chose, not with the
 * last remembered song's. The hand-back waits for the next song's answer when one follows:
 * handed back at once and replaced a moment later by the next song's own,
 * two remembered songs in a row would play a moment of a third sound between
 * them. Main keeps a lent sound out of the output's profile until the loan
 * ends, which only an `apply` that is not lent, a `return` or a `keep` does — so every path here that ends a loan says so, even where the sound
 * would not change.
 */
/**
 * THE LISTENER'S OWN SOUND IS NEVER A SONG'S (Ivan, 2026-11-26: "The
 * listener's own EQ is never overwritten by a song: it is kept once, at the
 * moment it is left for a song's sound"). It is what main's loan took when
 * the first song's sound went on (`songSoundLoan.ts`), handed back exactly
 * at the end, and nothing here ever replaces it. A change made while a
 * song's or an album's sound plays goes into that song's working version and
 * nowhere else ("never into the listener's EQ, never into the previous
 * song's sound").
 *
 * It used to be the last sound picked by hand (2026-11-20): a change made
 * over a saved song's sound became the hand-back, the next song's preset
 * alone then played over the bands changed on the song before, and a pick
 * made between two songs was taken as the listener's while main, which
 * hands back what its loan took, put their own back over it and lost it.
 *
 * What a saved song loads never counts: a sound on its way, or arriving, is
 * nobody's hand.
 */
const byHand = (
  state: ISongSoundState,
  sound: ISongSound | undefined,
  isOurs: boolean,
  /** What the window heard before this report. */
  heard: ISongSound | undefined,
): ISongSoundState => {
  if (!sound || isOurs) {
    return state;
  }
  const { session, owed } = state;
  if (
    session?.owner &&
    session.handBack &&
    !session.isLoaded &&
    session.baseline
  ) {
    return withWorking(state, session.identity.key, session.baseline, sound);
  }
  // Between songs, the next one's answer not in yet, the last song's saved
  // sound still plays: a change then is that song's. Only a sound that moved
  // is a change — the window reports the same sound again whenever what it
  // is read from is rebuilt, and a change of track does it (Ivan,
  // 2026-11-20: "kpop? what the heck").
  if (
    owed?.from &&
    !session?.owner &&
    !(heard && sameSongSound(heard, sound))
  ) {
    return withWorking(state, owed.from.key, owed.from.over, sound);
  }
  return state;
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
      const next: ISongSoundState = {
        ...state,
        live: sound,
        pending: isArrived ? undefined : state.pending,
        // A song opened before the window knew its sound begins with the
        // first one it hears.
        session:
          session && !session.baseline && !state.pending
            ? { ...session, baseline: sound }
            : session,
      };
      return [
        byHand(
          next,
          sound,
          isArrived || state.pending !== undefined,
          state.live,
        ),
        timed,
      ];
    }

    case 'matched':
      return withTimed(
        matched(
          state,
          event.identity,
          event.song,
          event.album,
          event.isPick === true,
        ),
      );

    case 'saveNow':
      return withTimed(saveNow(state));

    case 'revert':
      return withTimed(revert(state));

    case 'putOn':
      return withTimed(putOn(state, event.sound));

    case 'reconsider':
      return withTimed(reconsider(state));

    case 'picked':
      return withTimed(picked(state));

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
      const forget: TSongSoundEffect = { kind: 'forget', identity: target };
      // Forgotten, it has no saved sound for a working version to be over.
      const forgotten = withoutWorking(state, target.key);
      // Only the open song's own forgetting hands its sound back; a notice
      // that outlived its song forgets the entry and nothing more.
      if (!session || session.identity.key !== target.key) {
        return [forgotten, [...timed, forget]];
      }
      const [next, effects] = giveBack(forgotten, session, {});
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
      return withTimed(deviceChanged(state, event.deviceId));

    case 'switched':
      return withTimed(switched(state, event.parts));

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
