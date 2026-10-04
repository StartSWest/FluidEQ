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
  switched,
  TStep,
} from './songSoundSteps';

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
