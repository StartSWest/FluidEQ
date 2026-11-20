/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ISongSoundParts, ISongSoundState } from './songSoundEvents';
import { TStep, giveEverythingBack, lookupOpen } from './songSoundSteps';

/**
 * What the listener chooses about Auto EQ's song and album sounds while a
 * song plays — "Save for this song", a switch moved — and the song looked up
 * again when what is kept changed elsewhere: steps of `reduceSongSound`
 * (`songSoundRecorder.ts`) beside the ones songs playing make
 * (`songSoundSteps.ts`). Pure, as those are.
 */

/**
 * "Save for this song": what plays is filed for it now, and is its own for
 * the rest of the play — a change from here on is filed at its end. The
 * listener's own sound still comes back after it, as after any saved song.
 */
export const saveNow = (state: ISongSoundState): TStep => {
  const { session, live } = state;
  if (
    !session ||
    session.isLoaded ||
    !state.parts.songs ||
    state.pending ||
    !live
  ) {
    return [state, []];
  }
  return [
    {
      ...state,
      session: { ...session, owner: 'song', baseline: live, isKeptOut: false },
    },
    [{ kind: 'save', identity: session.identity, sound: live, isPlay: false }],
  ];
};

/** Look the playing song up again, for an answer changed elsewhere. */
export const reconsider = (state: ISongSoundState): TStep => [
  state,
  lookupOpen(state),
];

/**
 * A switch moved. All off gives back whatever a song borrowed; anything else
 * asks about the playing song again, so a song that plays its album's sound
 * gives it back when Album sounds goes off and takes it when it comes on.
 */
export const switched = (
  state: ISongSoundState,
  parts: ISongSoundParts,
): TStep => {
  if (
    parts.songs === state.parts.songs &&
    parts.albums === state.parts.albums
  ) {
    return [state, []];
  }
  const isOn = parts.songs || parts.albums;
  const next: ISongSoundState = { ...state, parts, isOn };
  if (!isOn) {
    // Off: the song's own sound comes off it, and nothing is filed.
    return giveEverythingBack(next, {});
  }
  return [next, lookupOpen(next)];
};
