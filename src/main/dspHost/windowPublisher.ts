/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How the host's messages reach the window, and which of them still do while
 * nobody can see it.
 *
 * Out of `ipc/dspHost.ts` because what a window away is owed is the part
 * worth testing: a frame nobody can see is waste, a window that comes back is
 * owed the newest of each state, and an event delivered late is a lie.
 */
import { BrowserWindow } from 'electron';
import { IHostTelemetry } from './wire';

export interface IDspHostPublisher {
  /** Analysis, state and diagnostics: sent only while the window is in sight. */
  publish: (channel: string, payload: unknown) => void;
  /** Telemetry, which the player needs whether or not anyone is looking. */
  publishTelemetry: (telemetry: IHostTelemetry) => void;
}

/**
 * The channels whose newest message is the whole of what they say, so the
 * newest is what a window coming back is owed. A diagnostic is an event, and
 * one delivered late would read as having just happened: those are dropped
 * while the window is away, as they were behind a minimised one, and main has
 * already written each of them to the log.
 */
const STATE_CHANNELS: ReadonlySet<string> = new Set([
  'dsp-host-analysis',
  'dsp-host-state',
]);

/**
 * Minimised, or hidden into the tray.
 *
 * Minimised was the only case this looked for, and the close button does not
 * minimise: it hides the window into the tray (`tray.ts`), where it answers
 * `isMinimized()` false. So a Library playing with the window put away still
 * took telemetry forty times a second, and the analysis frames too if the DSP
 * page had been left open — twelve kilobytes about twenty-three times a
 * second, each one an IPC message and a store write in a page nobody could
 * see. A cloaked window answers `isVisible()` true (`windowDwm.ts`) and is
 * still sent everything, because it is still drawing.
 */
const isOutOfSight = (window: BrowserWindow) =>
  window.isMinimized() || !window.isVisible();

export const createDspHostPublisher = (
  getMainWindow: () => BrowserWindow | null,
): IDspHostPublisher => {
  /** The last frame the window was sent, which is what its player now holds. */

  /**
   * The newest message of each state channel, and the newest telemetry frame,
   * held back while the window was out of sight and sent the moment it is
   * back.
   *
   * The page keeps whatever arrived last — the graphs draw the last spectrum,
   * the player reads the last frame — so a window brought back after the host
   * had stopped sending would otherwise show the frame from the moment it was
   * put away rather than the host's last word. While the host is still
   * sending, its next frame would correct that within 43 ms anyway.
   */
  const held = new Map<string, unknown>();
  let heldTelemetry: IHostTelemetry | undefined;
  /** The window whose return is awaited, and how to stop awaiting it. */
  let awaiting: { window: BrowserWindow; stop: () => void } | undefined;

  const sendHeld = (window: BrowserWindow) => {
    awaiting?.stop();
    awaiting = undefined;
    held.forEach((payload, channel) =>
      window.webContents.send(channel, payload),
    );
    held.clear();
    if (heldTelemetry) {
      window.webContents.send('dsp-host-telemetry', heldTelemetry);
      heldTelemetry = undefined;
    }
  };

  const awaitReturn = (window: BrowserWindow) => {
    if (awaiting?.window === window) {
      return;
    }
    awaiting?.stop();
    // `show` from the tray, `restore` from the taskbar. A window shown while
    // still minimised is not back yet, and waits for the other.
    const onBack = () => {
      if (!window.isDestroyed() && !isOutOfSight(window)) {
        sendHeld(window);
      }
    };
    window.on('show', onBack);
    window.on('restore', onBack);
    awaiting = {
      window,
      stop: () => {
        window.off('show', onBack);
        window.off('restore', onBack);
      },
    };
  };

  /**
   * Only while somebody can see it.
   *
   * The analysis frames alone are twelve kilobytes about twenty-three times a
   * second, and every one of them would become an IPC message, a
   * deserialisation and a store write for a window that is not being
   * composited. The same reasoning that stopped the AudioWorklet building
   * meter frames behind a minimised window applies to the process one boundary
   * further out.
   */
  const publish = (channel: string, payload: unknown) => {
    const window = getMainWindow();
    if (!window || window.isDestroyed()) {
      return;
    }
    if (isOutOfSight(window)) {
      if (STATE_CHANNELS.has(channel)) {
        held.set(channel, payload);
        awaitReturn(window);
      }
      return;
    }
    // Back by a way neither event reported: what was held goes first, and
    // never after something newer on its own channel.
    held.delete(channel);
    if (awaiting) {
      sendHeld(window);
    }
    window.webContents.send(channel, payload);
  };

  /**
   * Telemetry is a meter for the window now, and nothing more.
   *
   * It was the Library player's clock while the player lived in the window,
   * so a window out of sight was still sent every frame that moved the
   * playhead, or the next song waited for the window to come back. The
   * player is the core's now and reads the host directly
   * (`main/libraryPlayer/hostEngine.ts`), so out of sight the frames stay
   * behind like any other state, the newest sent when the window is back.
   */
  const publishTelemetry = (telemetry: IHostTelemetry) => {
    const window = getMainWindow();
    if (!window || window.isDestroyed()) {
      return;
    }
    if (isOutOfSight(window)) {
      heldTelemetry = telemetry;
      awaitReturn(window);
      return;
    }
    heldTelemetry = undefined;
    if (awaiting) {
      sendHeld(window);
    }
    window.webContents.send('dsp-host-telemetry', telemetry);
  };

  return { publish, publishTelemetry };
};
