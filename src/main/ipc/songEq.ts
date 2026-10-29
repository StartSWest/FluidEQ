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

import ChannelEnum from '../../common/channels';
import { ErrorCode } from '../../common/errors';
import {
  ISongEqEntry,
  ISongEqSettings,
  checkpointSongEq,
  commitSongEq,
  forgetSongEq,
  lookupSongEq,
} from '../../common/songEq';
import { ISongIdentity } from '../../common/songIdentity';
import { TError, TSuccess } from '../../renderer/utils/equalizerApi';
import {
  keepSongEqSettings,
  loadSongEqSettings,
  readSongEqSettings,
  saveSongEqSettings,
} from '../songEqStore';
import { storedSongIdentity } from '../songMemoryNames';
import onWindowMessage from './windowMessages';

/**
 * Held in memory between writes.
 *
 * The file is read once and rewritten whole. Re-reading it on every save would
 * be the safer-looking choice and is the wrong one here: nothing else on the
 * machine writes it, and a song ending is not a moment to spend on a disk read.
 */
let cached: ISongEqSettings | undefined;

const settingsOf = (userDataDir: string): ISongEqSettings => {
  if (!cached) {
    cached = loadSongEqSettings(userDataDir);
  }
  return cached;
};

const isIdentity = (value: unknown): value is ISongIdentity =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { key?: unknown }).key === 'string' &&
  typeof (value as { title?: unknown }).title === 'string';

const replyInvalidParameter = (
  event: Electron.IpcMainEvent,
  channel: ChannelEnum,
): void => {
  const reply: TError = { errorCode: ErrorCode.INVALID_PARAMETER };
  event.reply(channel, reply);
};

/**
 * A file on disk and four channels to reach it. No rules of its own: what a
 * lookup returns and what a write changes both live in `common/songEq.ts`, so
 * every handler here is validation plus a call across that boundary — with
 * the song as the file may name it (`storedSongIdentity`).
 *
 * Settles once the read just after launch has been taken in. Main does not
 * wait for it; the tests do.
 */
const registerSongEqHandlers = (userDataDir: string): Promise<void> => {
  // Read once just after launch, off the main thread, rather than at the
  // first song: a file written before 2026-10-26 names the songs in it, and
  // reading it is what writes it again without them (`songMemoryNames.ts`).
  // A lookup that lands first has read the file itself and written it then,
  // and may have saved a song since, so this then leaves both alone.
  const launchRead = readSongEqSettings(userDataDir).then((loaded) => {
    if (cached === undefined) {
      cached = keepSongEqSettings(userDataDir, loaded);
    }
    return undefined;
  });

  onWindowMessage(ChannelEnum.LOOKUP_SONG_EQ, (event, arg) => {
    const channel = ChannelEnum.LOOKUP_SONG_EQ;
    const deviceId = arg?.[0];
    const identity = arg?.[1];
    if (typeof deviceId !== 'string' || !isIdentity(identity)) {
      replyInvalidParameter(event, channel);
      return;
    }
    const reply: TSuccess<ISongEqEntry | undefined> = {
      result: lookupSongEq(
        settingsOf(userDataDir),
        deviceId,
        storedSongIdentity(identity),
      ),
    };
    event.reply(channel, reply);
  });

  const write = (
    channel: ChannelEnum,
    apply: typeof checkpointSongEq,
  ): void => {
    onWindowMessage(channel, (event, arg) => {
      const deviceId = arg?.[0];
      const identity = arg?.[1];
      const layer = arg?.[2];
      if (
        typeof deviceId !== 'string' ||
        !isIdentity(identity) ||
        typeof layer !== 'object' ||
        layer === null
      ) {
        replyInvalidParameter(event, channel);
        return;
      }
      cached = apply(
        settingsOf(userDataDir),
        deviceId,
        storedSongIdentity(identity),
        layer,
        Date.now(),
      );
      saveSongEqSettings(userDataDir, cached);
      const reply: TSuccess<void> = { result: undefined };
      event.reply(channel, reply);
    });
  };

  write(ChannelEnum.CHECKPOINT_SONG_EQ, checkpointSongEq);
  write(ChannelEnum.COMMIT_SONG_EQ, commitSongEq);

  onWindowMessage(ChannelEnum.FORGET_SONG_EQ, (event, arg) => {
    const channel = ChannelEnum.FORGET_SONG_EQ;
    const deviceId = arg?.[0];
    const identity = arg?.[1];
    if (typeof deviceId !== 'string' || !isIdentity(identity)) {
      replyInvalidParameter(event, channel);
      return;
    }
    // The identity, not a key: which entry this actually removes is
    // `common/songEq.ts`'s decision, exactly as it is for a lookup.
    cached = forgetSongEq(
      settingsOf(userDataDir),
      deviceId,
      storedSongIdentity(identity),
    );
    saveSongEqSettings(userDataDir, cached);
    const reply: TSuccess<void> = { result: undefined };
    event.reply(channel, reply);
  });

  return launchRead;
};

export default registerSongEqHandlers;
