/* FluidEQ — GPL-3.0-or-later */

import { app, type BrowserWindow, type MessagePortMain } from 'electron';
import log from 'electron-log';
import {
  MAC_AUDIO_CAPTURE_PORT,
  type TMacAudioCaptureMessage,
} from '../../common/macAudioCapture';
import type { ISystemSound } from '../../core/systemSound/systemSound';
import onWindowMessage from '../ipc/windowMessages';

/**
 * The window's live displays on the Mac, through a port the window hands
 * over. What it carries is the core's sound — the one tap every listener
 * shares (`core/platform/macos/monitorTapSource.ts`) — so the graph never
 * opens a second tap beside the one the desktop backgrounds and the song
 * memories' clock already hear.
 *
 * The transferred port owns its listening, including renderer loss and
 * reloads: a new port replaces the old, and a port that closes stops
 * listening.
 */
const registerMacMonitorIpc = (
  getWindow: () => BrowserWindow | null,
  systemSound: ISystemSound,
) => {
  if (process.platform !== 'darwin') {
    return;
  }
  let active: { port: MessagePortMain; close(): void } | undefined;
  onWindowMessage(MAC_AUDIO_CAPTURE_PORT, (event) => {
    const window = getWindow();
    const [port] = event.ports;
    if (
      !window ||
      window.isDestroyed() ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      event.ports.length !== 1 ||
      !port
    ) {
      event.ports.forEach((candidate) => candidate.close());
      return;
    }
    let closed = false;
    let heard = false;
    let stopListening: (() => void) | undefined;
    const close = () => {
      if (closed) {
        return;
      }
      closed = true;
      if (active?.port === port) {
        active = undefined;
      }
      stopListening?.();
      stopListening = undefined;
    };
    const post = (value: TMacAudioCaptureMessage) => {
      if (closed) {
        return;
      }
      try {
        port.postMessage(value);
      } catch (error) {
        log.warn('Mac analyser port closed during delivery', error);
        close();
        port.close();
      }
    };
    const previous = active;
    previous?.close();
    previous?.port.close();
    active = { port, close };
    port.on('close', close);
    port.start();
    const listening = systemSound.listen({
      ready: () => {
        heard = true;
        post({ kind: 'ready' });
      },
      audio: (block) =>
        post({ kind: 'push', ...block, peerId: 'mac-loopback' }),
      // Before any sound, the tap could not open; after, it stopped.
      lost: () => {
        post({ kind: heard ? 'lost' : 'failed' });
        close();
        port.close();
      },
    });
    // Lost before `listen` returned: nothing is left to stop.
    if (closed) {
      listening();
    } else {
      stopListening = listening;
    }
  });
  app.once('will-quit', () => {
    const current = active;
    current?.close();
    current?.port.close();
  });
};

export default registerMacMonitorIpc;
