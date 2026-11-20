/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * "Remember each song's sound" kept a store per output (`song-sound.json`
 * version 1); Auto EQ keeps one for every output, in two worlds (version 2).
 * The move has to lose no song's sound, and it is tested the way it happens:
 * a version-1 file on disk as the old app wrote it — by its own filing
 * function, in both of the eras it wrote — read by the holder main creates at
 * launch, then asked through the channels the window uses. Nothing here
 * builds a version-2 store by hand.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import log from 'electron-log';
import ChannelEnum from '../../../common/channels';
import { FilterTypeEnum, getDefaultState } from '../../../common/constants';
import {
  buildSongIdentity,
  libraryTrackIdentity,
  type ISongIdentity,
} from '../../../common/songIdentity';
import {
  emptySongMemory,
  putSongMemory,
  type ISongMemoryEntryBase,
  type ISongMemorySettings,
} from '../../../common/songMemory';
import type { ISongSound } from '../../../common/songSound';
import { SONG_SOUND_MAX_ENTRIES } from '../../../common/songSoundMemory';
import { flushPendingWrites } from '../../../main/asyncWriter';
import { storedSongIdentity } from '../../../main/songMemoryNames';
import { createSongSoundHolder } from '../../../main/songSoundHolder';
import { loadSongSoundSettings } from '../../../main/songSoundStore';
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

// What the old app played. The Library named a track by its id
// (`buildSongIdentity('library', track.id, …)`), which is the key the
// Library's identity has today.
const kindOfBlue = {
  id: 'track-1',
  title: 'Blue in Green',
  artist: 'Miles',
  album: 'Kind of Blue',
  albumArtist: 'Miles',
  kind: 'audio' as const,
};
const soWhat = { ...kindOfBlue, id: 'track-2', title: 'So What' };
const oldLibrary = (track: typeof kindOfBlue) =>
  mustBe(buildSongIdentity('library', track.id, track.title, track.artist));
const onSpotify = mustBe(
  buildSongIdentity('system', 'Spotify.exe', 'Blue in Green', 'Miles'),
);
/** The same song on another player, which the old alias matched to any copy. */
const onYouTubeMusic = mustBe(
  buildSongIdentity('system', 'chrome.exe', 'Blue in Green', 'Miles'),
);
const karaoke = mustBe(
  buildSongIdentity('karaoke', 'D:/Karaoke/warm-up.cdg', 'Warm-up'),
);

const headphoneSound = soundOf('music', 2);
const speakerSound = soundOf('cinema', -3);
const spotifySound = soundOf('game', 5);
const soWhatSound = soundOf('vocal', 1);
const karaokeSound = soundOf('none', -1);

interface ILegacyEntry extends ISongMemoryEntryBase {
  sound: ISongSound;
}

/** The old `saveSongSound`, as it stood until Auto EQ: a play counted per
 * save, one store per output. */
const oldSave = (
  settings: ISongMemorySettings<ILegacyEntry>,
  deviceId: string,
  identity: ISongIdentity,
  sound: ISongSound,
  now: number,
) =>
  putSongMemory(
    settings,
    deviceId,
    identity,
    (existing) => ({
      sound,
      title: identity.title,
      artist: identity.artist,
      alias: identity.alias,
      plays: (existing?.plays ?? 0) + 1,
      updatedAt: now,
    }),
    2000,
  );

/**
 * A version-1 file as the old app left it. Until 2026-10-26 songs were filed
 * by name; after, by fingerprint (`storedSongIdentity`).
 */
const writtenByOldApp = (era: 'by name' | 'by fingerprint') => {
  const filed = (identity: ISongIdentity) =>
    era === 'by name' ? identity : storedSongIdentity(identity);
  let settings = emptySongMemory<ILegacyEntry>();
  const play = (
    deviceId: string,
    identity: ISongIdentity,
    sound: ISongSound,
    times: number,
    from: number,
  ) => {
    for (let index = 0; index < times; index += 1) {
      settings = oldSave(
        settings,
        deviceId,
        filed(identity),
        sound,
        from + index,
      );
    }
  };
  // The same Library song on both outputs: the speakers' save is the newer.
  play('headphones', oldLibrary(kindOfBlue), headphoneSound, 3, 100);
  play('speakers', oldLibrary(kindOfBlue), speakerSound, 2, 200);
  play('speakers', onSpotify, spotifySound, 1, 150);
  play('headphones', oldLibrary(soWhat), soWhatSound, 1, 50);
  play('headphones', karaoke, karaokeSound, 4, 60);
  return settings;
};

/** A song whose sound a hand edit broke: one band that does not read. */
const BROKEN_KEY = 'f'.repeat(40);
const withBrokenEntry = (settings: ISongMemorySettings<ILegacyEntry>) => ({
  ...settings,
  outputs: {
    ...settings.outputs,
    headphones: {
      ...settings.outputs.headphones,
      entries: {
        ...settings.outputs.headphones.entries,
        [BROKEN_KEY]: {
          sound: { presetId: 'music', filters: { band: { gain: 'loud' } } },
          title: '',
          plays: 1,
          updatedAt: 70,
        },
      },
    },
  },
});

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
  const ask = async (channel: ChannelEnum, args: unknown[]) => {
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
    expect(payload.errorCode).toBeUndefined();
    return payload.result;
  };
  return { ask, notify };
};

const stored = (dir: string) =>
  JSON.parse(fs.readFileSync(fileIn(dir), 'utf8')) as {
    version: number;
    outputs?: unknown;
    songs: {
      entries: Record<
        string,
        { scope: string; plays: number; updatedAt: number; title: string }
      >;
    };
    albums: Record<string, { sound: unknown }>;
    eqs?: Array<{ id: string; name: string; sound: unknown }>;
  };

describe.each(['by name', 'by fingerprint'] as const)(
  'a version-1 song sounds file written %s',
  (era) => {
    let dir: string;
    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-song-migrate-'));
      fs.writeFileSync(
        fileIn(dir),
        JSON.stringify(withBrokenEntry(writtenByOldApp(era))),
        'utf8',
      );
    });
    afterEach(async () => {
      await flushPendingWrites();
      jest.restoreAllMocks();
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('is moved at launch into one store for every output, written again once, naming nobody else’s song', async () => {
      const warn = jest.spyOn(log, 'warn');
      await launch(dir);

      const text = fs.readFileSync(fileIn(dir), 'utf8');
      const file = stored(dir);
      // Straight to the newest version: no saved EQs yet, nothing else lost.
      expect(file.version).toBe(3);
      expect(file.outputs).toBeUndefined();
      expect(file.albums).toEqual({});
      expect(file.eqs).toEqual([]);
      // Three songs and the karaoke song; the broken one is left out.
      expect(Object.keys(file.songs.entries)).toHaveLength(4);
      expect(text).not.toMatch(/spotify|chrome/i);
      // The broken entry is counted in the log and named nowhere.
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('1 entries in song-sound.json');
    });

    it('plays every Library song’s sound again, the newest of two outputs, with every play counted', async () => {
      const { ask } = await launch(dir);

      expect(
        await ask(ChannelEnum.LOOKUP_SONG_SOUND, [
          libraryTrackIdentity(kindOfBlue),
        ]),
      ).toEqual({ song: speakerSound });
      expect(
        await ask(ChannelEnum.LOOKUP_SONG_SOUND, [
          libraryTrackIdentity(soWhat),
        ]),
      ).toEqual({ song: soWhatSound });
      expect(await ask(ChannelEnum.LOOKUP_SONG_SOUND, [karaoke])).toEqual({
        song: karaokeSound,
      });

      const entries = Object.values(stored(dir).songs.entries);
      expect(entries).toContainEqual(
        expect.objectContaining({
          scope: 'library',
          title: 'Blue in Green',
          plays: 5,
          updatedAt: 201,
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          scope: 'library',
          title: 'Warm-up',
          plays: 4,
        }),
      );
    });

    it('keeps another player’s song in its own world: found from any player, never from the Library', async () => {
      const { ask } = await launch(dir);

      expect(await ask(ChannelEnum.LOOKUP_SONG_SOUND, [onSpotify])).toEqual({
        song: spotifySound,
      });
      // The same song on another player still finds the other players' copy...
      expect(
        await ask(ChannelEnum.LOOKUP_SONG_SOUND, [onYouTubeMusic]),
      ).toEqual({ song: spotifySound });
      // ...and the Library's file never plays it, nor it the Library's.
      expect(
        await ask(ChannelEnum.LOOKUP_SONG_SOUND, [
          libraryTrackIdentity(kindOfBlue),
        ]),
      ).toEqual({ song: speakerSound });
      expect(Object.values(stored(dir).songs.entries)).toContainEqual(
        expect.objectContaining({ scope: 'other', title: '', plays: 1 }),
      );
    });

    it('gives the Library its rows: named as a song plays, or when the Library hands its track ids over', async () => {
      const { ask } = await launch(dir);
      const before = (await ask(ChannelEnum.GET_SONG_SOUND_INDEX, [])) as {
        songs: Array<{ trackId: string }>;
        otherCount: number;
        hasUnnamed: boolean;
      };
      // Moved songs carry no track id: the fingerprint cannot be read back.
      expect(before.songs).toEqual([]);
      expect(before.otherCount).toBe(1);
      expect(before.hasUnnamed).toBe(true);

      await ask(ChannelEnum.LOOKUP_SONG_SOUND, [
        libraryTrackIdentity(kindOfBlue),
      ]);
      await ask(ChannelEnum.NAME_LIBRARY_SONG_SOUNDS, [['track-2', 'track-9']]);

      const after = (await ask(ChannelEnum.GET_SONG_SOUND_INDEX, [])) as {
        songs: Array<{ trackId: string; presetId: string; isWhole: boolean }>;
      };
      expect(
        after.songs
          .map(({ trackId, presetId, isWhole }) => ({
            trackId,
            presetId,
            isWhole,
          }))
          .sort((a, b) => a.trackId.localeCompare(b.trackId)),
      ).toEqual([
        { trackId: 'track-1', presetId: 'cinema', isWhole: true },
        { trackId: 'track-2', presetId: 'vocal', isWhole: true },
      ]);
    });

    it('keeps the plays it moved over through a save, and is never moved twice', async () => {
      const { ask } = await launch(dir);
      await ask(ChannelEnum.SAVE_SONG_SOUND, [
        libraryTrackIdentity(kindOfBlue),
        headphoneSound,
      ]);
      await flushPendingWrites();
      const afterSave = fs.readFileSync(fileIn(dir), 'utf8');
      // A save is a press, never a play: the five counted before stay five.
      expect(Object.values(stored(dir).songs.entries)).toContainEqual(
        expect.objectContaining({ title: 'Blue in Green', plays: 5 }),
      );
      expect(
        await ask(ChannelEnum.LOOKUP_SONG_SOUND, [
          libraryTrackIdentity(kindOfBlue),
        ]),
      ).toEqual({ song: headphoneSound });

      // The next launch reads version 3 as it is: nothing written, nothing told.
      const next = await launch(dir);
      expect(fs.readFileSync(fileIn(dir), 'utf8')).toBe(afterSave);
      expect(next.notify).not.toHaveBeenCalled();
      expect(
        await next.ask(ChannelEnum.LOOKUP_SONG_SOUND, [onSpotify]),
      ).toEqual({ song: spotifySound });
    });
  },
);

describe('a version-1 file fuller than the new store', () => {
  it('keeps the newest songs up to the ceiling, the oldest left out first', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-song-migrate-'));
    // Three outputs filled past the old per-output ceiling's worth, as
    // fingerprinted keys, one more song than the new store holds.
    const total = SONG_SOUND_MAX_ENTRIES + 1;
    const outputs: Record<
      string,
      { entries: Record<string, unknown>; aliases: Record<string, string> }
    > = {
      a: { entries: {}, aliases: {} },
      b: { entries: {}, aliases: {} },
      c: { entries: {}, aliases: {} },
    };
    const keyOf = (index: number) => index.toString(16).padStart(40, '0');
    for (let index = 0; index < total; index += 1) {
      outputs[['a', 'b', 'c'][index % 3]].entries[keyOf(index)] = {
        sound: soundOf('music', 0),
        title: '',
        plays: 1,
        updatedAt: index + 1,
      };
    }
    fs.writeFileSync(
      fileIn(dir),
      JSON.stringify({ version: 1, outputs }),
      'utf8',
    );

    const settings = loadSongSoundSettings(dir);
    await flushPendingWrites();

    expect(Object.keys(settings.songs.entries)).toHaveLength(
      SONG_SOUND_MAX_ENTRIES,
    );
    expect(settings.songs.entries[keyOf(0)]).toBeUndefined();
    expect(settings.songs.entries[keyOf(total - 1)]).toBeDefined();
    expect(Object.keys(stored(dir).songs.entries)).toHaveLength(
      SONG_SOUND_MAX_ENTRIES,
    );
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
