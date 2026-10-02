/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { BrowserWindow, ipcMain } from 'electron';
import {
  isLanRemoteAudioSignal,
  type ILanRemoteAudioChunk,
  type TLanRestoreResult,
  type TRemoteAudioStopMode,
} from '../../common/remoteAudio';
import {
  IRemoteAudioCapture,
  startNetworkCapture,
  startRawSourceCapture,
} from '../remoteAudioCapture';
import { createRemoteAudioCredentialStore } from '../remoteAudioCredentials';
import startRemoteAudioHostSession from '../remoteAudioHostSession';
import type { IRemoteAudioLan } from '../remoteAudioLanTypes';
import { decodePairingCode } from '../remoteAudioLanProtocol';
import { createRemoteAudioLinks } from '../remoteAudioLinks';
import createRemoteAudioPorts from '../remoteAudioPorts';
import onWindowMessage from './windowMessages';
import { registerRemoteAudioPlayback } from './remoteAudioPlayback';
import { setDspHostRawSharing } from './dspHost';

const LAN_SIGNAL_CHANNEL = 'remote-audio-lan-signal';
const LAN_AUDIO_CHANNEL = 'remote-audio-lan-audio';
const LAN_NETWORK_CHANNEL = 'remote-audio-lan-network';
const LAN_ERROR_CHANNEL = 'remote-audio-lan-error';
/** This computer's sound could not be captured for the network. */
const LAN_SENDING_FAILED_CHANNEL = 'remote-audio-lan-sending-failed';
/** Whether this computer's sound is going out to anyone, as it changes. */
const LAN_SENDING_CHANNEL = 'remote-audio-lan-sending';
/** The raw-source capture stopped on its own — see `startRawSourceCapture`. */
const RAW_SOURCE_LOST_CHANNEL = 'raw-source-lost';

/**
 * Every stream is the low-delay one, whatever was asked for.
 *
 * There was a "Stream priority" choice once — Game/Video against Music, a
 * short start against a safer one — and nothing is left of it that can change
 * a sample: the control is gone and the transport's own `setStreamMode`
 * returns without doing anything on both sides of the link. The word still
 * travels, in the `stream-mode` signal that now carries what each computer
 * does with a link, because two versions of the app have to agree on it.
 */
const STREAM_MODE = 'video';

const asStopMode = (value: unknown): TRemoteAudioStopMode => {
  if (value === 'pause' || value === false) {
    return 'pause';
  }
  if (value === 'forget' || value === true) {
    return 'forget';
  }
  if (value === 'unlink') {
    return 'unlink';
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
          const { peerId } = signal;
          if (signal.signal.kind === 'peer-ready') {
            links.connected(
              peerId,
              signal.signal.deviceName,
              signal.signal.joined === true,
            );
          } else if (
            signal.signal.kind === 'stream-mode' &&
            signal.signal.duplex
          ) {
            links.heard(peerId, signal.signal.duplex);
          } else if (signal.signal.kind === 'stop') {
            links.disconnected(peerId);
            playback.remove(peerId);
            streaming.delete(peerId);
          }
          ports.signal(signal);
          sendToWindow(LAN_SIGNAL_CHANNEL, signal);
        },
        (chunk) => {
          // "Play it here", switched off: the other computer was told and
          // stops sending, and whatever was already on its way is dropped.
          if (!links.plays(chunk.peerId)) {
            return;
          }
          if (process.platform !== 'win32') {
            ports.audio(chunk);
            return;
          }
          playback.push(chunk);
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

  /*
   * This computer's sound for the network: one capture, shared by every
   * computer it goes to, running only while it goes somewhere. It is the
   * capture that leaves the LAN audio helper's tree out, so nothing another
   * computer sends here can go back out in it.
   */
  let networkTargets: readonly string[] = [];
  let networkCapture: IRemoteAudioCapture | undefined;
  let networkGeneration = 0;
  let lastMeterAt = 0;
  const stopNetworkCapture = () => {
    networkGeneration += 1;
    if (networkCapture) {
      sendToWindow(LAN_SENDING_CHANNEL, false);
    }
    networkCapture?.close();
    networkCapture = undefined;
    lastMeterAt = 0;
    setDspHostRawSharing(false).catch(() =>
      sendToWindow(LAN_SENDING_FAILED_CHANNEL, undefined),
    );
  };
  const sendCaptured = (chunk: ILanRemoteAudioChunk) => {
    // The transport owns the critical path. The visual meter is a decimated
    // renderer-only mirror and cannot delay a network packet.
    networkTargets.forEach((peerId) => {
      try {
        lan.sendAudio({ ...chunk, peerId });
      } catch {
        // That computer has just gone; its `stop` takes it off the list.
      }
    });
    ports.analyze(chunk);
    const now = Date.now();
    if (now - lastMeterAt >= 33) {
      lastMeterAt = now;
      sendToWindow(LAN_AUDIO_CHANNEL, chunk);
    }
  };
  const startNetworkCaptureIfWanted = () => {
    if (
      process.platform !== 'win32' ||
      networkTargets.length === 0 ||
      networkCapture
    ) {
      return;
    }
    networkGeneration += 1;
    const generation = networkGeneration;
    const fail = () => {
      if (generation !== networkGeneration) {
        return;
      }
      stopNetworkCapture();
      sendToWindow(LAN_SENDING_FAILED_CHANNEL, undefined);
    };
    const begin = async () => {
      // The Library's player goes untouched first: its rack would otherwise
      // be in what this computer sends, and the other computer applies its
      // own.
      await setDspHostRawSharing(true);
      if (generation !== networkGeneration) {
        return;
      }
      const capture = await startNetworkCapture(sendCaptured, fail);
      if (generation !== networkGeneration) {
        capture.close();
        return;
      }
      networkCapture = capture;
      sendToWindow(LAN_SENDING_CHANNEL, true);
    };
    begin().catch(fail);
  };

  const links = createRemoteAudioLinks({
    announce: (peerId, duplex) => {
      try {
        lan.sendSignal({
          peerId,
          signal: { kind: 'stream-mode', mode: STREAM_MODE, duplex },
        });
      } catch {
        // Gone already; a computer that comes back is told again.
      }
    },
    targetsChanged: (targets) => {
      networkTargets = targets;
      if (targets.length === 0) {
        // Always the whole stop, a capture still starting included: it has
        // already put the Library's player into pass-through, and only the
        // stop takes it out again. Bumping the generation alone left the
        // Library without its rack for as long as the app ran.
        stopNetworkCapture();
      } else {
        startNetworkCaptureIfWanted();
      }
    },
    bothWays: process.platform === 'win32',
    userDataDir,
  });

  let sessionGeneration = 0;
  const beginSessionOperation = () => {
    sessionGeneration += 1;
    ports.reset();
    streaming.clear();
    playback.reset();
    links.reset();
    return sessionGeneration;
  };
  const sessionIsCurrent = (generation: number) =>
    sessionGeneration === generation;

  const joinSaved = async (code: string, generation: number) => {
    const listener = await lan.restoreJoin(code);
    if (!sessionIsCurrent(generation)) {
      return undefined;
    }
    // Joining connects the link (`peer-ready`), which tells the other
    // computer what this one does and starts the sound it is to get.
    credentials.activate('sender');
    return listener;
  };

  ipcMain.handle('remote-audio-lan-saved-role', () => credentials.role());
  ipcMain.handle(
    'remote-audio-lan-saved-sender-code',
    () => credentials.readSender()?.code,
  );
  ipcMain.handle('remote-audio-lan-restore', async () => {
    const generation = beginSessionOperation();
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
    const listener = await joinSaved(saved.code, generation);
    if (!listener) {
      return undefined;
    }
    return { role: 'sender', listener } satisfies TLanRestoreResult;
  });
  ipcMain.handle('remote-audio-lan-host', async (_event, replaceCode) => {
    const generation = beginSessionOperation();
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
  ipcMain.handle('remote-audio-lan-join', async (_event, code: unknown) => {
    const generation = beginSessionOperation();
    // A deliberate Link makes this pairing durable immediately, so it waits
    // through boot, sleep, Wi-Fi and the other computer's restarts until the
    // user explicitly unlinks.
    const normalizedCode = typeof code === 'string' ? code.trim() : '';
    decodePairingCode(normalizedCode);
    credentials.write({ role: 'sender', code: normalizedCode });
    try {
      const listener = await joinSaved(normalizedCode, generation);
      if (!listener) {
        throw new Error('LAN audio session was replaced.');
      }
      return listener;
    } catch (error) {
      if (sessionIsCurrent(generation)) {
        lan.stop();
      }
      throw error;
    }
  });
  ipcMain.handle('remote-audio-lan-send', (_event, signal: unknown) => {
    if (
      isLanRemoteAudioSignal(signal) &&
      signal.signal.kind === 'stream-mode'
    ) {
      // What this computer does with a link is main's to say (`links`).
      return;
    }
    lan.sendSignal(signal);
  });
  ipcMain.handle(
    'remote-audio-lan-switches',
    (_event, name: unknown, switches: unknown) => {
      if (typeof name !== 'string') {
        throw new Error('Invalid Share Audio switches.');
      }
      links.choose(name, switches);
    },
  );
  ipcMain.handle('remote-audio-lan-switches-for', (_event, name: unknown) =>
    typeof name === 'string' ? links.switchesFor(name) : undefined,
  );
  onWindowMessage('remote-audio-lan-audio-send', (_event, chunk: unknown) => {
    try {
      lan.sendAudio(chunk);
    } catch {
      sendToWindow(LAN_ERROR_CHANNEL, undefined);
    }
  });
  ipcMain.handle('remote-audio-lan-stop', (_event, requestedMode: unknown) => {
    beginSessionOperation();
    lan.stop();
    const mode = asStopMode(requestedMode);
    if (mode === 'forget') {
      credentials.clear();
    } else if (mode === 'unlink') {
      credentials.forgetSender();
    } else if (mode === 'pause') {
      credentials.pause();
    }
  });

  /*
   * Smart EQ's capture of the sound before FluidEQ processes it.
   *
   * Its own lease on the second output's capture, separate from the
   * network's and from every mirror's, so measuring never starts or stops the
   * sharing and sharing never starts or stops a measurement. One at a time: a
   * second "on" while it is open is the same capture, and "off" from anyone
   * closes it — the window has one Smart EQ and asks once.
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
    closeRawSource();
    // A link never built has nothing to stop, and quitting is no reason to
    // load it.
    link?.stop();
    ports.close();
    playback.close().catch(() => undefined);
  };
};
