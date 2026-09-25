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
  startRawSourceCapture,
  startRemoteAudioCapture,
} from '../remoteAudioCapture';
import { createRemoteAudioCredentialStore } from '../remoteAudioCredentials';
import startRemoteAudioHostSession from '../remoteAudioHostSession';
import type { IRemoteAudioLan } from '../remoteAudioLanTypes';
import { decodePairingCode } from '../remoteAudioLanProtocol';
import createRemoteAudioPorts from '../remoteAudioPorts';
import onWindowMessage from './windowMessages';
import { registerRemoteAudioPlayback } from './remoteAudioPlayback';
import { setDspHostRawSharing } from './dspHost';

const LAN_SIGNAL_CHANNEL = 'remote-audio-lan-signal';
const LAN_AUDIO_CHANNEL = 'remote-audio-lan-audio';
const LAN_NETWORK_CHANNEL = 'remote-audio-lan-network';
const LAN_ERROR_CHANNEL = 'remote-audio-lan-error';
/** The raw-source capture stopped on its own — see `startRawSourceCapture`. */
const RAW_SOURCE_LOST_CHANNEL = 'raw-source-lost';

/**
 * Every listener gets the low-delay buffer, whatever was asked for.
 *
 * There was a "Stream priority" choice once — Game/Video against Music, a
 * short start against a safer one — and nothing is left of it that can change
 * a sample: the control is gone, this ignores what it is handed, and the
 * transport's own `setStreamMode` returns without doing anything on both
 * sides of the link. The request still travels because it is part of a wire
 * two versions of the app have to agree on; it decides nothing.
 *
 * Its six translated strings came off the page on 2026-09-20, so that a
 * choice nobody can make is not described in ten languages. Re-adding the
 * control means making the transport honour the mode first, not putting the
 * words back.
 */
const asStreamMode = (_value: unknown): TRemoteAudioStreamMode => 'video';

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
  const ports = createRemoteAudioPorts(getMainWindow, (peerId) =>
    sendToWindow('remote-audio-lan-streaming', peerId),
  );
  const playback = registerRemoteAudioPlayback(getMainWindow);
  const streaming = new Set<string>();
  let link: IRemoteAudioLan | undefined;
  /**
   * The LAN link, built the first time anything asks for it.
   *
   * `remoteAudioLan` brings `ws`, and `ws` brings Node's TLS, HTTPS and zlib
   * with it: imported at the top of this file, all of that was evaluated at
   * every launch for a feature most sessions never open. It is still in the
   * bundle; none of it runs until somebody shares audio or pairs a machine.
   */
  const lanLink = (): IRemoteAudioLan => {
    if (!link) {
      const { default: createRemoteAudioLan } =
        // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports -- deferred to first use, see above
        require('../remoteAudioLan') as typeof import('../remoteAudioLan');
      link = createRemoteAudioLan(
        (signal) => {
          if (signal.signal.kind === 'stop') {
            playback.remove(signal.peerId);
            streaming.delete(signal.peerId);
          }
          ports.signal(signal);
          sendToWindow(LAN_SIGNAL_CHANNEL, signal);
        },
        (chunk) => {
          if (process.platform !== 'win32') {
            ports.audio(chunk);
            return;
          }
          playback.push(chunk);
          ports.analyze(chunk);
          if (!streaming.has(chunk.peerId)) {
            streaming.add(chunk.peerId);
            sendToWindow('remote-audio-lan-streaming', chunk.peerId);
          }
        },
        () => sendToWindow(LAN_ERROR_CHANNEL, undefined),
        (stats) => sendToWindow(LAN_NETWORK_CHANNEL, stats),
      );
    }
    return link;
  };
  const lan: IRemoteAudioLan = {
    startHost: (hostCredentials) => lanLink().startHost(hostCredentials),
    restoreJoin: (code) => lanLink().restoreJoin(code),
    sendSignal: (message) => lanLink().sendSignal(message),
    sendAudio: (chunk) => lanLink().sendAudio(chunk),
    setStreamMode: (peerId, mode) => lanLink().setStreamMode(peerId, mode),
    stop: () => lanLink().stop(),
  };
  const credentials = createRemoteAudioCredentialStore(userDataDir);
  let capture: IRemoteAudioCapture | undefined;
  let lastMeterAt = 0;
  let sessionGeneration = 0;

  const beginSessionOperation = () => {
    sessionGeneration += 1;
    ports.reset();
    streaming.clear();
    playback.reset();
    return sessionGeneration;
  };
  const sessionIsCurrent = (generation: number) =>
    sessionGeneration === generation;

  const stopCapture = () => {
    capture?.close();
    capture = undefined;
    lastMeterAt = 0;
    setDspHostRawSharing(false).catch(() =>
      sendToWindow(LAN_ERROR_CHANNEL, undefined),
    );
  };
  const failCapture = (generation: number) => {
    if (!sessionIsCurrent(generation)) {
      return;
    }
    sessionGeneration += 1;
    stopCapture();
    lan.stop();
    sendToWindow(LAN_ERROR_CHANNEL, undefined);
  };
  const beginCapture = async (peerId: string, generation: number) => {
    if (process.platform !== 'win32') {
      return sessionIsCurrent(generation);
    }
    stopCapture();
    try {
      await setDspHostRawSharing(true);
      if (!sessionIsCurrent(generation)) {
        return false;
      }
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
            ports.analyze(chunk);
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
    } catch (error) {
      // Even a refused bypass command owns raw mode until it is explicitly
      // cleared. A failed start must not strand the Library in pass-through.
      failCapture(generation);
      throw error;
    }
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
      if (sessionIsCurrent(generation)) {
        lan.stop();
      }
      throw error;
    }
  });
  ipcMain.handle(
    'remote-audio-lan-join',
    async (_event, code: unknown, streamMode: unknown) => {
      const generation = beginSessionOperation();
      stopCapture();
      // A deliberate Connect makes this pairing durable immediately. Using
      // the restore path means the sender waits through boot, sleep, Wi-Fi,
      // and receiver restarts until the user explicitly presses Stop.
      const normalizedCode = typeof code === 'string' ? code.trim() : '';
      decodePairingCode(normalizedCode);
      credentials.write({ role: 'sender', code: normalizedCode });
      const listener = await lan.restoreJoin(normalizedCode);
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
        credentials.activate('sender');
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
  onWindowMessage('remote-audio-lan-audio-send', (_event, chunk: unknown) => {
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

  /*
   * Smart EQ's capture of the sound before FluidEQ processes it.
   *
   * Its own lease on the shared helper, separate from the LAN sender's and
   * from every mirror's, so measuring never starts or stops the sharing and
   * sharing never starts or stops a measurement. One at a time: a second
   * "on" while it is open is the same capture, and "off" from anyone closes
   * it — the window has one Smart EQ and asks once.
   */
  let rawSource: IRemoteAudioCapture | undefined;
  let rawSourceOpening: Promise<boolean> | undefined;
  const closeRawSource = () => {
    rawSource?.close();
    rawSource = undefined;
    rawSourceOpening = undefined;
  };
  ipcMain.handle('raw-source-capture', (event, enabled: unknown) => {
    if (event.sender !== getMainWindow()?.webContents) {
      return false;
    }
    if (enabled !== true) {
      closeRawSource();
      return false;
    }
    if (rawSource) {
      return true;
    }
    if (process.platform !== 'win32') {
      return false;
    }
    rawSourceOpening ??= startRawSourceCapture(
      (chunk) => ports.source(chunk),
      () => {
        closeRawSource();
        sendToWindow(RAW_SOURCE_LOST_CHANNEL, undefined);
      },
    )
      .then((capture) => {
        if (rawSourceOpening === undefined) {
          // Closed while it was opening: the answer is no capture.
          capture.close();
          return false;
        }
        rawSource = capture;
        return true;
      })
      .catch(() => {
        rawSourceOpening = undefined;
        return false;
      });
    return rawSourceOpening;
  });

  return () => {
    beginSessionOperation();
    stopCapture();
    closeRawSource();
    // A link never built has nothing to stop, and quitting is no reason to
    // load it.
    link?.stop();
    ports.close();
    playback.close().catch(() => undefined);
  };
};
