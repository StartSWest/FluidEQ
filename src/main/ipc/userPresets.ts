/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import ChannelEnum from '../../common/channels';
import { ErrorCode } from '../../common/errors';
import {
  isUserPresetListPayload,
  readUserPresetList,
  type IUserDspPreset,
} from '../../common/userPresetsFile';
import type { TSuccess } from '../../renderer/utils/equalizerApi';
import { loadUserPresets, saveUserPresets } from '../userPresetsFile';
import { userMessageOf } from '../refusal';
import onWindowMessage from './windowMessages';

export interface IUserPresetsIpcDeps {
  userDataDir: string;
  handleError: (
    event: Electron.IpcMainEvent,
    channel: ChannelEnum | string,
    errorCode: ErrorCode,
    message?: string,
  ) => void;
  logger: { error(message: string, ...details: unknown[]): void };
}

/**
 * The listener's own presets, kept by main: the window reads the list once
 * and sends the whole next list back after every change. A list that is not
 * exactly presets is refused before anything is written; a write that fails
 * is reported, so the window can put back what it showed.
 */
export const registerUserPresetsIpc = ({
  userDataDir,
  handleError,
  logger,
}: IUserPresetsIpcDeps) => {
  onWindowMessage(ChannelEnum.GET_USER_PRESETS, (event) => {
    const channel = ChannelEnum.GET_USER_PRESETS;
    try {
      const reply: TSuccess<IUserDspPreset[]> = {
        result: loadUserPresets(userDataDir, logger),
      };
      event.reply(channel, reply);
    } catch (error) {
      logger.error('Your presets: could not be read', error);
      handleError(event, channel, ErrorCode.FAILURE, userMessageOf(error));
    }
  });

  onWindowMessage(ChannelEnum.SET_USER_PRESETS, (event, arg) => {
    const channel = ChannelEnum.SET_USER_PRESETS;
    const presets: unknown = arg?.[0];
    if (!isUserPresetListPayload(presets)) {
      handleError(event, channel, ErrorCode.INVALID_PARAMETER);
      return;
    }
    try {
      // Kept as it reads back, every rack and curve clamped, so the file
      // never holds a field the next start would change.
      saveUserPresets(userDataDir, readUserPresetList(presets));
      const reply: TSuccess<boolean> = { result: true };
      event.reply(channel, reply);
    } catch (error) {
      logger.error('Your presets: could not be written', error);
      handleError(event, channel, ErrorCode.FAILURE, userMessageOf(error));
    }
  });
};
