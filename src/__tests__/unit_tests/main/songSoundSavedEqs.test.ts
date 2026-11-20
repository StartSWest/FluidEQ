/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Saved EQs (2026-11-20) moved Auto EQ's store from version 2 to version 3.
 * The move has to lose nothing a listener kept, and the links songs and
 * albums keep to a saved EQ have to survive every launch after it. Tested the
 * way it happens: a file on disk as an earlier app wrote it — version 1 by
 * "Remember each song's sound", version 2 by Auto EQ's first store, each by
 * its own filing functions — read by the holder main creates at launch, then
 * driven through the channels the window uses, across relaunches.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import log from 'electron-log';
import ChannelEnum from '../../../common/channels';
import { FilterTypeEnum, getDefaultState } from '../../../common/constants';
import { albumKey } from '../../../common/library/grouping';
import {
  buildSongIdentity,
  libraryTrackIdentity,
  type ISongIdentity,
} from '../../../common/songIdentity';
import {
  emptySongMemory,
  putSongMemory,
  type ISongMemoryEntryBase,
} from '../../../common/songMemory';
import type { ISongSound } from '../../../common/songSound';
import {
  getDefaultSongSoundSettings,
  saveSongSound,
  setAlbumSound,
} from '../../../common/songSoundMemory';
import { ErrorCode } from '../../../common/errors';
import { flushPendingWrites } from '../../../main/asyncWriter';
import {
  storedSongIdentity,
  storedSoundIdentity,
} from '../../../main/songMemoryNames';
import { createSongSoundHolder } from '../../../main/songSoundHolder';
import registerSongSoundIpc from '../../../main/ipc/songSound';
import registerSongSoundLibraryIpc from '../../../main/ipc/songSoundLibrary';

type Handler = (
  event: { reply: jest.Mock },
  arg: unknown,
) => void | Promise<void>;
const handlers = new Map<string, Handler>();
jest.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, handler: Handler) => handlers.set(channel, handler),
  },
  app: { getPath: () => '' },
}));

const soundOf = (presetId: string, gain: number): ISongSound => ({
  presetId,
  tone: { bass: 2, mid: 0, treble: -1 },
  filters: {
    band: {
      id: 'band',
      frequency: 800,
      gain,
      quality: 1.2,
      type: FilterTypeEnum.PK,
    },
  },
});

const mustBe = (identity: ISongIdentity | undefined): ISongIdentity => {
  if (!identity) {
    throw new Error('test fixture produced no identity');
  }
  return identity;
};

const blueInGreen = {
  id: 'track-1',
  title: 'Blue in Green',
  artist: 'Miles',
  album: 'Kind of Blue',
  albumArtist: 'Miles',
  kind: 'audio' as const,
};
const soWhat = { ...blueInGreen, id: 'track-2', title: 'So What' };
const library = (track: typeof blueInGreen) =>
  mustBe(libraryTrackIdentity(track));
const onSpotify = mustBe(
  buildSongIdentity('system', 'Spotify.exe', 'Teardrop', 'Massive Attack'),
);
const kindOfBlue = albumKey(blueInGreen);

const speakers = soundOf('cinema', -3);
const spotify = soundOf('game', 5);
const lateNight = soundOf('music', 4);
const lateNightLater = soundOf('music', -6);

const fileIn = (dir: string) => path.join(dir, 'song-sound.json');

const launch = async (dir: string) => {
  handlers.clear();
  const notify = jest.fn();
  const holder = createSongSoundHolder(dir, notify);
  await holder.launchRead;
  await flushPendingWrites();
  registerSongSoundLibraryIpc(holder);
  registerSongSoundIpc({
    state: getDefaultState(),
    holder,
    getOutputEditor: () => undefined,
    handleUpdateHelper: jest.fn(async () => undefined),
  });
  const send = async (channel: ChannelEnum, args: unknown[]) => {
    const handler = handlers.get(channel);
    if (!handler) {
      throw new Error(`Missing ${channel}`);
    }
    const reply = jest.fn();
    await handler({ reply }, args);
    const [answered, payload] = reply.mock.calls[0] as [
      string,
      { result?: unknown; errorCode?: unknown },
    ];
    expect(answered).toBe(channel);
    return payload;
  };
  const ask = async (channel: ChannelEnum, args: unknown[]) => {
    const payload = await send(channel, args);
    expect(payload.errorCode).toBeUndefined();
    return payload.result;
  };
  return { ask, send, notify };
};

const readFile = (dir: string) =>
  JSON.parse(fs.readFileSync(fileIn(dir), 'utf8')) as {
    version: number;
    songs: { entries: Record<string, { sound: unknown; plays: number }> };
    albums: Record<string, { sound: unknown }>;
    eqs: Array<{ id: string; name: string; sound: unknown }>;
  };

interface ILegacyEntry extends ISongMemoryEntryBase {
  sound: ISongSound;
}

/** Version 1 as "Remember each song's sound" left it: a store per output,
 * filed by fingerprint, a play counted per save. */
const writtenByVersion1 = () => {
  let settings = emptySongMemory<ILegacyEntry>();
  const play = (
    deviceId: string,
    identity: ISongIdentity,
    sound: ISongSound,
  ) => {
    settings = putSongMemory(
      settings,
      deviceId,
      storedSongIdentity(identity),
      (existing) => ({
        sound,
        title: identity.title,
        artist: identity.artist,
        alias: identity.alias,
        plays: (existing?.plays ?? 0) + 1,
        updatedAt: 100,
      }),
      2000,
    );
  };
  play('speakers', library(blueInGreen), speakers);
  play('speakers', onSpotify, spotify);
  return settings;
};

/**
 * Version 2 as Auto EQ's first store wrote it: filed by its own filing
 * functions, which are today's, and written with its version number and no
 * saved EQs, which is all that version 3 added.
 */
const writtenByVersion2 = () => {
  let settings = getDefaultSongSoundSettings();
  settings = saveSongSound(
    settings,
    storedSoundIdentity(library(blueInGreen)),
    'library',
    speakers,
    100,
    { trackId: blueInGreen.id },
  );
  settings = saveSongSound(
    settings,
    storedSoundIdentity(onSpotify),
    'other',
    spotify,
    110,
  );
  settings = setAlbumSound(settings, kindOfBlue, {
    title: 'Kind of Blue',
    artist: 'Miles',
    sound: { presetId: 'vocal' },
    updatedAt: 120,
  });
  const { songs, albums } = settings;
  return { version: 2, songs, albums };
};

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-saved-eqs-'));
});
afterEach(async () => {
  await flushPendingWrites();
  jest.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('a version-2 song sounds file', () => {
  beforeEach(() => {
    fs.writeFileSync(fileIn(dir), JSON.stringify(writtenByVersion2()), 'utf8');
  });

  it('is read as version 3 with no saved EQs and written again once, every song and album as it was', async () => {
    const before = writtenByVersion2();
    await launch(dir);
    const file = readFile(dir);
    expect(file.version).toBe(3);
    expect(file.eqs).toEqual([]);
    expect(file.songs).toEqual(before.songs);
    expect(file.albums).toEqual(before.albums);

    // Read again, it is version 3 as it stands: nothing written, nothing told.
    const text = fs.readFileSync(fileIn(dir), 'utf8');
    const next = await launch(dir);
    expect(fs.readFileSync(fileIn(dir), 'utf8')).toBe(text);
    expect(next.notify).not.toHaveBeenCalled();
  });

  it('plays every sound it kept, in both worlds and for the album', async () => {
    const { ask } = await launch(dir);
    expect(
      await ask(ChannelEnum.LOOKUP_SONG_SOUND, [library(blueInGreen)]),
    ).toEqual({
      song: speakers,
      album: { sound: { presetId: 'vocal' }, title: 'Kind of Blue' },
    });
    expect(await ask(ChannelEnum.LOOKUP_SONG_SOUND, [onSpotify])).toEqual({
      song: spotify,
    });
  });
});

describe.each([
  ['version 1', writtenByVersion1],
  ['version 2', writtenByVersion2],
] as const)('saved EQs on a store moved from %s', (_, written) => {
  beforeEach(() => {
    fs.writeFileSync(fileIn(dir), JSON.stringify(written()), 'utf8');
  });

  it('are followed by songs and albums through an update and every relaunch, and a delete leaves each its sound', async () => {
    const first = await launch(dir);
    const saved = (await first.ask(ChannelEnum.SAVE_EQ, [
      'Late night',
      lateNight,
    ])) as { id: string; name: string };
    expect(saved.name).toBe('Late night');
    const link = { eqId: saved.id };
    await first.ask(ChannelEnum.PICK_LIBRARY_SONG_SOUNDS, [
      [library(soWhat)],
      link,
    ]);
    await first.ask(ChannelEnum.SET_ALBUM_SOUND, [
      kindOfBlue,
      'Kind of Blue',
      'Miles',
      link,
    ]);
    await first.ask(ChannelEnum.SAVE_SONG_SOUND, [onSpotify, link]);

    // Update: every song and the album play the new sound, still named.
    await first.ask(ChannelEnum.UPDATE_EQ, [saved.id, lateNightLater]);
    await flushPendingWrites();

    // The next launch reads it all back as it was left.
    const second = await launch(dir);
    expect(
      await second.ask(ChannelEnum.LOOKUP_SONG_SOUND, [library(soWhat)]),
    ).toEqual({
      song: lateNightLater,
      songEqId: saved.id,
      album: { sound: lateNightLater, title: 'Kind of Blue', eqId: saved.id },
    });
    expect(
      await second.ask(ChannelEnum.LOOKUP_SONG_SOUND, [onSpotify]),
    ).toEqual({ song: lateNightLater, songEqId: saved.id });
    const index = (await second.ask(ChannelEnum.GET_SONG_SOUND_INDEX, [])) as {
      eqs: Array<{ name: string; songCount: number; albumCount: number }>;
      songs: Array<{ trackId: string; eqId?: string }>;
    };
    expect(index.eqs).toEqual([
      expect.objectContaining({
        name: 'Late night',
        songCount: 2,
        albumCount: 1,
      }),
    ]);
    expect(index.songs).toContainEqual(
      expect.objectContaining({ trackId: soWhat.id, eqId: saved.id }),
    );
    // The file keeps links, not copies, while the EQ is there.
    expect(fs.readFileSync(fileIn(dir), 'utf8')).toContain(
      `"eqId":"${saved.id}"`,
    );

    // Delete: each keeps the sound it had, as its own, from this launch on.
    await second.ask(ChannelEnum.DELETE_EQ, [saved.id]);
    await flushPendingWrites();
    const third = await launch(dir);
    expect(
      await third.ask(ChannelEnum.LOOKUP_SONG_SOUND, [library(soWhat)]),
    ).toEqual({
      song: lateNightLater,
      album: { sound: lateNightLater, title: 'Kind of Blue' },
    });
    expect(await third.ask(ChannelEnum.LOOKUP_SONG_SOUND, [onSpotify])).toEqual(
      { song: lateNightLater },
    );
    const file = readFile(dir);
    expect(file.eqs).toEqual([]);
    expect(JSON.stringify(file)).not.toContain('eqId');
    // A song kept before the EQ existed is untouched by all of it.
    expect(
      await third.ask(ChannelEnum.LOOKUP_SONG_SOUND, [library(blueInGreen)]),
    ).toEqual(expect.objectContaining({ song: speakers }));
  });
});

describe('saved EQs as main keeps them', () => {
  it('numbers a name another saved EQ has, renames the same way, and turns a link to nothing away', async () => {
    const { ask, send } = await launch(dir);
    const one = (await ask(ChannelEnum.SAVE_EQ, ['Night', lateNight])) as {
      id: string;
      name: string;
    };
    const two = (await ask(ChannelEnum.SAVE_EQ, [' night ', lateNight])) as {
      id: string;
      name: string;
    };
    expect(two.name).toBe('night (2)');
    await ask(ChannelEnum.RENAME_EQ, [two.id, 'NIGHT']);
    const index = (await ask(ChannelEnum.GET_SONG_SOUND_INDEX, [])) as {
      eqs: Array<{ id: string; name: string }>;
    };
    expect(index.eqs.map((eq) => eq.name)).toEqual(['Night', 'NIGHT (2)']);
    expect(index.eqs[0].id).toBe(one.id);

    // A link to an EQ that is not kept would leave the song with no sound.
    const refused = await send(ChannelEnum.PICK_LIBRARY_SONG_SOUNDS, [
      [library(soWhat)],
      { eqId: 'eq-gone' },
    ]);
    expect(refused.errorCode).toBe(ErrorCode.INVALID_PARAMETER);
    const empty = await send(ChannelEnum.SAVE_EQ, ['   ', lateNight]);
    expect(empty.errorCode).toBe(ErrorCode.INVALID_PARAMETER);
  });

  it('drops, and counts, a song a hand edit linked to a saved EQ the file does not keep', async () => {
    const settings = saveSongSound(
      getDefaultSongSoundSettings(),
      storedSoundIdentity(library(soWhat)),
      'library',
      { eqId: 'eq-missing' },
      100,
      { trackId: soWhat.id },
    );
    fs.writeFileSync(fileIn(dir), JSON.stringify(settings), 'utf8');
    const warn = jest.spyOn(log, 'warn');
    const { ask } = await launch(dir);
    expect(await ask(ChannelEnum.LOOKUP_SONG_SOUND, [library(soWhat)])).toEqual(
      {},
    );
    expect(warn.mock.calls[0][0]).toContain('1 entries in song-sound.json');
    expect(readFile(dir).songs.entries).toEqual({});
  });
});
