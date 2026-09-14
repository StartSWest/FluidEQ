/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How the host's messages reach the window, and which of them still do while
 * the window is minimised.
 *
 * Out of `ipc/dspHost.ts` because the two rules differ and the difference is
 * the part worth testing: a meter frame nobody can see is waste, and a
 * transport frame nobody can see is still what the Library player runs on.
 */
import { BrowserWindow } from 'electron';
import {
  INativeTransportFrame,
  transportFrameMoves,
} from '../../common/dsp/nativeTransport';
import { IHostTelemetry } from './wire';

export interface IDspHostPublisher {
  /** Analysis, state and diagnostics: sent only while not minimised. */
  publish: (channel: string, payload: unknown) => void;
  /** Telemetry, which the player needs whether or not anyone is looking. */
  publishTelemetry: (telemetry: IHostTelemetry) => void;
}

export const createDspHostPublisher = (
  getMainWindow: () => BrowserWindow | null,
): IDspHostPublisher => {
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
    if (!window || window.isDestroyed() || window.isMinimized()) {
      return;
    }
    window.webContents.send(channel, payload);
  };

  /** The last frame the window was sent, which is what its player now holds. */
  let told: INativeTransportFrame | undefined;

  /**
   * Telemetry is the Library player's clock, not only a meter.
   *
   * The renderer advances the queue on the frame that says a deck ended,
   * starts a crossfade off the playhead, and re-cues a track after a device
   * reopen from the generation. It went through `publish` with everything
   * else, so behind a minimised window the song played out, the frame saying
   * so was never sent, and the next track waited for the window to come back.
   *
   * A minimised window is therefore still sent every frame that changes what
   * the player reads — `transportFrameMoves` — which is one per quarter second
   * of playhead while a song plays and none while it is paused. The frames in
   * between change nothing it reads and stay behind, as they always did.
   *
   * Only while minimised. A visible window keeps the full stream, because the
   * renderer's transport store is written by more than telemetry — the mirror
   * claims a deck the moment one loads, and a released engine clears it — and
   * the steady stream is what corrects either within a frame.
   */
  const publishTelemetry = (telemetry: IHostTelemetry) => {
    const window = getMainWindow();
    if (!window || window.isDestroyed()) {
      return;
    }
    if (window.isMinimized() && !transportFrameMoves(told, telemetry)) {
      return;
    }
    told = telemetry;
    window.webContents.send('dsp-host-telemetry', telemetry);
  };

  return { publish, publishTelemetry };
};
