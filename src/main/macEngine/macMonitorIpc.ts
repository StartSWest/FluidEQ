/* FluidEQ — GPL-3.0-or-later */

import { app, type BrowserWindow, type MessagePortMain } from 'electron';
import { MAC_AUDIO_CAPTURE_PORT } from '../../common/macAudioCapture';
import type { ICorePort } from '../../core/process/coreServices';
import onWindowMessage from '../ipc/windowMessages';

/** The name the window's Mac capture configures its receiver with. */
const MAC_LOOPBACK_PEER = 'mac-loopback';

interface IMacPort extends ICorePort {
  /** Main ends it: replaced by a newer port, or the app quitting. */
  end(): void;
}

/**
 * The window's Mac port as the core's services see it: every block named as
 * the Mac's own loopback, which is the peer the window's receiver is
 * configured for (`macSystemOutputCapture.ts`), and ended either by the
 * window's end going or by main.
 */
const macPort = (port: MessagePortMain): IMacPort => {
  const closers = new Set<() => void>();
  let isEnded = false;
  const end = () => {
    if (isEnded) {
      return;
    }
    isEnded = true;
    closers.forEach((close) => close());
  };
  port.on('close', end);
  return {
    postMessage: (message) => {
      const push = message as { kind?: unknown };
      port.postMessage(
        push?.kind === 'push'
          ? { ...push, peerId: MAC_LOOPBACK_PEER }
          : message,
      );
    },
    on: (_event, listener) => closers.add(listener),
    start: () => port.start(),
    close: () => port.close(),
    end,
  };
};

/**
 * The window's live displays on the Mac, through a port the window hands
 * over. What it carries is the core's sound — the one tap every listener
 * shares (`core/platform/macos/monitorTapSource.ts`), heard by the core's
 * services in main because main holds the lease on the Mac helper — so the
 * graph never opens a second tap beside the one the desktop backgrounds and
 * the song memories' clock already hear.
 *
 * The transferred port owns its listening, including renderer loss and
 * reloads: a new port replaces the old, and a port that closes stops
 * listening.
 */
const registerMacMonitorIpc = (
  getWindow: () => BrowserWindow | null,
  attach: (port: ICorePort, gone: () => void) => void,
) => {
  if (process.platform !== 'darwin') {
    return;
  }
  let active: IMacPort | undefined;
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
    active?.end();
    const wrapped = macPort(port);
    active = wrapped;
    attach(wrapped, () => {
      if (active === wrapped) {
        active = undefined;
      }
    });
  });
  app.once('will-quit', () => active?.end());
};

export default registerMacMonitorIpc;
