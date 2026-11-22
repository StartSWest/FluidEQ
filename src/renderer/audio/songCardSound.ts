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
import type { ISavedEqStates } from './savedEqActions';
import type { ISongSoundIndexView } from './songSoundIndex';
import { savedSoundName } from '../library/librarySoundTag';
import songSoundPresetName from '../components/songSoundPresetName';

/**
 * Whose sound the playing song plays, as its card on the player says it:
 * the song's own, its album's, one of them changed and not saved, or the
 * listener's own — `kind` picks the ink the Library's Sound column uses.
 */
export interface ISongCardSound {
  kind: 'own' | 'album' | 'changed' | 'yours';
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
 * preset playing on the song card too"), in the Library's own words —
 * "Own · Warm", "Album · Pop" — so the card and the row say the same thing.
 * A saved sound that follows a saved EQ is named by the EQ, as everywhere
 * else; over the listener's own sound, the saved EQ that plays exactly, or
 * the preset. Nothing while the window has not yet heard what plays.
 */
export const songCardSound = (
  now: ISongSoundNow,
  live: ISongSound | undefined,
  states: ISavedEqStates,
  eqById: ReadonlyMap<string, ISavedEqSummary>,
  t: Translate,
  /** The preset kept for the saved sound (`storedPresetOf`). */
  stored?: string,
): ISongCardSound | undefined => {
  if (!live) {
    return undefined;
  }
  const back = backToSaved(now, eqById, t, stored);
  if (now.isChanged || back?.isAstray) {
    const preset =
      songSoundPresetName(live.presetId, t) ?? t('songSound.noPresetName');
    return {
      kind: 'changed',
      text: t('library.sound.tagChanged', { preset }),
      ...(back ? { back } : {}),
    };
  }
  if (now.owner) {
    const eqName =
      now.eqId === undefined ? undefined : eqById.get(now.eqId)?.name;
    const preset = savedSoundName(
      {
        presetId: now.presetId ?? live.presetId,
        ...(eqName === undefined ? {} : { eqName }),
      },
      t,
    );
    return now.owner === 'song'
      ? { kind: 'own', text: t('library.sound.tagOwn', { preset }) }
      : { kind: 'album', text: t('library.sound.tagAlbum', { preset }) };
  }
  const playing =
    states.playingId === undefined ? undefined : eqById.get(states.playingId);
  return {
    kind: 'yours',
    text: savedSoundName(
      {
        presetId: live.presetId,
        ...(playing ? { eqName: playing.name } : {}),
      },
      t,
    ),
  };
};
