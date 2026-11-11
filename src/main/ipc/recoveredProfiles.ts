/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import {
  RECOVERED_PROFILES_CHANNEL,
  RECOVERED_PROFILES_SEEN_CHANNEL,
  type IRecoveredProfile,
} from '../../common/recoveredProfiles';

/**
 * The outputs that had lost their profile at launch, for the window to say
 * once (`recoverMissingProfiles`). The window reads them when it opens and
 * says when the notice was put away; a window reloaded before that reads
 * them again, and after it reads nothing.
 */
const registerRecoveredProfilesIpc = ({
  getMainWindow,
  recovered,
  forget,
}: {
  getMainWindow: () => BrowserWindow | null;
  recovered: () => readonly IRecoveredProfile[];
  forget: () => void;
}) => {
  const fromWindow = (event: IpcMainInvokeEvent) =>
    event.sender === getMainWindow()?.webContents;
  ipcMain.handle(RECOVERED_PROFILES_CHANNEL, (event) =>
    fromWindow(event) ? recovered() : [],
  );
  ipcMain.handle(RECOVERED_PROFILES_SEEN_CHANNEL, (event) => {
    if (fromWindow(event)) {
      forget();
    }
  });
};

export default registerRecoveredProfilesIpc;
