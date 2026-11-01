/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What each song was played with, as the core files it: by fingerprint,
 * never by the names another program gave the song — on a fresh save, and
 * on a file from before that wrote them, rewritten just after launch.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FilterTypeEnum } from '../../../common/constants';
import { buildSongIdentity } from '../../../common/songIdentity';
import type { ISongSound } from '../../../common/songSound';
import { flushPendingWrites } from '../../../main/asyncWriter';
import { createSongSoundMemory } from '../../../main/songSoundMemory';

jest.mock('electron', () => ({ app: { getPath: () => '' } }));

const song: ISongSound = {
  presetId: 'none',
  filters: {
    song: {
      id: 'song',
      frequency: 800,
      gain: 8,
      quality: 1.2,
      type: FilterTypeEnum.PK,
    },
  },
};
const privateSong = () => {
  const identity = buildSongIdentity(
    'system',
    'chrome.exe',
    'A private title',
    'A private channel',
  );
  if (!identity) {
    throw new Error('test fixture produced no identity');
  }
  return identity;
};

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-song-sound-'));
});
afterEach(async () => {
  await flushPendingWrites();
  fs.rmSync(dir, { recursive: true, force: true });
});

it('keeps no name of another program’s song in its file, and still finds it', async () => {
  const identity = privateSong();
  const memory = createSongSoundMemory(dir);
  memory.save('main', identity, song);
  await flushPendingWrites();

  const text = fs.readFileSync(path.join(dir, 'song-sound.json'), 'utf8');
  expect(text).not.toMatch(/private|chrome/i);
  // The control: what was filed is still found by the song playing.
  expect(memory.lookup('main', identity)).toEqual(
    expect.objectContaining({ plays: 1 }),
  );
});

it('writes a file of names again without them just after launch, and still finds the song', async () => {
  // As builds before 2026-10-26 wrote it: the song by name, in the key, the
  // alias, the title and the artist.
  const identity = privateSong();
  fs.writeFileSync(
    path.join(dir, 'song-sound.json'),
    JSON.stringify({
      version: 1,
      outputs: {
        main: {
          entries: {
            [identity.key]: {
              sound: song,
              title: identity.title,
              artist: identity.artist,
              alias: identity.alias,
              plays: 2,
              updatedAt: 1,
            },
          },
          aliases: { [identity.alias ?? '']: identity.key },
        },
      },
    }),
    'utf8',
  );
  const memory = createSongSoundMemory(dir);
  await memory.launchRead;
  await flushPendingWrites();

  const text = fs.readFileSync(path.join(dir, 'song-sound.json'), 'utf8');
  expect(text).not.toMatch(/private|chrome/i);
  expect(memory.lookup('main', identity)).toEqual(
    expect.objectContaining({ plays: 2 }),
  );
});

it('forgets a song for good', () => {
  const identity = privateSong();
  const memory = createSongSoundMemory(dir);
  memory.save('main', identity, song);
  memory.forget('main', identity);
  expect(memory.lookup('main', identity)).toBeUndefined();
  // POSITIVE CONTROL: another output's memory of it is its own.
  memory.save('second', identity, song);
  expect(memory.lookup('second', identity)).toBeDefined();
});
