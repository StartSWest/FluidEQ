/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Each output's Smart EQ layer per song, as the core keeps it: written to
 * disk with no name of another program's song in it and still found, read
 * once and answered from memory, a launch read that never undoes a song
 * saved before it landed, and a forget that deletes through the alias index.
 *
 * These were the four song-memory channels' tests while the window asked
 * for each of them; the core asks the store itself now.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FilterTypeEnum, ISmartEqSettings } from 'common/constants';
import type { ISongEqSettings } from 'common/songEq';
import { ISongIdentity, buildSongIdentity } from 'common/songIdentity';
import { createSongEqEntries } from 'main/songEqEntries';
import { storedSongIdentity } from 'main/songMemoryNames';

const tempDir = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-song-eq-entries-'));

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

const mustBuild = (identity: ISongIdentity | undefined): ISongIdentity => {
  if (!identity) {
    throw new Error('test fixture produced no identity');
  }
  return identity;
};

const DEVICE = 'device-a';

const onDisk = (dir: string): ISongEqSettings =>
  JSON.parse(
    fs.readFileSync(path.join(dir, 'song-eq.json'), 'utf8'),
  ) as ISongEqSettings;

/** A store whose read just after launch is settled before it is used. */
const opened = (dir: string) => {
  const entries = createSongEqEntries(dir);
  entries.launchRead.catch(() => undefined);
  return entries;
};

it('writes a commit to disk', () => {
  const dir = tempDir();
  const entries = opened(dir);
  const identity = mustBuild(
    buildSongIdentity('library', 'abc', 'Black Dog', 'Led Zeppelin'),
  );

  entries.commit(DEVICE, identity, layerOf(3));

  const stored = onDisk(dir).outputs[DEVICE];
  const { key } = storedSongIdentity(identity);
  expect(stored.entries[key].plays).toBe(1);
  expect(stored.entries[key].settings.filters['smart-1000'].gain).toBe(3);
});

it('keeps no name of another program’s song on disk, and still finds it', () => {
  const dir = tempDir();
  const entries = opened(dir);
  const identity = mustBuild(
    buildSongIdentity(
      'system',
      'chrome.exe',
      'A private title',
      'A private channel',
    ),
  );

  entries.commit(DEVICE, identity, layerOf(3));

  const text = fs.readFileSync(path.join(dir, 'song-eq.json'), 'utf8');
  expect(text).not.toMatch(/private|chrome/i);
  // The control: what was filed is still found by the song playing.
  expect(entries.lookup(DEVICE, identity)).toEqual(
    expect.objectContaining({ plays: 1 }),
  );
});

it('writes a file of names again without them at launch', async () => {
  // As builds before 2026-10-26 wrote it: the song by name, in the key, the
  // alias, the title and the artist.
  const dir = tempDir();
  const spotify = mustBuild(
    buildSongIdentity('system', 'Spotify.exe', 'Private Song', 'Somebody'),
  );
  fs.writeFileSync(
    path.join(dir, 'song-eq.json'),
    JSON.stringify({
      version: 1,
      outputs: {
        [DEVICE]: {
          entries: {
            [spotify.key]: {
              settings: layerOf(4),
              title: spotify.title,
              artist: spotify.artist,
              alias: spotify.alias,
              plays: 2,
              updatedAt: 1,
            },
          },
          aliases: { [spotify.alias ?? '']: spotify.key },
        },
      },
    }),
    'utf8',
  );

  const entries = createSongEqEntries(dir);
  await entries.launchRead;

  const text = fs.readFileSync(path.join(dir, 'song-eq.json'), 'utf8');
  expect(text).not.toMatch(/private|somebody|spotify/i);
  // Found again by the same song, and through the alias by your own copy.
  const fromLibrary = mustBuild(
    buildSongIdentity('library', 'x', 'Private Song', 'Somebody'),
  );
  expect(entries.lookup(DEVICE, spotify)).toEqual(
    expect.objectContaining({ plays: 2 }),
  );
  expect(entries.lookup(DEVICE, fromLibrary)).toEqual(
    expect.objectContaining({ plays: 2 }),
  );
});

it('leaves a song saved before the launch read lands where it was', async () => {
  // A song can be saved before the read just after launch has come back.
  // That read is of the file as it was, and taking it in would put the
  // song's memory back to before it was saved. The read is held here until
  // the save is done, and then answers with the file from before it.
  const dir = tempDir();
  const before = JSON.stringify({ version: 1, outputs: {} });
  let answer: (text: string) => void = () => {};
  const read = jest.spyOn(fs.promises, 'readFile').mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        answer = resolve;
      }) as ReturnType<typeof fs.promises.readFile>,
  );
  const identity = mustBuild(buildSongIdentity('library', 'abc', 'Song'));
  const entries = createSongEqEntries(dir);
  entries.commit(DEVICE, identity, layerOf(3));

  answer(before);
  await entries.launchRead;
  read.mockRestore();

  expect(entries.lookup(DEVICE, identity)).toEqual(
    expect.objectContaining({ plays: 1 }),
  );
});

it('forgets a song it has never heard of without complaint', () => {
  const entries = opened(tempDir());
  expect(() =>
    entries.forget(
      DEVICE,
      mustBuild(buildSongIdentity('library', 'never-saved', 'Nobody')),
    ),
  ).not.toThrow();
});

/**
 * The cross-source Forget that used to report success and delete nothing.
 * Fails if the pure `forgetSongEq` stops resolving through the alias index.
 */
it('forgets a library entry asked for by the identity Spotify is playing', () => {
  const dir = tempDir();
  const entries = opened(dir);
  const fromLibrary = mustBuild(
    buildSongIdentity('library', 'abc', 'Black Dog', 'Led Zeppelin'),
  );
  const fromSpotify = mustBuild(
    buildSongIdentity(
      'system',
      'Spotify.exe',
      'Black Dog (Official Video)',
      'Led Zeppelin',
    ),
  );
  entries.commit(DEVICE, fromLibrary, layerOf(3));
  // Positive control: the match this Forget is answering really does land.
  expect(entries.lookup(DEVICE, fromSpotify)).toEqual(
    expect.objectContaining({ title: 'Black Dog' }),
  );

  entries.forget(DEVICE, fromSpotify);

  expect(entries.lookup(DEVICE, fromSpotify)).toBeUndefined();
  expect(onDisk(dir).outputs[DEVICE].entries).toEqual({});
});

it('answers a lookup from what it holds in memory, not from the file', () => {
  // The file is read once and rewritten whole — a song ending is not a
  // moment to spend on a disk read. Fails if the store re-reads: the emptied
  // file below would then answer instead of the write that just happened.
  const dir = tempDir();
  const entries = opened(dir);
  const identity = mustBuild(buildSongIdentity('library', 'abc', 'Song'));
  entries.commit(DEVICE, identity, layerOf(3));

  fs.writeFileSync(
    path.join(dir, 'song-eq.json'),
    JSON.stringify({ version: 1, outputs: {} }),
    'utf8',
  );

  expect(entries.lookup(DEVICE, identity)).toEqual(
    expect.objectContaining({ title: 'Song' }),
  );
});

it('answers a layer as the update path will write it, and none that has no band left', () => {
  // A layer the window filed before the core did was never rounded: lent
  // back rounded, it must still read as the memory's own.
  const dir = tempDir();
  const entries = opened(dir);
  const song = mustBuild(buildSongIdentity('library', 'abc', 'Song'));
  const empty = mustBuild(buildSongIdentity('library', 'def', 'Empty'));
  entries.commit(DEVICE, song, layerOf(3.04));
  entries.commit(DEVICE, empty, { filters: {} });

  expect(
    entries.lookup(DEVICE, song)?.settings.filters['smart-1000'].gain,
  ).toBe(3);
  expect(entries.lookup(DEVICE, empty)).toBeUndefined();
});
