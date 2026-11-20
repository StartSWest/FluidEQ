/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ISongSound, sameSongSound } from './songSound';
import { ISongSoundParts, ISongSoundState } from './songSoundEvents';
import { TStep, giveEverythingBack, lookupOpen } from './songSoundSteps';

/**
 * What the listener chooses about Auto EQ's song and album sounds while a
 * song plays — "Save for this song", Save changes, Back to saved, a switch
 * moved — and the song looked up
 * again when what is kept changed elsewhere: steps of `reduceSongSound`
 * (`songSoundRecorder.ts`) beside the ones songs playing make
 * (`songSoundSteps.ts`). Pure, as those are.
 */

/**
 * Whether the song plays a saved sound and the listener has changed it since:
 * the panel's "Changed, not saved", with Back to saved and Save changes. Not
 * while a sound is on its way: half of it landed is nobody's change.
 */
export const isSongSoundChanged = (state: ISongSoundState): boolean => {
  const { session, live } = state;
  return (
    session !== undefined &&
    session.owner !== undefined &&
    !session.isLoaded &&
    session.baseline !== undefined &&
    live !== undefined &&
    state.pending === undefined &&
    !sameSongSound(live, session.baseline)
  );
};

/**
 * "Save for this song", or Save changes over a saved sound: what plays is
 * filed for the song now and is its own from here; a change after it is
 * changed again until saved. The listener's own sound still comes back after
 * it, as after any saved song.
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
      session: { ...session, owner: 'song', baseline: live },
    },
    [{ kind: 'save', identity: session.identity, sound: live }],
  ];
};

/**
 * Back to saved: the saved sound as it plays (`baseline`) on again, and the
 * changes made over it left — lent where the song borrowed the listener's
 * sound, as it was when it went on.
 */
export const revert = (state: ISongSoundState): TStep => {
  const { session } = state;
  if (!isSongSoundChanged(state) || !session?.baseline) {
    return [state, []];
  }
  const sound = session.baseline;
  return [
    { ...state, pending: sound },
    [{ kind: 'apply', sound, isLent: session.handBack !== undefined }],
  ];
};

/**
 * A saved EQ put on by the listener. While a song plays a sound it borrowed,
 * the EQ is lent too, as an edit made over that sound is kept out of the
 * output's profile, and the song's end hands back the listener's own sound as
 * it always does; over the listener's own sound it simply is their sound now.
 */
export const putOn = (state: ISongSoundState, sound: ISongSound): TStep => [
  { ...state, pending: sound },
  [{ kind: 'apply', sound, isLent: state.session?.handBack !== undefined }],
];

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
