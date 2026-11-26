/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ISongSound, sameSongSound } from './songSound';
import { ISongSoundState, ISongSoundWorking } from './songSoundEvents';

/**
 * Each song's working version of its saved sound (`ISongSoundWorking`): what
 * a change made while the song's or its album's sound played went into, and
 * nowhere else — never the listener's own sound, never the song before's
 * (Ivan, 2026-11-26: "Edits while a song's sound is playing go into THAT
 * song's working version only"). Save changes makes it the saved one, Back
 * to saved drops it, and a sound picked for the song replaces both.
 */

/**
 * How many songs keep a working version. A session of skipping through a
 * queue and touching every song is far under it; the oldest change goes
 * first past it, so memory stays bounded however long the window runs.
 */
export const SONG_SOUND_WORKING_MAX = 200;

/** The song's working version, if it was made over the saved sound it plays
 * now: one made over a saved sound changed since is about a sound gone. */
export const workingOf = (
  state: ISongSoundState,
  key: string,
  over: ISongSound,
): ISongSound | undefined => {
  const entry = state.working?.[key];
  return entry && sameSongSound(entry.over, over) ? entry.sound : undefined;
};

/**
 * What a song plays from its working version, for a saved sound that is a
 * preset alone (`isPresetOnly`): its bands and Tone are the listener's own as
 * they are now, so a working version that changed only the preset plays that
 * preset over them, matched by the preset it was made over. One that changed
 * the bands too — a saved EQ put on over the preset — plays whole, and is the
 * song's whole sound from there (`isWhole`).
 */
export const workingToPlay = (
  state: ISongSoundState,
  key: string,
  saved: ISongSound,
  isPresetOnly: boolean,
): { sound: ISongSound; isWhole: boolean } | undefined => {
  if (!isPresetOnly) {
    const sound = workingOf(state, key, saved);
    return sound && { sound, isWhole: true };
  }
  const entry = state.working?.[key];
  if (!entry || entry.over.presetId !== saved.presetId) {
    return undefined;
  }
  const isPresetChange = sameSongSound(
    { ...entry.sound, presetId: entry.over.presetId },
    entry.over,
  );
  return isPresetChange
    ? { sound: { ...saved, presetId: entry.sound.presetId }, isWhole: false }
    : { sound: entry.sound, isWhole: true };
};

/** The song's working version dropped: saved, taken back, or replaced. */
export const withoutWorking = (
  state: ISongSoundState,
  key: string,
): ISongSoundState => {
  if (!state.working || !(key in state.working)) {
    return state;
  }
  const { [key]: dropped, ...rest } = state.working;
  return { ...state, working: rest };
};

/**
 * What the listener changed the song's saved sound to, kept as its working
 * version — or dropped where the change went back to the saved sound itself,
 * which is no change. The newest is always last, so the cap drops the oldest.
 */
export const withWorking = (
  state: ISongSoundState,
  key: string,
  over: ISongSound,
  sound: ISongSound,
): ISongSoundState => {
  const cleared = withoutWorking(state, key);
  if (sameSongSound(over, sound)) {
    return cleared;
  }
  const kept: Array<[string, ISongSoundWorking]> = [
    ...Object.entries(cleared.working ?? {}),
    [key, { over, sound }],
  ];
  return {
    ...cleared,
    working: Object.fromEntries(kept.slice(-SONG_SOUND_WORKING_MAX)),
  };
};
