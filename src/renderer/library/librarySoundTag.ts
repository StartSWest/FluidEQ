/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ILibraryTrack } from 'common/library/types';
import { albumKey } from 'common/library/grouping';
import type { ISongSoundIndexView } from '../audio/songSoundIndex';

/** Where a Library song's sound comes from, when anything is set for it. */
export interface ILibrarySoundTag {
  kind: 'own' | 'album';
  presetId: string;
}

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
  if (own) {
    return { kind: 'own', presetId: own.presetId };
  }
  const album = track.album ? index.albums.get(albumKey(track)) : undefined;
  return album ? { kind: 'album', presetId: album.presetId } : undefined;
};

export default librarySoundTag;
