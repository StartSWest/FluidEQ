/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Translate } from 'common/i18n';
import { type ISavedEqSummary, libraryTrackIdOf } from 'common/songSoundMemory';
import type { ISongSound } from 'common/songSound';
import {
  type ISongSoundNow,
  revertSongSound,
  songSoundPicked,
} from './songSoundSession';
import type { ISongSoundIndexView } from './songSoundIndex';
import { savedSoundName } from '../library/librarySoundTag';
import songSoundPresetName from '../components/songSoundPresetName';

/**
 * Whose sound the playing song plays, as its card on the player says it:
 * the song's own, its album's, or one of them changed by hand — `kind`
 * picks the ink the Library's Sound column uses.
 */
export interface ISongCardSound {
  kind: 'song' | 'album' | 'changed';
  text: string;
  /** Changed by hand over a saved sound: whose it is and its name, for Back
   * to it — `revertSongSound`, or asked for afresh where what the session
   * holds as the saved sound is not the one kept (`isAstray`). */
  back?: { owner: 'song' | 'album'; name: string; isAstray?: boolean };
}

/**
 * The preset kept for the saved sound the song plays — its own or its
 * album's — as the index lists it; nothing for a saved EQ, which names its
 * own preset, or where the index has not said.
 */
export const storedPresetOf = (
  now: ISongSoundNow,
  index: Pick<ISongSoundIndexView, 'songs' | 'albums'>,
): string | undefined => {
  const { identity, owner } = now;
  if (!identity || !owner) {
    return undefined;
  }
  let entry: { presetId: string; eqId?: string } | undefined;
  if (owner === 'album') {
    entry =
      identity.albumKey === undefined
        ? undefined
        : index.albums.get(identity.albumKey);
  } else {
    const trackId = libraryTrackIdOf(identity);
    entry = trackId === undefined ? undefined : index.songs.get(trackId);
  }
  return entry && entry.eqId === undefined ? entry.presetId : undefined;
};

/**
 * The saved sound a song plays when nothing is changed over it — its own or
 * its album's — by the name the Library gives it: the saved EQ it follows,
 * or its preset. What plays may be a change made over it; this is the sound
 * under the change.
 */
export const savedSoundOf = (
  now: ISongSoundNow,
  eqById: ReadonlyMap<string, ISavedEqSummary>,
  t: Translate,
): { owner: 'song' | 'album'; name: string } | undefined => {
  if (!now.owner || !now.saved) {
    return undefined;
  }
  const eqName =
    now.eqId === undefined ? undefined : eqById.get(now.eqId)?.name;
  return {
    owner: now.owner,
    name: savedSoundName(
      {
        presetId: now.saved.presetId,
        ...(eqName === undefined ? {} : { eqName }),
      },
      t,
    ),
  };
};

/**
 * What Back goes back to while the song's or its album's sound does not play
 * as kept: changed by hand, or astray. Nothing while it plays as kept.
 *
 * Astray: "Album · K-pop" said the album's sound played while K-pop did
 * (Ivan, 2026-11-20) — the session held what landed as the album's sound,
 * and what landed was his own. A sound is called the album's or the song's
 * only while the session's saved sound is the one kept; otherwise Back asks
 * for the kept one afresh, since going back to the session's copy would go
 * back to the wrong sound.
 */
export const backToSaved = (
  now: ISongSoundNow,
  eqById: ReadonlyMap<string, ISavedEqSummary>,
  t: Translate,
  /** The preset kept for the saved sound (`storedPresetOf`). */
  stored: string | undefined,
): ISongCardSound['back'] => {
  if (
    now.owner !== undefined &&
    stored !== undefined &&
    now.saved !== undefined &&
    now.saved.presetId !== stored
  ) {
    return {
      owner: now.owner,
      name: savedSoundName({ presetId: stored }, t),
      isAstray: true,
    };
  }
  return now.isChanged ? savedSoundOf(now, eqById, t) : undefined;
};

/**
 * A preset by the name the picker gives it, None included: the card and the
 * panel say what plays, and None plays as much as any preset does.
 */
export const playingPresetName = (presetId: string, t: Translate): string =>
  presetId === 'none'
    ? t('dsp.preset.none')
    : (songSoundPresetName(presetId, t) ?? t('songSound.noPresetName'));

/** Back to the saved sound `backToSaved` named. */
export const goBackToSaved = (
  back: NonNullable<ISongCardSound['back']>,
): void => {
  if (back.isAstray) {
    // Asked for again as a pick, which plays over whatever plays now.
    songSoundPicked(() => true);
    return;
  }
  revertSongSound();
};

/**
 * The words on the player's song card (Ivan, 2026-11-20: "also show the
 * preset playing on the song card too"), in exactly three states (Ivan,
 * 2026-11-21: "we need to simplify and make sure no crazy weird things
 * happen"): "Song · Warm" while the song's own sound plays, "Album · Pop"
 * while its album's does, "Changed · K-pop" while one of them was changed by
 * hand. Anything else — the listener's own sound, a saved EQ, None, nothing
 * saved — is no tag: a saved EQ's name is on its key beside Clear and the
 * preset on the titlebar's plate. The preset named is always the one that
 * plays (`live`, read the way the plate reads it), never a remembered id.
 */
export const songCardSound = (
  now: ISongSoundNow,
  live: ISongSound | undefined,
  eqById: ReadonlyMap<string, ISavedEqSummary>,
  t: Translate,
  /** The preset kept for the saved sound (`storedPresetOf`). */
  stored?: string,
): ISongCardSound | undefined => {
  if (!live || !now.owner) {
    return undefined;
  }
  const preset = playingPresetName(live.presetId, t);
  const back = backToSaved(now, eqById, t, stored);
  if (now.isChanged || back?.isAstray) {
    return {
      kind: 'changed',
      text: t('library.sound.tagChanged', { preset }),
      ...(back ? { back } : {}),
    };
  }
  return now.owner === 'song'
    ? { kind: 'song', text: t('autoEq.chip.song', { preset }) }
    : { kind: 'album', text: t('library.sound.tagAlbum', { preset }) };
};
