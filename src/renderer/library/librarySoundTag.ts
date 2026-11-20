/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Translate } from 'common/i18n';
import type { ILibraryTrack } from 'common/library/types';
import { albumKey } from 'common/library/grouping';
import type { ISongSoundIndexView } from '../audio/songSoundIndex';
import songSoundPresetName from '../components/songSoundPresetName';

/** Where a Library song's sound comes from, when anything is set for it. */
export interface ILibrarySoundTag {
  kind: 'own' | 'album';
  presetId: string;
  /** The saved EQ it follows, by name: the whole sound, preset and all. */
  eqName?: string;
}

/**
 * What a kept sound is called wherever the Library and Auto EQ name one: the
 * saved EQ it follows, or its preset.
 */
export const savedSoundName = (
  sound: { presetId: string; eqName?: string },
  t: Translate,
): string =>
  sound.eqName ??
  songSoundPresetName(sound.presetId, t) ??
  t('songSound.noPresetName');

/** A saved EQ's name from the index, for a sound that follows one. */
export const eqNameOf = (
  index: Pick<ISongSoundIndexView, 'eqById'>,
  eqId: string | undefined,
): string | undefined =>
  eqId === undefined ? undefined : index.eqById.get(eqId)?.name;

/**
 * The row's Sound column (Auto EQ): the song's own sound, or its album's, as
 * the Library would play them — a song's own first. Nothing for a song that
 * plays the listener's own sound, which is most of a library and would be the
 * same word on every row.
 */
const librarySoundTag = (
  track: Pick<ILibraryTrack, 'id' | 'album' | 'albumArtist' | 'artist'>,
  index: ISongSoundIndexView,
): ILibrarySoundTag | undefined => {
  const own = index.songs.get(track.id);
  const owned =
    own ?? (track.album ? index.albums.get(albumKey(track)) : undefined);
  if (!owned) {
    return undefined;
  }
  const eqName = eqNameOf(index, owned.eqId);
  return {
    kind: own ? 'own' : 'album',
    presetId: owned.presetId,
    ...(eqName === undefined ? {} : { eqName }),
  };
};

export default librarySoundTag;
