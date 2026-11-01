/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { BrowserWindow, IpcMainEvent, MessagePortMain } from 'electron';
import { SYSTEM_SOUND_PORT_CHANNEL } from '../../common/systemSound';
import onWindowMessage from './windowMessages';

/**
 * Hands what the core hears to the window, one port per capture the window
 * opens (`coreSystemOutput.ts`). Main only checks who sent it: the window's
 * own top frame, one port. The port then goes to the core whole
 * (`coreProcess/coreClient.ts`), which sends its blocks down it; the port's
 * own end is the window letting go — a capture stopped, a reload, a crash all
 * close it — and the last one to go stops the hearing.
 */
const registerSystemSoundPort = (
  getWindow: () => BrowserWindow | null,
  attach: (port: MessagePortMain) => void,
): (() => void) => {
  const receivePort = (event: IpcMainEvent) => {
    const window = getWindow();
    const [port] = event.ports;
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      !port ||
      event.ports.length !== 1
    ) {
      event.ports.forEach((candidate) => candidate.close());
      return;
    }
    attach(port);
  };
  return onWindowMessage(SYSTEM_SOUND_PORT_CHANNEL, receivePort);
};

export default registerSystemSoundPort;
