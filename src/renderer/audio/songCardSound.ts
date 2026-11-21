/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Translate } from 'common/i18n';
import type { ISavedEqSummary } from 'common/songSoundMemory';
import type { ISongSound } from 'common/songSound';
import type { ISongSoundNow } from './songSoundSession';
import type { ISavedEqStates } from './savedEqActions';
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
   * to it (`revertSongSound`). */
  back?: { owner: 'song' | 'album'; name: string };
}

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
): ISongCardSound | undefined => {
  if (!live) {
    return undefined;
  }
  if (now.isChanged) {
    const preset =
      songSoundPresetName(live.presetId, t) ?? t('songSound.noPresetName');
    const back = savedSoundOf(now, eqById, t);
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
