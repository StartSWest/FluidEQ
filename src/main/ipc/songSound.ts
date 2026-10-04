/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import ChannelEnum from '../../common/channels';
import { IState } from '../../common/constants';
import { ErrorCode } from '../../common/errors';
import type { ISongIdentity, TSongSource } from '../../common/songIdentity';
import type { IOutputEditor } from '../../common/outputSettings';
import {
  ISongSoundEntry,
  TSongSoundLanded,
  ISongSoundSettings,
  forgetSongSound,
  lookupSongSound,
  saveSongSound,
  toSongSound,
} from '../../common/songSound';
import { TError, TSuccess } from '../../renderer/utils/equalizerApi';
import {
  keepSongSound,
  putSongSoundOn,
  returnSongSound,
} from '../songSoundLoan';
import {
  loadSongSoundSettings,
  saveSongSoundSettings,
} from '../songSoundStore';
import onWindowMessage from './windowMessages';

export interface ISongSoundIpcDeps {
  state: IState;
  userDataDir: string;
  getOutputEditor: () => IOutputEditor | undefined;
  handleUpdateHelper: <T>(
    event: Electron.IpcMainEvent,
    channel: ChannelEnum | string,
    response: T,
    syncActiveProfile?: boolean,
    useActiveSessionOverride?: boolean,
  ) => Promise<void>;
}

/** Longer than any path, title or artist a player reports; a cap, not a fit. */
const MAX_TEXT = 2048;
const SOURCES: readonly string[] = [
  'library',
  'karaoke',
  'media',
  'system',
  'remote',
] satisfies readonly TSongSource[];

const isText = (value: unknown, isOptional = false): boolean =>
  (isOptional && value === undefined) ||
  (typeof value === 'string' && value.length <= MAX_TEXT);

/**
 * A song as the window names it, every string bounded and the source one of
 * the five, before any of it is kept in a file that lives for good.
 */
const isIdentity = (value: unknown): value is ISongIdentity => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { key, alias, title, artist, source } = value as Record<
    string,
    unknown
  >;
  return (
    isText(key) &&
    key !== '' &&
    isText(title) &&
    isText(alias, true) &&
    isText(artist, true) &&
    typeof source === 'string' &&
    SOURCES.includes(source)
  );
};

/** An output id, as short and printable as Windows makes one. */
const isDeviceId = (value: unknown): value is string =>
  typeof value === 'string' && value !== '' && value.length <= 256;

const replyInvalidParameter = (
  event: Electron.IpcMainEvent,
  channel: ChannelEnum,
): void => {
  const reply: TError = { errorCode: ErrorCode.INVALID_PARAMETER };
  event.reply(channel, reply);
};

/**
 * The memory of each song's sound, and putting one on.
 *
 * The memory is a file and three channels to it with no rules of their own —
 * what a lookup returns and what a save changes live in
 * `common/songSound.ts` — held in memory between writes, as the Smart EQ
 * memory's is (`songEq.ts`): nothing else writes the file, and a song ending
 * is not a moment for a disk read.
 *
 * Putting a sound on is one write of the bands, the Tone and the preset's
 * curve together, so the engine hears the song's sound arrive in one piece
 * rather than band by band. Whether it is lent, and what that keeps out of
 * the output's profile, is `songSoundLoan.ts`.
 */
const registerSongSoundIpc = ({
  state,
  userDataDir,
  getOutputEditor,
  handleUpdateHelper,
}: ISongSoundIpcDeps): void => {
  let cached: ISongSoundSettings | undefined;
  const settings = (): ISongSoundSettings => {
    if (!cached) {
      cached = loadSongSoundSettings(userDataDir);
    }
    return cached;
  };
  const replySuccess = (event: Electron.IpcMainEvent, channel: ChannelEnum) => {
    const reply: TSuccess<void> = { result: undefined };
    event.reply(channel, reply);
  };
  const matchesEditor = (value: unknown): boolean => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    const asked = value as { deviceId?: unknown; generation?: unknown };
    const current = getOutputEditor();
    return (
      !!current &&
      asked.deviceId === current.device.id &&
      Number.isSafeInteger(asked.generation) &&
      asked.generation === current.generation
    );
  };

  onWindowMessage(ChannelEnum.LOOKUP_SONG_SOUND, (event, arg) => {
    const channel = ChannelEnum.LOOKUP_SONG_SOUND;
    const deviceId = arg?.[0];
    const identity = arg?.[1];
    if (!isDeviceId(deviceId) || !isIdentity(identity)) {
      replyInvalidParameter(event, channel);
      return;
    }
    const reply: TSuccess<ISongSoundEntry | undefined> = {
      result: lookupSongSound(settings(), deviceId, identity),
    };
    event.reply(channel, reply);
  });

  onWindowMessage(ChannelEnum.SAVE_SONG_SOUND, (event, arg) => {
    const channel = ChannelEnum.SAVE_SONG_SOUND;
    const deviceId = arg?.[0];
    const identity = arg?.[1];
    const sound = toSongSound(arg?.[2]);
    if (!isDeviceId(deviceId) || !isIdentity(identity) || !sound) {
      replyInvalidParameter(event, channel);
      return;
    }
    cached = saveSongSound(settings(), deviceId, identity, sound, Date.now());
    saveSongSoundSettings(userDataDir, cached);
    replySuccess(event, channel);
  });

  onWindowMessage(ChannelEnum.FORGET_SONG_SOUND, (event, arg) => {
    const channel = ChannelEnum.FORGET_SONG_SOUND;
    const deviceId = arg?.[0];
    const identity = arg?.[1];
    if (!isDeviceId(deviceId) || !isIdentity(identity)) {
      replyInvalidParameter(event, channel);
      return;
    }
    // The identity, not a key: which entry this removes is
    // `common/songMemory.ts`'s decision, exactly as it is for a lookup.
    cached = forgetSongSound(settings(), deviceId, identity);
    saveSongSoundSettings(userDataDir, cached);
    replySuccess(event, channel);
  });

  onWindowMessage(ChannelEnum.APPLY_SONG_SOUND, async (event, arg) => {
    const channel = ChannelEnum.APPLY_SONG_SOUND;
    const sound = toSongSound(arg?.[0]);
    const isLent = arg?.[1];
    // The preset's curve as the window's catalogue gives it; none for None,
    // a preset without one, or a hand-back that puts back what a loan took.
    const curve: unknown = arg?.[2];
    if (
      !sound ||
      typeof isLent !== 'boolean' ||
      !matchesEditor(arg?.[3]) ||
      (curve !== undefined &&
        curve !== null &&
        (typeof curve !== 'object' || Array.isArray(curve)))
    ) {
      replyInvalidParameter(event, channel);
      return;
    }
    putSongSoundOn(state, sound, isLent, curve);
    // What landed, so the window can tell an apply that finished from one
    // still on its way without waiting for its own copy of the state.
    const landed: TSongSoundLanded = {
      filters: state.filters,
      tone: state.tone,
      voicing: state.voicing,
      eqFormat: state.eqFormat,
    };
    await handleUpdateHelper(event, channel, landed, false, true);
  });

  onWindowMessage(ChannelEnum.KEEP_SONG_SOUND, async (event, arg) => {
    const channel = ChannelEnum.KEEP_SONG_SOUND;
    if (!matchesEditor(arg?.[0])) {
      replyInvalidParameter(event, channel);
      return;
    }
    if (!state.songSoundLoan) {
      replySuccess(event, channel);
      return;
    }
    keepSongSound(state);
    // Written out like any edit: what plays is the output's profile now.
    await handleUpdateHelper(event, channel, undefined, false, true);
  });

  onWindowMessage(ChannelEnum.RETURN_SONG_SOUND, async (event, arg) => {
    const channel = ChannelEnum.RETURN_SONG_SOUND;
    if (!matchesEditor(arg?.[0])) {
      replyInvalidParameter(event, channel);
      return;
    }
    if (!returnSongSound(state)) {
      replySuccess(event, channel);
      return;
    }
    await handleUpdateHelper(event, channel, undefined, false, true);
  });
};

export default registerSongSoundIpc;
