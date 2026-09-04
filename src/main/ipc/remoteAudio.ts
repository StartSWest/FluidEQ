/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { BrowserWindow, ipcMain } from 'electron';
import {
  isLanRemoteAudioSignal,
  type TLanRestoreResult,
  type TRemoteAudioStopMode,
  type TRemoteAudioStreamMode,
} from '../../common/remoteAudio';
import {
  IRemoteAudioCapture,
  startRemoteAudioCapture,
} from '../remoteAudioCapture';
import { createRemoteAudioCredentialStore } from '../remoteAudioCredentials';
import startRemoteAudioHostSession from '../remoteAudioHostSession';
import createRemoteAudioLan from '../remoteAudioLan';

const LAN_SIGNAL_CHANNEL = 'remote-audio-lan-signal';
const LAN_AUDIO_CHANNEL = 'remote-audio-lan-audio';
const LAN_NETWORK_CHANNEL = 'remote-audio-lan-network';
const LAN_ERROR_CHANNEL = 'remote-audio-lan-error';

const asStreamMode = (value: unknown): TRemoteAudioStreamMode =>
  value === 'video' ? 'video' : 'music';

const asStopMode = (value: unknown): TRemoteAudioStopMode => {
  if (value === 'pause' || value === false) {
    return 'pause';
  }
  if (value === 'forget' || value === true) {
    return 'forget';
  }
  return 'keep-active';
};

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
    (stats) => sendToWindow(LAN_NETWORK_CHANNEL, stats),
  );
  const credentials = createRemoteAudioCredentialStore(userDataDir);
  let capture: IRemoteAudioCapture | undefined;
  let lastMeterAt = 0;

  const stopCapture = () => {
    capture?.close();
    capture = undefined;
    lastMeterAt = 0;
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
          // The transport owns the critical path. The visual meter is a
          // decimated renderer-only mirror and cannot delay a network packet.
          lan.sendAudio(chunk);
          const now = Date.now();
          if (now - lastMeterAt >= 33) {
            lastMeterAt = now;
            sendToWindow(LAN_AUDIO_CHANNEL, chunk);
          }
        } catch {
          failCapture();
        }
      },
      failCapture,
    );
  };
  const restoreSavedSender = async (requestedMode: unknown) => {
    const saved = credentials.readSender();
    if (!saved) {
      return undefined;
    }
    stopCapture();
    const listener = await lan.restoreJoin(saved.code);
    try {
      const streamMode = asStreamMode(requestedMode);
      lan.setStreamMode(listener.peerId, streamMode);
      lan.sendSignal({
        peerId: listener.peerId,
        signal: { kind: 'stream-mode', mode: streamMode },
      });
      await beginCapture(listener.peerId);
      credentials.activate('sender');
      return listener;
    } catch (error) {
      lan.stop();
      throw error;
    }
  };

  ipcMain.handle('remote-audio-lan-saved-role', () => credentials.role());
  ipcMain.handle(
    'remote-audio-lan-saved-sender-code',
    () => credentials.readSender()?.code,
  );
  ipcMain.handle('remote-audio-lan-restore', async (_event, streamMode) => {
    const saved = credentials.read();
    if (!saved) {
      return undefined;
    }
    if (saved.role === 'listener') {
      const session = await startRemoteAudioHostSession(
        lan,
        credentials,
        false,
      );
      credentials.write({ role: 'listener', ...session.credentials });
      return {
        role: 'listener',
        details: session.details,
      } satisfies TLanRestoreResult;
    }
    const listener = await restoreSavedSender(streamMode);
    if (!listener) {
      return undefined;
    }
    return { role: 'sender', listener } satisfies TLanRestoreResult;
  });
  ipcMain.handle('remote-audio-lan-host', async (_event, replaceCode) => {
    const session = await startRemoteAudioHostSession(
      lan,
      credentials,
      replaceCode === true,
    );
    try {
      credentials.write({ role: 'listener', ...session.credentials });
      return session.details;
    } catch (error) {
      lan.stop();
      throw error;
    }
  });
  ipcMain.handle(
    'remote-audio-lan-join',
    async (_event, code: unknown, streamMode: unknown) => {
      const listener = await lan.join(code);
      try {
        const mode = asStreamMode(streamMode);
        lan.setStreamMode(listener.peerId, mode);
        lan.sendSignal({
          peerId: listener.peerId,
          signal: { kind: 'stream-mode', mode },
        });
        await beginCapture(listener.peerId);
        credentials.write({ role: 'sender', code: String(code) });
        return listener;
      } catch (error) {
        lan.stop();
        throw error;
      }
    },
  );
  ipcMain.handle('remote-audio-lan-send', (_event, signal: unknown) => {
    if (
      isLanRemoteAudioSignal(signal) &&
      signal.signal.kind === 'stream-mode'
    ) {
      lan.setStreamMode(signal.peerId, signal.signal.mode);
    }
    lan.sendSignal(signal);
  });
  ipcMain.on('remote-audio-lan-audio-send', (_event, chunk: unknown) => {
    try {
      lan.sendAudio(chunk);
    } catch {
      sendToWindow(LAN_ERROR_CHANNEL, undefined);
    }
  });
  ipcMain.handle('remote-audio-lan-stop', (_event, requestedMode: unknown) => {
    stopCapture();
    lan.stop();
    const mode = asStopMode(requestedMode);
    if (mode === 'forget') {
      credentials.clear();
    } else if (mode === 'pause') {
      credentials.pause();
    }
  });

  return () => {
    stopCapture();
    lan.stop();
  };
};
