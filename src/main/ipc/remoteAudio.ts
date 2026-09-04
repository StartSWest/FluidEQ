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
  let sessionGeneration = 0;

  const beginSessionOperation = () => {
    sessionGeneration += 1;
    return sessionGeneration;
  };
  const sessionIsCurrent = (generation: number) =>
    sessionGeneration === generation;

  const stopCapture = () => {
    capture?.close();
    capture = undefined;
    lastMeterAt = 0;
  };
  const failCapture = (generation: number) => {
    if (!sessionIsCurrent(generation)) {
      return;
    }
    stopCapture();
    lan.stop();
    sendToWindow(LAN_ERROR_CHANNEL, undefined);
  };
  const beginCapture = async (peerId: string, generation: number) => {
    if (process.platform !== 'win32') {
      return sessionIsCurrent(generation);
    }
    stopCapture();
    const nextCapture = await startRemoteAudioCapture(
      peerId,
      (chunk) => {
        if (!sessionIsCurrent(generation)) {
          return;
        }
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
          failCapture(generation);
        }
      },
      () => failCapture(generation),
    );
    if (!sessionIsCurrent(generation)) {
      nextCapture.close();
      return false;
    }
    capture = nextCapture;
    return true;
  };
  const restoreSavedSender = async (
    requestedMode: unknown,
    generation: number,
  ) => {
    const saved = credentials.readSender();
    if (!saved) {
      return undefined;
    }
    stopCapture();
    const listener = await lan.restoreJoin(saved.code);
    try {
      if (!sessionIsCurrent(generation)) {
        return undefined;
      }
      const streamMode = asStreamMode(requestedMode);
      lan.setStreamMode(listener.peerId, streamMode);
      lan.sendSignal({
        peerId: listener.peerId,
        signal: { kind: 'stream-mode', mode: streamMode },
      });
      if (!(await beginCapture(listener.peerId, generation))) {
        return undefined;
      }
      credentials.activate('sender');
      return listener;
    } catch (error) {
      if (sessionIsCurrent(generation)) {
        lan.stop();
      }
      throw error;
    }
  };

  ipcMain.handle('remote-audio-lan-saved-role', () => credentials.role());
  ipcMain.handle(
    'remote-audio-lan-saved-sender-code',
    () => credentials.readSender()?.code,
  );
  ipcMain.handle('remote-audio-lan-restore', async (_event, streamMode) => {
    const generation = beginSessionOperation();
    stopCapture();
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
      if (!sessionIsCurrent(generation)) {
        return undefined;
      }
      credentials.write({ role: 'listener', ...session.credentials });
      return {
        role: 'listener',
        details: session.details,
      } satisfies TLanRestoreResult;
    }
    const listener = await restoreSavedSender(streamMode, generation);
    if (!listener) {
      return undefined;
    }
    return { role: 'sender', listener } satisfies TLanRestoreResult;
  });
  ipcMain.handle('remote-audio-lan-host', async (_event, replaceCode) => {
    const generation = beginSessionOperation();
    stopCapture();
    const session = await startRemoteAudioHostSession(
      lan,
      credentials,
      replaceCode === true,
    );
    try {
      if (!sessionIsCurrent(generation)) {
        throw new Error('LAN audio session was replaced.');
      }
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
      const generation = beginSessionOperation();
      stopCapture();
      const listener = await lan.join(code);
      try {
        if (!sessionIsCurrent(generation)) {
          throw new Error('LAN audio session was replaced.');
        }
        const mode = asStreamMode(streamMode);
        lan.setStreamMode(listener.peerId, mode);
        lan.sendSignal({
          peerId: listener.peerId,
          signal: { kind: 'stream-mode', mode },
        });
        if (!(await beginCapture(listener.peerId, generation))) {
          return undefined;
        }
        credentials.write({ role: 'sender', code: String(code) });
        return listener;
      } catch (error) {
        if (sessionIsCurrent(generation)) {
          lan.stop();
        }
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
    beginSessionOperation();
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
    beginSessionOperation();
    stopCapture();
    lan.stop();
  };
};
