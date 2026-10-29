/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron';
import log from 'electron-log';
import {
  isLanRemoteAudioSignal,
  type ILanHostDetails,
  type ILanRemoteAudioChunk,
  type ILanRemoteAudioSignal,
} from '../../common/remoteAudio';
import {
  IRemoteAudioCapture,
  startNetworkCapture,
  startRawSourceCapture,
} from '../remoteAudioCapture';
import { createRemoteAudioCredentialStore } from '../remoteAudioCredentials';
import startRemoteAudioHostSession from '../remoteAudioHostSession';
import type { IRemoteAudioLan } from '../remoteAudioLanTypes';
import createRemoteAudioBook from '../remoteAudioBook';
import createRemoteAudioLevels from '../remoteAudioLevels';
import { createRemoteAudioLinks } from '../remoteAudioLinks';
import createRemoteAudioPorts from '../remoteAudioPorts';
import { createSmoothLinks, createSmoothSwitch } from '../remoteAudioSmooth';
import { onWindowsAudioRestarted } from '../windowsAudioRestarts';
import onWindowMessage from './windowMessages';
import { registerRemoteAudioPlayback } from './remoteAudioPlayback';
import { setDspHostRawSharing } from './dspHost';
import {
  audioWorkerEnabled,
  enableAudioWorker,
  getAudioWorker,
  listenAudioWorker,
  stopAudioWorker,
} from '../shareAudio/host';

const LAN_SIGNAL_CHANNEL = 'remote-audio-lan-signal';
const LAN_AUDIO_CHANNEL = 'remote-audio-lan-audio';
const LAN_NETWORK_CHANNEL = 'remote-audio-lan-network';
const LAN_ERROR_CHANNEL = 'remote-audio-lan-error';
/** This computer's sound could not be captured for the network. */
const LAN_SENDING_FAILED_CHANNEL = 'remote-audio-lan-sending-failed';
/** Whether this computer's sound is going out to anyone, as it changes. */
const LAN_SENDING_CHANNEL = 'remote-audio-lan-sending';
/** The codes pasted here, as they change: the computers this one goes back
 * to, linked now or not. */
const LAN_JOINS_CHANNEL = 'remote-audio-lan-joins';
/** The raw-source capture stopped on its own — see `startRawSourceCapture`. */
const RAW_SOURCE_LOST_CHANNEL = 'raw-source-lost';

export interface IRemoteAudioIpcDeps {
  getMainWindow: () => BrowserWindow | null;
  userDataDir: string;
}

export const registerRemoteAudioIpc = ({
  getMainWindow,
  userDataDir,
}: IRemoteAudioIpcDeps): (() => void) => {
  if (process.platform === 'win32' && typeof app?.isPackaged === 'boolean') {
    enableAudioWorker();
  }
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
  const smoothSwitch = createSmoothSwitch(userDataDir);
  // Where the sound plays in this process (macOS and Linux) and the links
  // sent from it; on Windows the Share Audio service keeps its own.
  const smoothLinks = createSmoothLinks((peerId, smooth) => {
    const mode = smooth ? 'music' : 'video';
    ports.mode(peerId, mode);
    if (!audioWorkerEnabled() && link) {
      link.setStreamMode(peerId, mode);
    }
  });
  smoothLinks.setLocal(smoothSwitch.get());
  const levels = createRemoteAudioLevels();
  const streaming = new Set<string>();
  let stopWorkerEvents: (() => void) | undefined;
  const syncRouting = () => {
    if (!audioWorkerEnabled() || !link) {
      return;
    }
    getAudioWorker()
      .request('routing', {
        targets: networkTargets,
        receive: [...told.keys()]
          .filter((peerId) => links.hears(peerId))
          .map((peerId) => ({ peerId, volume: links.volume(peerId) })),
        smooth: smoothSwitch.get(),
      })
      .catch(() => sendToWindow(LAN_ERROR_CHANNEL, undefined));
  };
  /**
   * The window is told once that a computer's sound is arriving, and it
   * forgets that by itself whenever the sound stops: the other computer
   * pausing or turning off "Send my sound", or "Play it here" turned off
   * here. Main has to forget it at the same moments, or it never says so
   * again. It used to keep the peer for the life of the link, so after one
   * pause the sound played on with its lane dead: no wave, no delay, and
   * "Nothing playing" over music (Ivan, 2026-10-14).
   */
  const forgetArriving = (peerId: string) => {
    streaming.delete(peerId);
    ports.forget(peerId);
  };
  /**
   * What the window has been told about each open link, for a window that
   * comes after it. The links outlive the window — a reload, a main restart
   * of the renderer — and a new window asking for the running session used
   * to see no card for a computer whose sound was playing. Kept: the link
   * itself, what the other computer last said it does with it, and what its
   * bar last showed — never a press (`started`) or a switch's change
   * (`singlePlayer`), which happened once and are not to happen again.
   */
  const told = new Map<string, Map<string, ILanRemoteAudioSignal>>();
  const remember = (message: ILanRemoteAudioSignal) => {
    const { peerId, signal } = message;
    if (signal.kind === 'stop') {
      told.delete(peerId);
      return;
    }
    if (signal.kind === 'peer-ready') {
      told.set(peerId, new Map([['peer-ready', message]]));
      return;
    }
    const kept = told.get(peerId);
    if (!kept) {
      return;
    }
    if (signal.kind === 'stream-mode' && signal.duplex) {
      kept.set('stream-mode', message);
    } else if (signal.kind === 'now-playing') {
      const { started: _started, singlePlayer: _switch, ...described } = signal;
      kept.set('now-playing', { peerId, signal: described });
    }
  };
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
          remember(signal);
          if (signal.signal.kind === 'stream-mode') {
            smoothLinks.heard(peerId, signal.signal.mode);
          } else if (signal.signal.kind === 'stop') {
            smoothLinks.forget(peerId);
          }
          if (signal.signal.kind === 'peer-ready') {
            links.connected(
              peerId,
              signal.signal.deviceName,
              signal.signal.joined === true,
              signal.signal.computerId,
              signal.signal.introduced,
            );
          } else if (
            signal.signal.kind === 'stream-mode' &&
            signal.signal.duplex
          ) {
            links.heard(peerId, signal.signal.duplex);
            if (!links.hears(peerId)) {
              forgetArriving(peerId);
            }
          } else if (signal.signal.kind === 'stop') {
            links.disconnected(peerId);
            levels.forget(peerId);
            playback.remove(peerId);
            streaming.delete(peerId);
          }
          ports.signal(signal);
          sendToWindow(LAN_SIGNAL_CHANNEL, signal);
          syncRouting();
        },
        (arrived) => {
          // "Play it here" switched off, or the other computer saying it has
          // stopped sending: what was already on its way is dropped. A chunk
          // is decoded after the signal sent behind it has been read, so
          // without this the tail of a pause would announce the sound as
          // arriving again just after the pause had ended it.
          if (!links.hears(arrived.peerId)) {
            forgetArriving(arrived.peerId);
            return;
          }
          const chunk = levels.apply(arrived, links.volume(arrived.peerId));
          if (process.platform !== 'win32') {
            ports.audio(chunk);
            return;
          }
          playback.setSmooth(chunk.peerId, smoothLinks.smooth(chunk.peerId));
          playback.push(chunk);
          if (!streaming.has(chunk.peerId)) {
            streaming.add(chunk.peerId);
            sendToWindow('remote-audio-lan-streaming', chunk.peerId);
          }
        },
        () => {
          started = undefined;
          sendToWindow(LAN_ERROR_CHANNEL, undefined);
        },
        (stats) => sendToWindow(LAN_NETWORK_CHANNEL, stats),
        book,
      );
      if (audioWorkerEnabled()) {
        stopWorkerEvents = listenAudioWorker((event) => {
          if (event.type === 'streaming' && links.hears(event.peerId)) {
            streaming.add(event.peerId);
            sendToWindow('remote-audio-lan-streaming', event.peerId);
          }
        });
      }
    }
    return link;
  };
  const lan: IRemoteAudioLan = {
    start: (identity) => lanLink().start(identity),
    join: (code, fresh) => lanLink().join(code, fresh),
    unlink: (target) => lanLink().unlink(target),
    retry: () => lanLink().retry(),
    sendSignal: (message) => lanLink().sendSignal(message),
    sendAudio: (chunk) => lanLink().sendAudio(chunk),
    setStreamMode: (peerId, mode) => lanLink().setStreamMode(peerId, mode),
    stop: () => lanLink().stop(),
  };
  const credentials = createRemoteAudioCredentialStore(userDataDir);
  const { book, savedJoins, publishJoins, computerOfCode } =
    createRemoteAudioBook(credentials, (joins) =>
      sendToWindow(LAN_JOINS_CHANNEL, joins),
    );

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
    if (!audioWorkerEnabled()) {
      networkTargets.forEach((peerId) => {
        try {
          lan.sendAudio({ ...chunk, peerId });
        } catch {
          // That computer has just gone; its `stop` takes it off the list.
        }
      });
    }
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
          signal: {
            kind: 'stream-mode',
            // `music` while Smooth playback is on here, which makes the link
            // smooth at both ends, and `video`, the low-delay stream,
            // otherwise: the words of an old "Stream priority" choice, which
            // every version reads. One from before Smooth playback answers
            // `music` with a larger cushion of its own.
            mode: smoothSwitch.get() ? 'music' : 'video',
            duplex,
          },
        });
      } catch {
        // Gone already; a computer that comes back is told again.
      }
    },
    targetsChanged: (targets) => {
      networkTargets = targets;
      syncRouting();
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

  /**
   * Share Audio's network, started once and kept: this computer listening on
   * its own code, and joined to every computer whose code was pasted here.
   * Asking again while it runs answers from the running session, so opening
   * the page never drops a link.
   */
  let started: Promise<ILanHostDetails> | undefined;
  const resetSession = () => {
    told.clear();
    smoothLinks.clear();
    ports.reset();
    streaming.clear();
    playback.reset();
    links.reset();
  };
  const start = (): Promise<ILanHostDetails> => {
    if (!started) {
      resetSession();
      const starting = (async () => {
        const session = await startRemoteAudioHostSession(lan, credentials);
        credentials.writeIdentity(session.credentials);
        credentials.read().joins.forEach((code) => {
          try {
            lan.join(code, false);
          } catch {
            // A code that no longer reads is skipped, not fatal.
          }
        });
        return session.details;
      })();
      started = starting;
      starting.catch((error: unknown) => {
        // The window can only say "could not open that local connection";
        // what actually failed (a port, the network, the Share Audio
        // service) is written here, where a bug report collects it.
        log.error('Share Audio: the local link could not start', error);
        if (started === starting) {
          started = undefined;
        }
      });
    }
    // Asked again while running, the code is made from today's addresses:
    // `lan.start` on the running secret describes the session, nothing more.
    const running = started;
    return (async () => {
      await running;
      return (await startRemoteAudioHostSession(lan, credentials)).details;
    })();
  };

  ipcMain.handle(
    'remote-audio-lan-saved',
    () => credentials.read().identity !== undefined,
  );
  ipcMain.handle('remote-audio-lan-start', async (_event, replay: unknown) => {
    const details = await start();
    if (replay !== true) {
      return { details, joins: savedJoins(), links: [] };
    }
    // Captures outlive the window. A reloaded window otherwise never hears
    // the original start event and puts its Library rack back in the send.
    sendToWindow(LAN_SENDING_CHANNEL, networkCapture !== undefined);
    // A new window: every link is told again, and sound already arriving is
    // announced again with the next chunk, through a port of its own.
    [...streaming].forEach(forgetArriving);
    if (audioWorkerEnabled()) {
      getAudioWorker()
        .request('streams.replay')
        .catch(() => sendToWindow(LAN_ERROR_CHANNEL, undefined));
    }
    return {
      details,
      joins: savedJoins(),
      links: [...told.values()].flatMap((kept) => [...kept.values()]),
    };
  });
  ipcMain.handle('remote-audio-lan-join', async (_event, code: unknown) => {
    // A deliberate Link makes this pairing durable immediately, so it waits
    // through boot, sleep, Wi-Fi and the other computer's restarts until the
    // user explicitly unlinks.
    const normalizedCode = typeof code === 'string' ? code.trim() : '';
    await start();
    const joined = lan.join(normalizedCode, true);
    credentials.addJoin(
      normalizedCode,
      (saved) => computerOfCode(saved) === joined.computerId,
    );
    publishJoins();
    return joined;
  });
  ipcMain.handle('remote-audio-lan-unlink', (_event, target: unknown) => {
    if (typeof target !== 'object' || target === null) {
      throw new Error('Invalid Share Audio unlink.');
    }
    const { peerId, computerId } = target as Record<string, unknown>;
    lan.unlink({
      ...(typeof peerId === 'string' ? { peerId } : {}),
      ...(typeof computerId === 'string' ? { computerId } : {}),
    });
    publishJoins();
  });
  ipcMain.handle('remote-audio-lan-both-ways', (_event, value: unknown) => {
    // Windows always plays both ways; Linux only once the window has found
    // the engine's own Share Audio endpoints.
    if (process.platform === 'linux') {
      links.setBothWays(value === true);
    }
  });
  ipcMain.handle('remote-audio-lan-retry', () => {
    if (started) {
      lan.retry();
      startNetworkCaptureIfWanted();
    }
  });
  /**
   * This computer's capture and the window's player, opened again. A fresh
   * capture lease reacquires the stream; target switches and receive gains
   * stay put. The window reopens its player on the resume message.
   */
  const reopenAudio = () => {
    if (process.platform === 'win32') {
      stopNetworkCapture();
      startNetworkCaptureIfWanted();
    }
    sendToWindow('remote-audio-lan-resume', undefined);
  };
  const wake = () => {
    if (!started) {
      return;
    }
    // Windows can leave an open loopback stream silent after suspend.
    reopenAudio();
    lan.retry();
  };
  powerMonitor.on('resume', wake);
  // An engine switch restarts Windows audio, which ends both streams; the
  // network is untouched, so the links stay as they are.
  const stopHearingRestarts = onWindowsAudioRestarted(() => {
    if (started) {
      reopenAudio();
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
      syncRouting();
      [...streaming].forEach((peerId) => {
        if (!links.hears(peerId)) {
          forgetArriving(peerId);
        }
      });
    },
  );
  ipcMain.handle('remote-audio-lan-smooth', () => smoothSwitch.get());
  ipcMain.handle('remote-audio-lan-set-smooth', (_event, on: unknown) => {
    if (typeof on !== 'boolean') {
      throw new Error('Invalid Smooth playback switch.');
    }
    if (on === smoothSwitch.get()) {
      return;
    }
    smoothSwitch.set(on);
    smoothLinks.setLocal(on);
    links.retell();
    syncRouting();
  });
  ipcMain.handle('remote-audio-lan-switches-for', (_event, name: unknown) =>
    typeof name === 'string' ? links.switchesFor(name) : undefined,
  );
  onWindowMessage('remote-audio-lan-audio-send', (_event, chunk: unknown) => {
    try {
      lan.sendAudio(chunk);
    } catch {
      // A worklet chunk can already be queued when this peer disconnects.
      // Its transport stop removes that peer; the other authenticated PCs
      // stay connected. Match the native capture's per-peer handling above,
      // rather than clearing the whole renderer group on Linux/macOS.
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
    powerMonitor.removeListener('resume', wake);
    stopHearingRestarts();
    started = undefined;
    told.clear();
    resetSession();
    closeRawSource();
    // A link never built has nothing to stop, and quitting is no reason to
    // load it.
    link?.stop();
    ports.close();
    playback.close().catch(() => undefined);
    stopWorkerEvents?.();
    stopAudioWorker();
  };
};
