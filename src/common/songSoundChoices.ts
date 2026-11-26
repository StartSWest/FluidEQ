/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ISongSound, sameSongSound } from './songSound';
import type { ISongIdentity } from './songIdentity';
import {
  ISongSoundParts,
  ISongSoundState,
  TSongSoundEffect,
} from './songSoundEvents';
import {
  TStep,
  giveEverythingBack,
  lendAsOwn,
  lookupOpen,
} from './songSoundSteps';
import { withWorking, withoutWorking } from './songSoundWorking';

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
  // The working version is the saved one now.
  const saved = withoutWorking(state, session.identity.key);
  const save: TSongSoundEffect = {
    kind: 'save',
    identity: session.identity,
    sound: live,
  };
  // Already lent — to this song, or still to the last one, whose hand-back
  // waits for this song's answer: the loan goes on, now this song's.
  const held = session.handBack ?? state.owed?.sound;
  if (held) {
    return [
      {
        ...saved,
        owed: undefined,
        session: { ...session, owner: 'song', baseline: live, handBack: held },
      },
      [save],
    ];
  }
  // Saved over the listener's own sound: the song's sound is theirs, and it
  // is lent to the song from here like any song's, so what is changed while
  // it plays stays the song's (`lendAsOwn`).
  const [lent, effects] = lendAsOwn(saved, live);
  return [
    {
      ...lent,
      session: { ...session, owner: 'song', baseline: live, handBack: live },
    },
    [save, ...effects],
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
    { ...withoutWorking(state, session.identity.key), pending: sound },
    [{ kind: 'apply', sound, isLent: session.handBack !== undefined }],
  ];
};

/**
 * A saved EQ put on by the listener. While a song plays a sound it borrowed,
 * the EQ is lent too and is a change to that song's sound: its working
 * version, decided here at the pick because a sound heard while it is on its
 * way counts as nobody's hand — and never the listener's own sound, which is
 * still what the song hands back at its end (Ivan, 2026-11-26: "Picking a
 * preset never overwrites the listener's main EQ"). Over the listener's own
 * sound it simply is their sound now. It used to replace what the song hands
 * back while lent, which made a song's change the listener's.
 */
export const putOn = (state: ISongSoundState, sound: ISongSound): TStep => {
  const { session } = state;
  const isLent = session?.handBack !== undefined;
  const changed =
    session?.owner && isLent && !session.isLoaded && session.baseline
      ? withWorking(state, session.identity.key, session.baseline, sound)
      : state;
  return [{ ...changed, pending: sound }, [{ kind: 'apply', sound, isLent }]];
};

/** Look the playing song up again, for an answer changed elsewhere. */
export const reconsider = (state: ISongSoundState): TStep => [
  state,
  lookupOpen(state),
];

/**
 * A sound picked for the playing song or its album: looked up, and its answer
 * marked a pick, which plays over a change made since (`matched`). A plain
 * look-up keeps such a change, which is right for something saved elsewhere
 * and was wrong for this: Ivan changed the preset of a song playing its
 * album's Pop by hand, picked Pop for the album again, and kept hearing his
 * change, because the answer was the sound the song already held.
 */
export const picked = (state: ISongSoundState): TStep => [
  state,
  lookupOpen(state).map((effect) =>
    effect.kind === 'lookup' ? { ...effect, isPick: true } : effect,
  ),
];

/** Whether a pick reaches this song: it is one of the songs picked, or on the
 * album whose sound was set. */
export const pickCovers = (
  identity: ISongIdentity,
  pick: { keys?: readonly string[]; albumKey?: string },
): boolean =>
  (pick.keys?.includes(identity.key) ?? false) ||
  (pick.albumKey !== undefined && identity.albumKey === pick.albumKey);

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
