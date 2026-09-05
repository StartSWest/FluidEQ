/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * The four song-memory channels, fired at the real handlers.
 *
 * `common/songEq.ts` and `main/songEqStore.ts` each have their own suite and
 * both were green while Forget deleted nothing at all: what neither can see is
 * the handler between them — which arguments it accepts, what it hands across
 * the boundary, and whether it always replies.
 *
 * Always replying is the point of several of these. `songEqStore.ts` carries a
 * comment about it: a throw inside an `ipcMain` handler that has already
 * committed to replying sends no reply at all, and `promisifyResult` on the
 * renderer side then waits forever on a promise nothing will ever settle.
 * Every test below asserts a reply, not merely an absence of exceptions.
 *
 * Each test gets a fresh copy of the module, because `cached` is module state:
 * without isolation the first test's store answers the second test's lookups
 * out of a temporary directory that has nothing to do with it.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import ChannelEnum from '../../../common/channels';
import { ErrorCode } from '../../../common/errors';
import { FilterTypeEnum, ISmartEqSettings } from '../../../common/constants';
import { ISongEqSettings } from '../../../common/songEq';
import { ISongIdentity, buildSongIdentity } from '../../../common/songIdentity';

type THandler = (event: { reply: jest.Mock }, arg: unknown) => void;

const handlers = new Map<string, THandler>();

jest.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, handler: THandler) => {
      handlers.set(channel, handler);
    },
  },
}));

const tempDir = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-song-eq-ipc-'));

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

/** A fresh module with a fresh `cached`, registered against `userDataDir`. */
const register = (userDataDir: string): void => {
  handlers.clear();
  jest.isolateModules(() => {
    const fresh =
      // eslint-disable-next-line global-require -- an uncached copy per test is the whole point: `cached` in main/ipc/songEq.ts is module state
      require('../../../main/ipc/songEq') as typeof import('../../../main/ipc/songEq');
    fresh.default(userDataDir);
  });
};

/**
 * Fire one channel and hand back the single reply it made.
 *
 * "Single" is asserted here rather than in each test: a handler that replies
 * none of the times it should is the failure mode this whole suite is about,
 * and one that replies twice would resolve a promise with the wrong answer.
 * The channel it names is checked too — `promisifyResult` listens on the
 * channel it sent, so a reply on any other is a reply nobody hears.
 */
const fire = (channel: ChannelEnum, arg: unknown): unknown => {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`nothing registered for ${channel}`);
  }
  const reply = jest.fn();
  handler({ reply }, arg);
  expect(reply).toHaveBeenCalledTimes(1);
  expect(reply.mock.calls[0][0]).toBe(channel);
  return reply.mock.calls[0][1];
};

const onDisk = (dir: string): ISongEqSettings =>
  JSON.parse(
    fs.readFileSync(path.join(dir, 'song-eq.json'), 'utf8'),
  ) as ISongEqSettings;

describe('the song memory channels', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('registers every channel the renderer will call', () => {
    register(tempDir());
    [
      ChannelEnum.LOOKUP_SONG_EQ,
      ChannelEnum.CHECKPOINT_SONG_EQ,
      ChannelEnum.COMMIT_SONG_EQ,
      ChannelEnum.FORGET_SONG_EQ,
    ].forEach((channel) => expect(handlers.has(channel)).toBe(true));
  });

  it('writes a commit to disk and replies that it did', () => {
    const dir = tempDir();
    register(dir);
    const identity = mustBuild(
      buildSongIdentity('library', 'abc', 'Black Dog', 'Led Zeppelin'),
    );

    expect(
      fire(ChannelEnum.COMMIT_SONG_EQ, [DEVICE, identity, layerOf(3)]),
    ).toEqual({ result: undefined });

    const stored = onDisk(dir).outputs[DEVICE];
    expect(stored.entries[identity.key].plays).toBe(1);
    expect(
      stored.entries[identity.key].settings.filters['smart-1000'].gain,
    ).toBe(3);
  });

  it('refuses a payload that is not what the channel takes, and still answers', () => {
    // The reply is the assertion. A handler that returned without one — or
    // threw its way out — leaves `promisifyResult` waiting on a promise
    // nothing will ever settle, which is a renderer that has silently stopped
    // remembering songs rather than one that reported a problem.
    const dir = tempDir();
    register(dir);
    const identity = mustBuild(buildSongIdentity('library', 'abc', 'Song'));
    const invalid: Array<[ChannelEnum, unknown]> = [
      // No identity at all.
      [ChannelEnum.LOOKUP_SONG_EQ, [DEVICE]],
      // An identity with no key.
      [ChannelEnum.LOOKUP_SONG_EQ, [DEVICE, { title: 'Song' }]],
      // A device id that is not a string.
      [ChannelEnum.CHECKPOINT_SONG_EQ, [7, identity, layerOf(1)]],
      // A layer that is not a layer.
      [ChannelEnum.COMMIT_SONG_EQ, [DEVICE, identity, 'nope']],
      // The pre-fix Forget payload: a bare key string where the identity goes.
      [ChannelEnum.FORGET_SONG_EQ, [DEVICE, identity.key]],
    ];

    invalid.forEach(([channel, arg]) => {
      expect(fire(channel, arg)).toEqual({
        errorCode: ErrorCode.INVALID_PARAMETER,
      });
    });

    // Positive control for the whole table: the same channels accept a
    // well-formed payload, so these refusals are the validation and not a
    // handler that refuses everything.
    expect(fire(ChannelEnum.LOOKUP_SONG_EQ, [DEVICE, identity])).toEqual({
      result: undefined,
    });
  });

  it('forgets a song it has never heard of without complaint', () => {
    const dir = tempDir();
    register(dir);
    expect(
      fire(ChannelEnum.FORGET_SONG_EQ, [
        DEVICE,
        mustBuild(buildSongIdentity('library', 'never-saved', 'Nobody')),
      ]),
    ).toEqual({ result: undefined });
  });

  /**
   * Critical 1 through the real channels: the cross-source Forget that used to
   * report success and delete nothing.
   *
   * Fails if `FORGET_SONG_EQ` goes back to taking a bare key, or if the pure
   * `forgetSongEq` stops resolving through the alias index.
   */
  it('forgets a library entry asked for by the identity Spotify is playing', () => {
    const dir = tempDir();
    register(dir);
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
    fire(ChannelEnum.COMMIT_SONG_EQ, [DEVICE, fromLibrary, layerOf(3)]);
    // Positive control: the match this Forget is answering really does land.
    expect(fire(ChannelEnum.LOOKUP_SONG_EQ, [DEVICE, fromSpotify])).toEqual({
      result: expect.objectContaining({ title: 'Black Dog' }),
    });

    fire(ChannelEnum.FORGET_SONG_EQ, [DEVICE, fromSpotify]);

    expect(fire(ChannelEnum.LOOKUP_SONG_EQ, [DEVICE, fromSpotify])).toEqual({
      result: undefined,
    });
    expect(onDisk(dir).outputs[DEVICE].entries).toEqual({});
  });

  it('answers a lookup from what it holds in memory, not from the file', () => {
    // The file is read once and rewritten whole — a song ending is not a
    // moment to spend on a disk read. Fails if `settingsOf` re-reads: the
    // emptied file below would then answer instead of the write that just
    // happened.
    const dir = tempDir();
    register(dir);
    const identity = mustBuild(buildSongIdentity('library', 'abc', 'Song'));
    fire(ChannelEnum.COMMIT_SONG_EQ, [DEVICE, identity, layerOf(3)]);

    fs.writeFileSync(
      path.join(dir, 'song-eq.json'),
      JSON.stringify({ version: 1, outputs: {} }),
      'utf8',
    );

    expect(fire(ChannelEnum.LOOKUP_SONG_EQ, [DEVICE, identity])).toEqual({
      result: expect.objectContaining({ title: 'Song' }),
    });
  });
});
