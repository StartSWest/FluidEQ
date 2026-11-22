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

// The song's card in exactly three states (Ivan, 2026-11-21: "we need to
// simplify and make sure no crazy weird things happen"): the song's own
// sound, the album's, or one of them changed by hand — nothing otherwise —
// and it names what plays, never a remembered id ("Album · K-pop" over an
// album set to Ballad, 2026-11-20: "kpop? what the heck").

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
  songs: new Map([
    [
      't1',
      {
        trackId: 't1',
        title: 'En un sábado',
        presetId: 'warm',
        isWhole: false,
        updatedAt: 1,
      },
    ],
  ]),
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
const playing = (
  owner: 'song' | 'album' | undefined,
  held: string,
  over: Partial<ISongSoundNow> = {},
): ISongSoundNow => ({
  identity,
  isPlaying: true,
  ...(owner ? { owner, saved: sound(held) } : {}),
  presetId: held,
  canSave: false,
  isChanged: false,
  ...over,
});
const card = (now: ISongSoundNow, live: string) =>
  songCardSound(now, sound(live), new Map(), t, storedPresetOf(now, index));

describe('the song’s card: whose sound plays', () => {
  it('reads the preset kept for the song’s sound and the album’s', () => {
    expect(storedPresetOf(playing('song', 'warm'), index)).toBe('warm');
    expect(storedPresetOf(playing('album', 'ballad'), index)).toBe('ballad');
  });

  it('says Song while the song’s own sound plays', () => {
    const result = card(playing('song', 'warm'), 'warm');
    expect(result?.kind).toBe('song');
    expect(result?.text.startsWith('autoEq.chip.song')).toBe(true);
    expect(result?.back).toBeUndefined();
  });

  it('says Album while the album’s own sound plays', () => {
    const now = playing('album', 'ballad');
    expect(card(now, 'ballad')?.kind).toBe('album');
    expect(backToSaved(now, new Map(), t, 'ballad')).toBeUndefined();
  });

  it('says Changed, with Restore, over a change made by hand', () => {
    const now = playing('album', 'ballad', {
      isChanged: true,
      presetId: 'kPop',
    });
    const result = card(now, 'kPop');
    expect(result?.kind).toBe('changed');
    expect(result?.back).toMatchObject({ owner: 'album' });
    expect(result?.back?.isAstray).toBeUndefined();
  });

  it('never says Album when the album’s sound did not land: K-pop held as the album’s is a change', () => {
    const now = playing('album', 'kPop');
    const result = card(now, 'kPop');
    expect(result?.kind).toBe('changed');
    expect(result?.back).toMatchObject({ owner: 'album', isAstray: true });
  });

  it('shows nothing for the listener’s own sound, None or a saved EQ of theirs', () => {
    expect(card(playing(undefined, 'kPop'), 'kPop')).toBeUndefined();
    expect(card(playing(undefined, 'none'), 'none')).toBeUndefined();
    expect(
      card(playing(undefined, 'pop', { eqId: 'eq-1' }), 'pop'),
    ).toBeUndefined();
  });
});
