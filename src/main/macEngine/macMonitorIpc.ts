/* FluidEQ — GPL-3.0-or-later */

import { app, type BrowserWindow, type MessagePortMain } from 'electron';
import log from 'electron-log';
import {
  MAC_AUDIO_CAPTURE_PORT,
  type TMacAudioCaptureMessage,
} from '../../common/macAudioCapture';
import onWindowMessage from '../ipc/windowMessages';
import { startMacMonitorCapture } from './macNetworkCapture';

/** The transferred port owns its tap, including renderer loss and reloads. */
const registerMacMonitorIpc = (getWindow: () => BrowserWindow | null) => {
  if (process.platform !== 'darwin') {
    return;
  }
  let active: { port: MessagePortMain; close(): void } | undefined;
  let serial = Promise.resolve();
  const enqueue = (action: () => Promise<void>) => {
    serial = serial.then(action).catch((error: unknown) => {
      log.warn('Mac live output capture stopped', error);
    });
  };
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
    let capture: Awaited<ReturnType<typeof startMacMonitorCapture>> | undefined;
    const close = () => {
      if (closed) {
        return;
      }
      closed = true;
      if (active?.port === port) {
        active = undefined;
      }
      enqueue(async () => {
        await capture?.close();
        capture = undefined;
      });
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
    // Replacements wait for the previous stop acknowledgement before opening
    // the next tap. A late start cannot collide with its successor or leave
    // an unowned capture behind after Chromium disposes a renderer frame.
    const previous = active;
    previous?.close();
    previous?.port.close();
    active = { port, close };
    port.on('close', close);
    port.start();
    enqueue(async () => {
      if (closed) {
        return;
      }
      try {
        capture = await startMacMonitorCapture(
          (chunk) => post({ kind: 'push', ...chunk, peerId: 'mac-loopback' }),
          () => {
            post({ kind: 'lost' });
            close();
            port.close();
          },
        );
        if (closed) {
          await capture.close();
          capture = undefined;
          return;
        }
        post({ kind: 'ready' });
      } catch (error) {
        log.warn('Mac live output tap could not open', error);
        post({ kind: 'failed' });
        close();
        port.close();
      }
    });
  });
  app.once('will-quit', () => {
    const current = active;
    current?.close();
    current?.port.close();
  });
};

export default registerMacMonitorIpc;
