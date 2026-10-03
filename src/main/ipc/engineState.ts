/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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

import log from 'electron-log';
import ChannelEnum from '../../common/channels';
import { IState } from '../../common/constants';
import { ErrorCode } from '../../common/errors';
import { TSuccess } from '../../renderer/utils/equalizerApi';
import { save } from '../flush';
import mainText from '../mainText';
import type { TReplySink } from '../updatePath';
import onWindowMessage from './windowMessages';
import type { IEqualizerSnapshot } from '../../common/outputSettings';

export interface IEngineStateIpcDeps {
  state: IState;
  userDataDir: string;
  /** Resolves the chosen engine's folder; a false answer has been replied to. */
  updateConfigPath: (
    event: TReplySink,
    channel: ChannelEnum | string,
  ) => Promise<boolean>;
  handleUpdate: (
    event: TReplySink,
    channel: ChannelEnum | string,
  ) => Promise<void>;
  handleError: (
    event: TReplySink,
    channel: ChannelEnum | string,
    errorCode: ErrorCode,
    detail?: string,
  ) => void;
  /** Believes the config on disk over the state, once a session. */
  adoptExistingApoConfig: () => boolean;
  hydrateActiveConvolution: () => boolean;
  syncCustomFxFromConfig: () => boolean;
  snapshot?: () => IEqualizerSnapshot;
}

/**
 * The state the window starts from, and the two switches that are the app's
 * rather than an output's: the engine on or off, and the graph shown.
 */
const registerEngineStateIpc = ({
  state,
  userDataDir,
  updateConfigPath,
  handleUpdate,
  handleError,
  adoptExistingApoConfig,
  hydrateActiveConvolution,
  syncCustomFxFromConfig,
  snapshot,
}: IEngineStateIpcDeps) => {
  onWindowMessage(ChannelEnum.HEALTH_CHECK, async (event) => {
    const channel = ChannelEnum.HEALTH_CHECK;
    // Guarded end to end: this is an `ipcMain` listener, so a throw anywhere in
    // it is an unhandled rejection in main, which the crash handler answers by
    // ending the app. A health check that fails has to say so and stop.
    try {
      const res = await updateConfigPath(event, channel);
      if (res) {
        if (adoptExistingApoConfig() === false) {
          handleError(
            event,
            channel,
            ErrorCode.FAILURE,
            mainText('eq.refused.externalEq'),
          );
          return;
        }
        await handleUpdate(event, channel);
      }
    } catch (error) {
      log.error('The health check failed', error);
      handleError(event, channel, ErrorCode.FAILURE);
    }
  });

  onWindowMessage(ChannelEnum.GET_STATE, async (event) => {
    const channel = ChannelEnum.GET_STATE;
    // Guarded for the same reason as the health check above: this is the real
    // one, the request every launch and every Retry makes.
    try {
      // A false answer has already been replied to, with the reason it failed.
      // Replying CONFIG_NOT_FOUND on top of it sent a second answer to a
      // request that had its first — one that could land on the NEXT
      // GET_STATE and replace its real error with the wrong one.
      if (!(await updateConfigPath(event, channel))) {
        return;
      }
      if (hydrateActiveConvolution()) {
        save(state, userDataDir);
      }
      // The custom file is user-editable and intentionally not part of the
      // generated profile. Re-read it whenever the renderer asks for state so
      // a Config inspector edit is reflected in the graph without a restart.
      syncCustomFxFromConfig();
      const reply: TSuccess<IEqualizerSnapshot> = {
        result: snapshot?.() ?? state,
      };
      event.reply(channel, reply);
    } catch (error) {
      log.error('Reading the state failed', error);
      handleError(event, channel, ErrorCode.FAILURE);
    }
  });

  onWindowMessage(ChannelEnum.GET_ENABLE, async (event) => {
    const reply: TSuccess<boolean> = { result: !!state.isEnabled };
    event.reply(ChannelEnum.GET_ENABLE, reply);
  });

  // A switch is a boolean or it is not a request: whatever arrived used to be
  // stored into the state and saved with it.
  onWindowMessage(ChannelEnum.SET_ENABLE, async (event, arg) => {
    const enabled: unknown = arg?.[0];
    if (typeof enabled !== 'boolean') {
      handleError(event, ChannelEnum.SET_ENABLE, ErrorCode.INVALID_PARAMETER);
      return;
    }
    state.isEnabled = enabled;
    await handleUpdate(event, ChannelEnum.SET_ENABLE);
  });

  onWindowMessage(ChannelEnum.SET_GRAPH_VIEW, async (event, arg) => {
    const shown: unknown = arg?.[0];
    if (typeof shown !== 'boolean') {
      handleError(
        event,
        ChannelEnum.SET_GRAPH_VIEW,
        ErrorCode.INVALID_PARAMETER,
      );
      return;
    }
    state.isGraphViewOn = shown;
    await handleUpdate(event, ChannelEnum.SET_GRAPH_VIEW);
  });
};

export default registerEngineStateIpc;
