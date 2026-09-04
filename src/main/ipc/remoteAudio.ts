/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { BrowserWindow, ipcMain } from 'electron';
import type { TLanRestoreResult } from '../../common/remoteAudio';
import {
  IRemoteAudioCapture,
  startRemoteAudioCapture,
} from '../remoteAudioCapture';
import { createRemoteAudioCredentialStore } from '../remoteAudioCredentials';
import { createRemoteAudioLan } from '../remoteAudioLan';

const LAN_SIGNAL_CHANNEL = 'remote-audio-lan-signal';
const LAN_AUDIO_CHANNEL = 'remote-audio-lan-audio';
const LAN_ERROR_CHANNEL = 'remote-audio-lan-error';

export interface IRemoteAudioIpcDeps {
  getMainWindow: () => BrowserWindow | null;
  userDataDir: string;
}

export const registerRemoteAudioIpc = ({
  getMainWindow,
  userDataDir,
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
  const credentials = createRemoteAudioCredentialStore(userDataDir);
  let capture: IRemoteAudioCapture | undefined;

  const stopCapture = () => {
    capture?.close();
    capture = undefined;
  };
  const failCapture = () => {
    stopCapture();
    lan.stop();
    sendToWindow(LAN_ERROR_CHANNEL, undefined);
  };
  const beginCapture = async (peerId: string) => {
    if (process.platform !== 'win32') {
      return;
    }
    stopCapture();
    capture = await startRemoteAudioCapture(
      peerId,
      (chunk) => {
        try {
          lan.sendAudio(chunk);
          // The sender's monitor receives the same unmodified block after it
          // enters the encrypted transport. Playback still happens remotely.
          sendToWindow(LAN_AUDIO_CHANNEL, chunk);
        } catch {
          failCapture();
        }
      },
      failCapture,
    );
  };

  ipcMain.handle('remote-audio-lan-saved-role', () => credentials.role());
  ipcMain.handle('remote-audio-lan-restore', async () => {
    const saved = credentials.read();
    if (!saved) {
      return undefined;
    }
    if (saved.role === 'listener') {
      let session;
      try {
        session = await lan.startHost(saved);
      } catch {
        // Keep the identity secret but recover when another process took the
        // old ephemeral port while FluidEQ was closed. Saved senders discover
        // the replacement port through the authenticated LAN announcement.
        session = await lan.startHost({ port: 0, secret: saved.secret });
      }
      credentials.write({ role: 'listener', ...session.credentials });
      return {
        role: 'listener',
        details: session.details,
      } satisfies TLanRestoreResult;
    }
    stopCapture();
    const listener = await lan.restoreJoin(saved.code);
    try {
      await beginCapture(listener.peerId);
    } catch (error) {
      lan.stop();
      throw error;
    }
    return { role: 'sender', listener } satisfies TLanRestoreResult;
  });
  ipcMain.handle('remote-audio-lan-host', async () => {
    const session = await lan.startHost();
    try {
      credentials.write({ role: 'listener', ...session.credentials });
      return session.details;
    } catch (error) {
      lan.stop();
      throw error;
    }
  });
  ipcMain.handle('remote-audio-lan-join', async (_event, code: unknown) => {
    const listener = await lan.join(code);
    try {
      await beginCapture(listener.peerId);
      credentials.write({ role: 'sender', code: String(code) });
      return listener;
    } catch (error) {
      lan.stop();
      throw error;
    }
  });
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
  ipcMain.handle('remote-audio-lan-stop', (_event, forget: unknown) => {
    stopCapture();
    lan.stop();
    if (forget === true) {
      credentials.clear();
    }
  });

  return () => {
    stopCapture();
    lan.stop();
  };
};
