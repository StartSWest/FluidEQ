/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import ChannelEnum from '../../common/channels';
import { ErrorCode } from '../../common/errors';
import type { IMyCurve } from '../../common/myCurves';
import { isCurveListPayload } from '../../common/myCurvesFile';
import type { TSuccess } from '../../renderer/utils/equalizerApi';
import { loadMyCurves, saveMyCurves } from '../myCurvesFile';
import { userMessageOf } from '../refusal';
import onWindowMessage from './windowMessages';

export interface IMyCurvesIpcDeps {
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
 * My curves, kept by main: the window reads the list once and sends the
 * whole next list back after every change. A list that is not exactly curves
 * is refused before anything is written; a write that fails is reported, so
 * the window can put back what it showed.
 */
export const registerMyCurvesIpc = ({
  userDataDir,
  handleError,
  logger,
}: IMyCurvesIpcDeps) => {
  onWindowMessage(ChannelEnum.GET_MY_CURVES, (event) => {
    const channel = ChannelEnum.GET_MY_CURVES;
    try {
      const reply: TSuccess<IMyCurve[]> = {
        result: loadMyCurves(userDataDir, logger),
      };
      event.reply(channel, reply);
    } catch (error) {
      logger.error('My curves: could not be read', error);
      handleError(event, channel, ErrorCode.FAILURE, userMessageOf(error));
    }
  });

  onWindowMessage(ChannelEnum.SET_MY_CURVES, (event, arg) => {
    const channel = ChannelEnum.SET_MY_CURVES;
    const curves: unknown = arg?.[0];
    if (!isCurveListPayload(curves)) {
      handleError(event, channel, ErrorCode.INVALID_PARAMETER);
      return;
    }
    try {
      saveMyCurves(userDataDir, curves);
      const reply: TSuccess<boolean> = { result: true };
      event.reply(channel, reply);
    } catch (error) {
      logger.error('My curves: could not be written', error);
      handleError(event, channel, ErrorCode.FAILURE, userMessageOf(error));
    }
  });
};
