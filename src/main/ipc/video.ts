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

import { ipcMain } from 'electron';
import log from 'electron-log';
import ChannelEnum from '../../common/channels';
import {
  clearVideoSession,
  openVideoLinkExternally,
  setVideoAdBlockEnabled,
} from '../videoBrowser';

/**
 * The Remote Media tab's three switches.
 *
 * No dependencies at all — the player's own privileges, partition and
 * navigation rules live in `videoBrowser.ts`, and these channels only ask it to
 * do things. Which is the shape every one of these modules is aiming at.
 */
export const registerVideoIpc = () => {
  ipcMain.on(ChannelEnum.SET_VIDEO_AD_BLOCK, (_event, arg) => {
    setVideoAdBlockEnabled(Boolean(arg[0]));
  });

  ipcMain.on(ChannelEnum.OPEN_VIDEO_LINK_EXTERNALLY, (_event, arg) => {
    openVideoLinkExternally(String(arg[0] ?? ''));
  });

  /**
   * Sign out of everything in the player.
   *
   * It replies even when the clear fails, and that is deliberate: the button is a
   * privacy control, so a silent failure would leave somebody believing they had
   * signed out of five accounts when they had not. The reply carries whether it
   * worked, and the renderer says which.
   */
  ipcMain.on(ChannelEnum.CLEAR_VIDEO_SESSION, async (event) => {
    try {
      await clearVideoSession();
      event.reply(ChannelEnum.CLEAR_VIDEO_SESSION, { result: true });
    } catch (ex) {
      log.error(`Failed to clear the video session: ${ex}`);
      event.reply(ChannelEnum.CLEAR_VIDEO_SESSION, { result: false });
    }
  });
};
