/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { BrowserWindow, IpcMainEvent } from 'electron';
import log from 'electron-log';
import {
  SYSTEM_SOUND_PORT_CHANNEL,
  type TSystemSoundMessage,
} from '../../common/systemSound';
import type { ISystemSound } from '../../core/systemSound/systemSound';
import onWindowMessage from './windowMessages';

/**
 * Hands what the core hears to the window, one port per capture the window
 * opens (`coreSystemOutput.ts`). The port's own end is the window letting
 * go — a capture stopped, a reload, a crash all close it — and the last one
 * to go stops the hearing (`systemSound.ts`).
 */
const registerSystemSoundPort = (
  getWindow: () => BrowserWindow | null,
  systemSound: ISystemSound,
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
    let isOpen = true;
    let hasBeenHeard = false;
    let stopListening: (() => void) | undefined;
    const close = () => {
      if (!isOpen) {
        return;
      }
      isOpen = false;
      stopListening?.();
      port.close();
    };
    const post = (message: TSystemSoundMessage) => {
      if (!isOpen) {
        return;
      }
      try {
        port.postMessage(message);
      } catch (error) {
        log.error('The live capture port closed during delivery', error);
        close();
      }
    };
    port.on('close', close);
    port.start();
    const stop = systemSound.listen({
      ready: () => {
        hasBeenHeard = true;
        post({ kind: 'ready' });
      },
      audio: (block) => post({ kind: 'push', ...block }),
      lost: () => {
        post({ kind: hasBeenHeard ? 'lost' : 'failed' });
        close();
      },
    });
    // `lost` can arrive inside `listen` itself — no way to hear on this
    // platform — and the port is closed by then, with nothing yet to stop.
    if (isOpen) {
      stopListening = stop;
    } else {
      stop();
    }
  };
  return onWindowMessage(SYSTEM_SOUND_PORT_CHANNEL, receivePort);
};

export default registerSystemSoundPort;
