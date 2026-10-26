/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the song memories may say about a song: a fingerprint to find it by,
 * and a name only for the listener's own files (Ivan, 2026-10-26). They kept
 * every song by name, so a video watched in a browser stood in a file in the
 * app's data folder for as long as the memory kept it.
 *
 * And the files written that way are converted, never thrown away: every
 * song keeps its settings under the fingerprint a new save of it is filed
 * under, an entry that is not one is left out with a line in the log that
 * names no song, and a file that is not a song memory at all is set aside.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import log from 'electron-log';
import { FilterTypeEnum, type ISmartEqSettings } from 'common/constants';
import {
  getDefaultSongEqSettings,
  lookupSongEq,
  type ISongEqEntry,
  type ISongEqSettings,
} from 'common/songEq';
import { buildSongIdentity, type ISongIdentity } from 'common/songIdentity';
import {
  getDefaultSongSoundSettings,
  lookupSongSound,
  type ISongSound,
  type ISongSoundSettings,
} from 'common/songSound';
import { flushPendingWrites } from 'main/asyncWriter';
import {
  loadSongEqSettings,
  readSongEqSettings,
  saveSongEqSettings,
} from 'main/songEqStore';
import { loadSongSoundSettings } from 'main/songSoundStore';
import {
  fingerprintSongMemory,
  storedSongIdentity,
} from 'main/songMemoryNames';

const mustBuild = (identity: ISongIdentity | undefined): ISongIdentity => {
  if (!identity) {
    throw new Error('test fixture produced no identity');
  }
  return identity;
};

const browser = mustBuild(
  buildSongIdentity('system', 'chrome.exe', 'A private title', 'A channel'),
);
const ownFile = mustBuild(
  buildSongIdentity('library', 'D:/Music/a.flac', 'Blue in Green', 'Miles'),
);

const FINGERPRINT = /^[0-9a-f]{40}$/;
/** Every word of every song that is not the listener's own, below. */
const OUTSIDE_WORDS = /private|chrome|channel|den pc|somebody|youtube/i;

describe('the song as the memory files it', () => {
  it.each(['system', 'remote', 'media'] as const)(
    'keeps no name of a %s song, only fingerprints',
    (source) => {
      const stored = storedSongIdentity({ ...browser, source });

      expect(stored.key).toMatch(FINGERPRINT);
      expect(stored.alias).toMatch(FINGERPRINT);
      expect(stored.title).toBe('');
      expect(stored.artist).toBeUndefined();
      expect(JSON.stringify(stored)).not.toMatch(OUTSIDE_WORDS);
    },
  );

  it('keeps the name of the listener’s own file', () => {
    // The control for the case above: the same rule keeps a name here.
    const stored = storedSongIdentity(ownFile);

    expect(stored.key).toMatch(FINGERPRINT);
    expect(stored.title).toBe('Blue in Green');
    expect(stored.artist).toBe('Miles');
  });

  it('files a song the same way every time, and one song apart from another', () => {
    expect(storedSongIdentity(browser)).toEqual(storedSongIdentity(browser));
    const other = mustBuild(
      buildSongIdentity('system', 'chrome.exe', 'Another title', 'A channel'),
    );
    expect(storedSongIdentity(other).key).not.toBe(
      storedSongIdentity(browser).key,
    );
  });

  it('lets the same song from a file and from a player meet through the alias', () => {
    const spotify = mustBuild(
      buildSongIdentity('system', 'Spotify.exe', 'Blue in Green', 'Miles'),
    );
    expect(storedSongIdentity(spotify).alias).toBe(
      storedSongIdentity(ownFile).alias,
    );
  });
});

const layerOf = (gain: number): ISmartEqSettings => ({
  filters: {
    'smart-1000': {
      id: 'smart-1000',
      frequency: 1000,
      gain,
      quality: 1.4,
      type: FilterTypeEnum.PK,
    },
  },
});

/** One song of each kind, each with settings of its own to find again. */
const SONGS: ReadonlyArray<{
  identity: ISongIdentity;
  isOwn: boolean;
  settings: ISmartEqSettings;
  plays: number;
}> = [
  { identity: browser, isOwn: false, settings: layerOf(3), plays: 3 },
  {
    identity: mustBuild(
      buildSongIdentity('remote', 'Den PC', 'A private song', 'Somebody'),
    ),
    isOwn: false,
    settings: layerOf(-2),
    plays: 1,
  },
  {
    identity: mustBuild(
      buildSongIdentity(
        'media',
        'https://www.youtube.com/watch?v=abc',
        'A private video (Official Video)',
        undefined,
        'A private video (Official Video)',
      ),
    ),
    isOwn: false,
    settings: layerOf(5),
    plays: 4,
  },
  { identity: ownFile, isOwn: true, settings: layerOf(1), plays: 2 },
  {
    identity: mustBuild(
      buildSongIdentity('karaoke', 'D:/Karaoke/b.cdg', 'Warm-up'),
    ),
    isOwn: true,
    settings: layerOf(-4),
    plays: 6,
  },
];

/** A memory as builds before 2026-10-26 wrote it: every song by name. */
const writtenByName = (): ISongEqSettings => {
  const entries: Record<string, ISongEqEntry> = {};
  const aliases: Record<string, string> = {};
  SONGS.forEach(({ identity, settings, plays }, index) => {
    entries[identity.key] = {
      settings,
      title: identity.title,
      ...(identity.artist === undefined ? {} : { artist: identity.artist }),
      ...(identity.alias === undefined ? {} : { alias: identity.alias }),
      plays,
      updatedAt: index + 1,
    };
    if (identity.alias !== undefined) {
      aliases[identity.alias] = identity.key;
    }
  });
  return { version: 1, outputs: { 'device-a': { entries, aliases } } };
};

/** Every song found again as a new lookup finds it, with what it held. */
const expectEverySongKept = (settings: ISongEqSettings) => {
  SONGS.forEach(({ identity, isOwn, settings: layer, plays }, index) => {
    const entry = lookupSongEq(
      settings,
      'device-a',
      storedSongIdentity(identity),
    );
    expect(entry?.settings).toEqual(layer);
    expect(entry?.plays).toBe(plays);
    expect(entry?.updatedAt).toBe(index + 1);
    // The control: the listener's own song keeps its name.
    expect(entry?.title).toBe(isOwn ? identity.title : '');
  });
  expect(JSON.stringify(settings)).not.toMatch(OUTSIDE_WORDS);
};

describe('a memory written by name', () => {
  it('keeps every song’s settings under its fingerprint, and no name of anybody else’s', () => {
    const { settings, rewrite, dropped } =
      fingerprintSongMemory(writtenByName());

    expect(rewrite).toBe(true);
    expect(dropped).toBe(0);
    expectEverySongKept(settings);
    expect(
      Object.keys(settings.outputs['device-a'].entries).every((key) =>
        FINGERPRINT.test(key),
      ),
    ).toBe(true);
  });

  it('is left as it is once it has been filed so', () => {
    const once = fingerprintSongMemory(writtenByName()).settings;
    const twice = fingerprintSongMemory(once);

    expect(twice.rewrite).toBe(false);
    expect(twice.settings).toBe(once);
  });

  it('leaves out only an entry that is not one, and counts it', () => {
    const written = writtenByName();
    const broken = {
      ...written,
      outputs: {
        'device-a': {
          ...written.outputs['device-a'],
          entries: {
            ...written.outputs['device-a'].entries,
            'system:x:half:written': null,
            'system:x:bad:alias': { ...SONGS[0], alias: 42 },
          },
        },
      },
    } as unknown as ISongEqSettings;

    const { settings, dropped } = fingerprintSongMemory(broken);

    expect(dropped).toBe(2);
    expectEverySongKept(settings);
  });
});

describe('the file on disk', () => {
  const fileIn = (dir: string) => path.join(dir, 'song-eq.json');
  const emptyDir = () =>
    fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-song-names-'));
  const written = (text = JSON.stringify(writtenByName())) => {
    const dir = emptyDir();
    fs.writeFileSync(fileIn(dir), text, 'utf8');
    return dir;
  };
  const setAside = (dir: string) =>
    fs.readdirSync(dir).filter((name) => name.includes('.damaged-'));

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is written again with every song kept and no name of anybody else’s', () => {
    const dir = written();

    expectEverySongKept(loadSongEqSettings(dir));

    const text = fs.readFileSync(fileIn(dir), 'utf8');
    expect(text).not.toMatch(OUTSIDE_WORDS);
    expectEverySongKept(JSON.parse(text) as ISongEqSettings);
    // The control for the files set aside below: a good file stays put.
    expect(setAside(dir)).toEqual([]);
  });

  it.each([
    ['is not JSON', '{ "version": 1, "outputs": { "device-a": { "ent'],
    ['is another version’s', JSON.stringify({ version: 2, outputs: {} })],
  ])('is set aside, never written over, when it %s', (_case, text) => {
    const dir = written(text);

    expect(loadSongEqSettings(dir)).toEqual(getDefaultSongEqSettings());
    expect(fs.existsSync(fileIn(dir))).toBe(false);
    const [aside] = setAside(dir);
    expect(aside).toMatch(/^song-eq\.damaged-\d+\.json$/);

    // The next song saved starts a new file; the old one is untouched.
    saveSongEqSettings(dir, getDefaultSongEqSettings());
    expect(fs.readFileSync(path.join(dir, aside), 'utf8')).toBe(text);
  });

  it('says how many entries it left out, and names none of them', () => {
    const warn = jest.spyOn(log, 'warn');
    const written2 = writtenByName();
    const dir = written(
      JSON.stringify({
        ...written2,
        outputs: {
          'device-a': {
            ...written2.outputs['device-a'],
            entries: {
              ...written2.outputs['device-a'].entries,
              'system:chrome.exe:a private title:': null,
            },
          },
        },
      }),
    );

    expectEverySongKept(loadSongEqSettings(dir));

    expect(warn).toHaveBeenCalledTimes(1);
    const [line] = warn.mock.calls[0] as [string];
    expect(line).toContain('1 entries in song-eq.json');
    expect(line).not.toMatch(OUTSIDE_WORDS);
  });

  it('is only read by the read just after launch, which leaves the rest to its caller', async () => {
    const dir = written();

    const read = await readSongEqSettings(dir);

    expect(read.rewrite).toBe(true);
    expectEverySongKept(read.settings);
    expect(fs.readFileSync(fileIn(dir), 'utf8')).toMatch(/private/);

    const damaged = written('{ not json');
    expect((await readSongEqSettings(damaged)).damaged).toBe(true);
    expect(fs.existsSync(fileIn(damaged))).toBe(true);
  });

  it('is nothing to do where there is no file', async () => {
    expect(await readSongEqSettings(emptyDir())).toEqual({
      settings: getDefaultSongEqSettings(),
      rewrite: false,
      dropped: 0,
      damaged: false,
    });
  });
});

describe('the song sounds file on disk', () => {
  const fileIn = (dir: string) => path.join(dir, 'song-sound.json');
  const soundOf = (gain: number): ISongSound => ({
    presetId: 'none',
    filters: {
      song: {
        id: 'song',
        frequency: 800,
        gain,
        quality: 1.2,
        type: FilterTypeEnum.PK,
      },
    },
  });
  const writtenByName2 = (extra: Record<string, unknown> = {}) => {
    const entries: Record<string, unknown> = { ...extra };
    const aliases: Record<string, string> = {};
    SONGS.forEach(({ identity, plays }, index) => {
      entries[identity.key] = {
        sound: soundOf(index + 1),
        title: identity.title,
        ...(identity.artist === undefined ? {} : { artist: identity.artist }),
        ...(identity.alias === undefined ? {} : { alias: identity.alias }),
        plays,
        updatedAt: index + 1,
      };
      if (identity.alias !== undefined) {
        aliases[identity.alias] = identity.key;
      }
    });
    return JSON.stringify({
      version: 1,
      outputs: { 'device-a': { entries, aliases } },
    });
  };
  const written = (text: string) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-song-sound-'));
    fs.writeFileSync(fileIn(dir), text, 'utf8');
    return dir;
  };
  const expectEverySoundKept = (settings: ISongSoundSettings) => {
    SONGS.forEach(({ identity, isOwn, plays }, index) => {
      const entry = lookupSongSound(
        settings,
        'device-a',
        storedSongIdentity(identity),
      );
      expect(entry?.sound).toEqual(soundOf(index + 1));
      expect(entry?.plays).toBe(plays);
      expect(entry?.title).toBe(isOwn ? identity.title : '');
    });
    expect(JSON.stringify(settings)).not.toMatch(OUTSIDE_WORDS);
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is written again with every song’s sound kept and no name of anybody else’s', async () => {
    const warn = jest.spyOn(log, 'warn');
    // One entry whose sound is not one: left out, counted, named nowhere.
    const dir = written(writtenByName2({ 'system:x:a private one:': {} }));

    expectEverySoundKept(loadSongSoundSettings(dir));
    await flushPendingWrites();

    const text = fs.readFileSync(fileIn(dir), 'utf8');
    expect(text).not.toMatch(OUTSIDE_WORDS);
    expectEverySoundKept(JSON.parse(text) as ISongSoundSettings);
    expect(warn).toHaveBeenCalledTimes(1);
    const [line] = warn.mock.calls[0] as [string];
    expect(line).toContain('1 entries in song-sound.json');
    expect(line).not.toMatch(OUTSIDE_WORDS);
  });

  it('is set aside, never written over, when it is not JSON', async () => {
    const text = '{ "version": 1, "outputs": {';
    const dir = written(text);

    expect(loadSongSoundSettings(dir)).toEqual(getDefaultSongSoundSettings());
    await flushPendingWrites();

    expect(fs.existsSync(fileIn(dir))).toBe(false);
    const [aside] = fs
      .readdirSync(dir)
      .filter((name) => name.startsWith('song-sound.damaged-'));
    expect(fs.readFileSync(path.join(dir, aside), 'utf8')).toBe(text);
  });
});
