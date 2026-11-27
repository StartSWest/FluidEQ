/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { FilterTypeEnum } from 'common/constants';
import {
  SAVED_EQ_MAX,
  playsSavedEq,
  toSavedEq,
  uniqueSavedEqName,
} from 'common/savedEq';
import {
  addSavedEq,
  deleteSavedEq,
  renameSavedEq,
  updateSavedEq,
} from 'common/savedEqStore';
import { buildSongIdentity, ISongIdentity } from 'common/songIdentity';
import type { ISongSound } from 'common/songSound';
import {
  getDefaultSongSoundSettings,
  lookupSongSound,
  resolveStoredSound,
  saveSongSound,
  setAlbumSound,
  songSoundIndex,
} from 'common/songSoundMemory';
import {
  getInitialSongSoundState,
  ISongSoundState,
  reduceSongSound,
} from 'common/songSoundRecorder';
import { isSongSoundChanged } from 'common/songSoundChoices';

// Saved EQs (Ivan, 2026-11-20: "if user has a nice EQ I want them to save it
// in Auto EQ"): what one keeps, how songs follow one, and what putting one on
// does to a song playing its saved sound.

const sound = (presetId: string, gain: number): ISongSound => ({
  presetId,
  filters: {
    band: {
      id: 'band',
      frequency: 1000,
      gain,
      quality: 1,
      type: FilterTypeEnum.PK,
    },
  },
});
const song = (key: string): ISongIdentity => {
  const identity = buildSongIdentity('library', key, `Song ${key}`, 'Artist');
  if (!identity) {
    throw new Error('the fixture names no song');
  }
  return identity;
};

const withEq = (name = 'Night', saved = sound('music', 4)) => {
  const added = addSavedEq(
    getDefaultSongSoundSettings(),
    'eq-1',
    name,
    saved,
    10,
  );
  if (!added) {
    throw new Error('the fixture saved nothing');
  }
  return added;
};

describe('what a saved EQ is', () => {
  it('numbers a name another one has, without case, from its stem', () => {
    expect(uniqueSavedEqName('Night', ['night'])).toBe('Night (2)');
    expect(uniqueSavedEqName('Night (2)', ['Night', 'Night (2)'])).toBe(
      'Night (3)',
    );
    expect(uniqueSavedEqName('  Day  ', ['Night'])).toBe('Day');
  });

  it('reads back whole or not at all', () => {
    const { eq } = withEq();
    expect(toSavedEq(JSON.parse(JSON.stringify(eq)))).toEqual(eq);
    expect(toSavedEq({ ...eq, id: 'not-an-eq' })).toBeUndefined();
    expect(toSavedEq({ ...eq, name: '   ' })).toBeUndefined();
    expect(
      toSavedEq({ ...eq, sound: { presetId: 'music', filters: { b: {} } } }),
    ).toBeUndefined();
  });

  it('plays when the bands, Tone and preset do; one saved without its preset plays over any', () => {
    const { eq } = withEq();
    expect(playsSavedEq(sound('music', 4), eq)).toBe(true);
    expect(playsSavedEq(sound('rock', 4), eq)).toBe(false);
    expect(playsSavedEq(sound('music', 3), eq)).toBe(false);
    const anyPreset = { ...eq, sound: { ...eq.sound, presetId: '' } };
    expect(playsSavedEq(sound('rock', 4), anyPreset)).toBe(true);
    expect(playsSavedEq(sound('rock', 3), anyPreset)).toBe(false);
  });

  it('is refused past the list’s size, for an empty name, or for an id taken', () => {
    let settings = getDefaultSongSoundSettings();
    for (let index = 0; index < SAVED_EQ_MAX; index += 1) {
      settings =
        addSavedEq(settings, `eq-${index}`, 'EQ', sound('music', 0), index)
          ?.settings ?? settings;
    }
    expect(settings.eqs).toHaveLength(SAVED_EQ_MAX);
    expect(
      addSavedEq(settings, 'eq-more', 'EQ', sound('music', 0), 1),
    ).toBeUndefined();
    const { settings: one } = withEq();
    expect(addSavedEq(one, 'eq-2', '  ', sound('music', 0), 1)).toBeUndefined();
    expect(
      addSavedEq(one, 'eq-1', 'Day', sound('music', 0), 1),
    ).toBeUndefined();
  });
});

describe('songs and albums that follow a saved EQ', () => {
  const linked = () => {
    const { settings, eq } = withEq();
    let next = saveSongSound(
      settings,
      song('a'),
      'library',
      { eqId: eq.id },
      20,
      { trackId: 'a' },
    );
    next = setAlbumSound(next, 'album', {
      title: 'Album',
      artist: 'Artist',
      sound: { eqId: eq.id },
      updatedAt: 30,
    });
    return { settings: next, eq };
  };

  it('play its sound as it is now, and are counted and named in the index', () => {
    const { settings, eq } = linked();
    const updated = updateSavedEq(settings, eq.id, sound('music', -5), 40);
    if (!updated) {
      throw new Error('the update was refused');
    }
    const entry = lookupSongSound(updated, song('a'), 'library');
    expect(entry && resolveStoredSound(updated, entry.sound)).toEqual(
      sound('music', -5),
    );
    const index = songSoundIndex(updated);
    expect(index.songs).toEqual([
      expect.objectContaining({ trackId: 'a', eqId: eq.id, isWhole: true }),
    ]);
    expect(index.albums).toEqual([
      expect.objectContaining({ key: 'album', eqId: eq.id }),
    ]);
    expect(index.eqs).toEqual([
      expect.objectContaining({ id: eq.id, songCount: 1, albumCount: 1 }),
    ]);
  });

  it('keep the sound they had as their own when it is deleted, their save times untouched', () => {
    const { settings, eq } = linked();
    const deleted = deleteSavedEq(settings, eq.id);
    const entry = lookupSongSound(deleted, song('a'), 'library');
    expect(entry?.sound).toEqual(eq.sound);
    expect(entry?.updatedAt).toBe(20);
    expect(deleted.albums.album.sound).toEqual(eq.sound);
    expect(deleted.eqs).toEqual([]);
    // Deleting one that is gone changes nothing.
    expect(deleteSavedEq(deleted, eq.id)).toBe(deleted);
  });

  it('take a rename numbered against the others, never against itself', () => {
    const { settings, eq } = withEq('Night');
    const two = addSavedEq(settings, 'eq-2', 'Day', sound('music', 0), 20);
    if (!two) {
      throw new Error('the fixture saved nothing');
    }
    expect(renameSavedEq(two.settings, eq.id, 'night')?.eqs[0].name).toBe(
      'night',
    );
    expect(renameSavedEq(two.settings, 'eq-2', 'NIGHT')?.eqs[1].name).toBe(
      'NIGHT (2)',
    );
    expect(renameSavedEq(two.settings, 'eq-2', ' ')).toBeUndefined();
    expect(renameSavedEq(two.settings, 'eq-gone', 'X')).toBeUndefined();
  });
});

describe('putting a saved EQ on while a song plays', () => {
  const original = sound('none', 0);
  const remembered = sound('cinema', 3);
  const saved = sound('music', 4);
  const playingItsOwn = () => {
    let state: ISongSoundState = {
      ...getInitialSongSoundState({ songs: true, albums: true }),
      deviceId: 'main',
      live: original,
    };
    const step = (event: Parameters<typeof reduceSongSound>[1]) => {
      const [next, effects] = reduceSongSound(state, event, 1000);
      state = next;
      return effects;
    };
    step({ kind: 'nowPlaying', identity: song('a'), isPlaying: true });
    step({ kind: 'matched', identity: song('a'), song: remembered });
    step({ kind: 'applied', asked: remembered, landed: remembered });
    return { step, read: () => state };
  };

  it('is lent over a saved song’s sound, and reads as that sound changed', () => {
    const { step, read } = playingItsOwn();
    const effects = step({ kind: 'putOn', sound: saved });
    expect(effects).toEqual([{ kind: 'apply', sound: saved, isLent: true }]);
    // A change to the song's sound, never the listener's own: the song still
    // hands back what played before it (Ivan, 2026-11-26: "Picking a preset
    // never overwrites the listener's main EQ").
    expect(read().session?.handBack).toEqual(original);
    step({ kind: 'applied', asked: saved, landed: saved });
    expect(read().session?.baseline).toEqual(remembered);
    expect(isSongSoundChanged(read())).toBe(true);
  });

  it('is simply the listener’s own sound when nothing saved plays', () => {
    let state: ISongSoundState = {
      ...getInitialSongSoundState({ songs: true, albums: true }),
      deviceId: 'main',
      live: original,
    };
    [state] = reduceSongSound(
      state,
      { kind: 'nowPlaying', identity: song('b'), isPlaying: true },
      0,
    );
    [state] = reduceSongSound(
      state,
      { kind: 'matched', identity: song('b') },
      1,
    );
    const [, effects] = reduceSongSound(
      state,
      { kind: 'putOn', sound: saved },
      2,
    );
    expect(effects).toEqual([{ kind: 'apply', sound: saved, isLent: false }]);
  });

  it('a saved EQ updated with what plays is the song’s saved sound again, with nothing put on and no notice', () => {
    const { step, read } = playingItsOwn();
    step({ kind: 'putOn', sound: saved });
    step({ kind: 'applied', asked: saved, landed: saved });
    step({ kind: 'soundChanged', sound: saved });
    // Main answers the song with the EQ it follows, now holding what plays.
    const effects = step({ kind: 'matched', identity: song('a'), song: saved });
    expect(effects).toEqual([]);
    expect(read().session?.baseline).toEqual(saved);
    expect(isSongSoundChanged(read())).toBe(false);
    // Put on while the song plays, it was the song's change, never the
    // listener's own: the song's end hands back the sound from before.
    expect(read().session?.handBack).toEqual(original);
  });
});
