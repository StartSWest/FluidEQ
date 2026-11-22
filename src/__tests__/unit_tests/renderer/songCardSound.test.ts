/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Translate } from 'common/i18n';
import { FilterTypeEnum } from 'common/constants';
import { buildSongIdentity } from 'common/songIdentity';
import type { ISongSound } from 'common/songSound';
import type { ISongSoundNow } from '../../../renderer/audio/songSoundSession';
import {
  backToSaved,
  songCardSound,
  storedPresetOf,
} from '../../../renderer/audio/songCardSound';

// The song's card calls a sound the album's only while the album's own preset
// is the saved sound the session holds (Ivan, 2026-11-20: "Album · K-pop"
// over an album set to Ballad, "kpop? what the heck").

const t = ((key: string, vars?: Record<string, unknown>) =>
  vars ? `${key} ${JSON.stringify(vars)}` : key) as Translate;
const sound = (presetId: string): ISongSound => ({
  presetId,
  filters: {
    b: {
      id: 'b',
      frequency: 1000,
      gain: 0,
      quality: 1,
      type: FilterTypeEnum.PK,
    },
  },
});
const identity = (() => {
  const made = buildSongIdentity('library', 't1', 'En un sábado', 'Silvana');
  if (!made) {
    throw new Error('the fixture names no song');
  }
  return { ...made, albumKey: 'exitos\u001fsilvana di lorenzo' };
})();
const index = {
  songs: new Map(),
  albums: new Map([
    [
      identity.albumKey,
      {
        key: identity.albumKey,
        title: 'Exitos',
        artist: 'Silvana',
        presetId: 'ballad',
        isWhole: false,
      },
    ],
  ]),
};
const onAlbum = (held: string): ISongSoundNow => ({
  identity,
  isPlaying: true,
  owner: 'album',
  presetId: held,
  saved: sound(held),
  canSave: false,
  isChanged: false,
});

describe('the song’s card: whose sound plays', () => {
  it('reads the album’s preset as kept', () => {
    expect(storedPresetOf(onAlbum('ballad'), index)).toBe('ballad');
  });

  it('calls a sound the album’s while the album’s own preset is the one held', () => {
    const now = onAlbum('ballad');
    const card = songCardSound(
      now,
      sound('ballad'),
      {},
      new Map(),
      t,
      'ballad',
    );
    expect(card?.kind).toBe('album');
    expect(backToSaved(now, new Map(), t, 'ballad')).toBeUndefined();
  });

  it('calls K-pop held as the album’s a change, and goes back by asking afresh', () => {
    const now = onAlbum('kPop');
    const card = songCardSound(now, sound('kPop'), {}, new Map(), t, 'ballad');
    expect(card?.kind).toBe('changed');
    expect(card?.back).toMatchObject({ owner: 'album', isAstray: true });
  });
});
