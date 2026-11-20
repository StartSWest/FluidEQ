/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import log from 'electron-log';
import ChannelEnum from '../../common/channels';
import type {
  IDeviceProfileSettings,
  IPresetV2,
  IState,
} from '../../common/constants';
import { ErrorCode } from '../../common/errors';
import type { IGameCopySound } from '../../common/gaming';
import type { TSuccess } from '../../renderer/utils/equalizerApi';
import type { TPresetDirForDevice } from '../deviceProfiles';
import { doesPresetExist, fetchPreset } from '../flush';
import {
  gameCopyFromSeed,
  gameCopyName,
  gameCopySound,
  TGameLoans,
  TYoursGamingProfiles,
} from '../gameSound';
import type { IMainSession } from '../mainSession';
import { ownPreset } from '../songSoundLoan';
import type { IReplySink } from './profiles';
import { asGameId, asSeed } from './gameSoundValues';
import onWindowMessage from './windowMessages';

interface IGameSoundsDeps {
  state: IState;
  session: IMainSession;
  deviceProfileSettings: IDeviceProfileSettings;
  loans: TGameLoans;
  getCurrentPreset: () => IPresetV2;
}

/**
 * The two sounds every game request reads: the output's own, and a game's
 * copy. While the copy is the profile playing, the live state is the copy:
 * an edit changes the state the moment it arrives and reaches the copy's
 * file only when its write lands.
 */
export const createGameSounds = ({
  state,
  session,
  deviceProfileSettings,
  loans,
  getCurrentPreset,
}: IGameSoundsDeps) => ({
  /**
   * The output's own sound as it stands, for a new copy to start from: the
   * profile the game borrowed from if a game's sound is on, or the live one.
   */
  musicSound: (deviceId: string, dir: string): IPresetV2 => {
    const loan = loans.get(deviceId);
    return loan
      ? fetchPreset(loan.musicPresetName, dir)
      : ownPreset(getCurrentPreset(), state);
  },
  /** The game's copy on this output, as it sounds now. */
  copySound: (gameId: string, dir: string): IPresetV2 | undefined => {
    const copy = gameCopyName(gameId);
    const deviceId = session.activeAudioDeviceId;
    if (deviceProfileSettings.assignments[deviceId]?.presetName === copy) {
      return ownPreset(getCurrentPreset(), state);
    }
    return doesPresetExist(copy, dir) ? fetchPreset(copy, dir) : undefined;
  },
});

export interface IGameCopySoundIpcDeps {
  session: IMainSession;
  presetDirForDevice: TPresetDirForDevice;
  yours: TYoursGamingProfiles;
  /** The game's copy on this output as it sounds now (`gameSound.ts`). */
  copySound: (gameId: string, dir: string) => IPresetV2 | undefined;
  /** The output's own sound, which a copy made now would start from. */
  musicSound: (deviceId: string, dir: string) => IPresetV2;
  handleError: (
    event: IReplySink,
    channel: ChannelEnum | string,
    errorCode: ErrorCode,
  ) => void;
}

/**
 * What a game's sound plays on the playing output, for the Gaming Lab to
 * show while that sound is not on (`IGameCopySound`).
 *
 * The copy when this output has one; otherwise the copy its seed would make,
 * by the same `gameCopyFromSeed` the first load runs, so a game never played
 * here is shown as it will sound and not as an empty page. Nothing is
 * written: only a load makes the copy. `false` where there is nothing to
 * read — no output yet, or a seed naming one of Yours that is gone.
 */
export const registerGameCopySoundIpc = ({
  session,
  presetDirForDevice,
  yours,
  copySound,
  musicSound,
  handleError,
}: IGameCopySoundIpcDeps) => {
  onWindowMessage(ChannelEnum.GAME_SOUND_COPY, (event, arg) => {
    const channel = ChannelEnum.GAME_SOUND_COPY;
    const args: unknown[] = Array.isArray(arg) ? arg : [];
    const gameId = asGameId(args[0]);
    const seed = asSeed(args[1]);
    if (!gameId) {
      handleError(event, channel, ErrorCode.INVALID_PARAMETER);
      return;
    }
    const deviceId = session.activeAudioDeviceId;
    if (!deviceId) {
      // A saved game may render first; the window asks again on output change.
      const nothing: TSuccess<boolean> = { result: false };
      event.reply(channel, nothing);
      return;
    }
    try {
      const dir = presetDirForDevice(deviceId);
      const sound =
        copySound(gameId, dir) ??
        (seed
          ? gameCopyFromSeed(
              musicSound(deviceId, dir),
              seed,
              seed.kind === 'yours' ? yours.sound(seed.id) : undefined,
            )
          : undefined);
      const reply: TSuccess<IGameCopySound | boolean> = {
        result: sound ? gameCopySound(sound) : false,
      };
      event.reply(channel, reply);
    } catch (error) {
      log.warn('Game sound: could not read a copy for its page', error);
      handleError(event, channel, ErrorCode.FAILURE);
    }
  });
};
