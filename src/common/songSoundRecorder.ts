/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { sameSongSound } from './songSound';
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
 * it stays behind with the song, which plays its saved sound next time, and
 * the listener's own sound comes back for the next song as after any saved
 * one. Over its album's sound a save is the song's alone; an album changes in
 * the Library only (Ivan, 2026-11-19). It used to be filed by itself at the
 * song's end: nothing on screen said so, and Clear EQ pressed during a saved
 * song saved it flat.
 *
 * WHAT IS LENT: a remembered song's sound goes on as its lookup answers and
 * is the song's while it plays, and the sound from before it is handed back
 * at its end, so a song with no memory plays with what the listener had, not
 * with the last remembered
 * song's. The hand-back waits for the next song's answer when one follows:
 * handed back at once and replaced a moment later by the next song's own,
 * two remembered songs in a row would play a moment of a third sound between
 * them. Main keeps a lent sound out of the output's profile until the loan
 * ends, which only an `apply` that is not lent, a `keep` or an output switch
 * does — so every path here that ends a loan says so, even where the sound
 * would not change.
 */
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
      // Only the open song's own forgetting hands its sound back; a notice
      // that outlived its song forgets the entry and nothing more.
      if (!session || session.identity.key !== target.key) {
        return [state, [...timed, forget]];
      }
      const [next, effects] = giveBack(state, session, {});
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
