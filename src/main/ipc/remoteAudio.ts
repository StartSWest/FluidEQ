/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { BrowserWindow, ipcMain } from 'electron';
import { createRemoteAudioLan } from '../remoteAudioLan';

const LAN_SIGNAL_CHANNEL = 'remote-audio-lan-signal';
const LAN_AUDIO_CHANNEL = 'remote-audio-lan-audio';
const LAN_ERROR_CHANNEL = 'remote-audio-lan-error';

export interface IRemoteAudioIpcDeps {
  getMainWindow: () => BrowserWindow | null;
}

export const registerRemoteAudioIpc = ({
  getMainWindow,
}: IRemoteAudioIpcDeps): (() => void) => {
  const sendToWindow = (channel: string, value: unknown) => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, value);
    }
  };
  const lan = createRemoteAudioLan(
    (signal) => sendToWindow(LAN_SIGNAL_CHANNEL, signal),
    (chunk) => sendToWindow(LAN_AUDIO_CHANNEL, chunk),
    () => sendToWindow(LAN_ERROR_CHANNEL, undefined),
  );

  ipcMain.handle('remote-audio-lan-host', () => lan.startHost());
  ipcMain.handle('remote-audio-lan-join', (_event, code: unknown) =>
    lan.join(code),
  );
  ipcMain.handle('remote-audio-lan-send', (_event, signal: unknown) => {
    lan.sendSignal(signal);
  });
  ipcMain.on('remote-audio-lan-audio-send', (_event, chunk: unknown) => {
    try {
      lan.sendAudio(chunk);
    } catch {
      sendToWindow(LAN_ERROR_CHANNEL, undefined);
    }
  });
  ipcMain.handle('remote-audio-lan-stop', () => {
    lan.stop();
  });

  return lan.stop;
};
