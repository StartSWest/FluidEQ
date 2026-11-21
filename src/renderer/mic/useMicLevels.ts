/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The voice picture's two readings: what reaches the mic's rack and what
 * leaves it, from the engine's own measurements on that mic (the live
 * Normalizer's input peaks and the master tap's peaks).
 *
 * The engine only runs on a mic while something records from it, so the tab
 * opens the mic itself while it is on screen, the way any recorder does, and
 * closes it when it is not. The stream asks Chromium for nothing of its own
 * (no echo cancelling, noise suppression or gain control): what the picture
 * shows is the engine's work, not the browser's.
 *
 * Read once per painted frame and never while the window is hidden; one
 * analysis reader exists for the whole window, so the tab takes it while it
 * is open and gives it back (`read(null)`) when it closes.
 */

import { useEffect, useRef } from 'react';
import { reportError } from '../utils/logger';

export interface IMicLevel {
  /** Linear peak reaching the rack, 0 to 1. */
  input: number;
  /** Linear peak leaving it, 0 to 1. */
  output: number;
}

/** How many readings the picture keeps: a few seconds at 60 frames a second. */
export const MIC_HISTORY = 360;

/** The browser's input whose label is the mic's Windows name, if any. */
const inputFor = async (name: string): Promise<string | undefined> => {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const wanted = name.trim().toLowerCase();
  return devices.find(
    (device) =>
      device.kind === 'audioinput' &&
      device.label.trim().toLowerCase() === wanted,
  )?.deviceId;
};

/**
 * `history` is filled oldest first and read by the picture's own frame; the
 * newest reading is also in `latest`. Nothing here renders React.
 */
const useMicLevels = (
  guid: string | undefined,
  name: string,
  active: boolean,
): {
  history: React.MutableRefObject<IMicLevel[]>;
  latest: React.MutableRefObject<IMicLevel | undefined>;
} => {
  const history = useRef<IMicLevel[]>([]);
  const latest = useRef<IMicLevel | undefined>(undefined);

  useEffect(() => {
    const read = window.electron?.ipcRenderer?.readDspEngineAnalysis;
    if (!active || !guid || typeof read !== 'function') {
      return undefined;
    }
    let disposed = false;
    let animation = 0;
    let stream: MediaStream | undefined;
    history.current = [];
    latest.current = undefined;

    inputFor(name)
      .then((deviceId) =>
        deviceId
          ? navigator.mediaDevices.getUserMedia({
              audio: {
                deviceId: { exact: deviceId },
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
              },
            })
          : undefined,
      )
      .then((opened) => {
        if (disposed) {
          opened?.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = opened;
      })
      .catch((error: unknown) =>
        reportError('opening the microphone for its picture', error),
      );

    const paint = async () => {
      if (disposed) {
        return;
      }
      if (!document.hidden) {
        try {
          const result = await read(guid);
          if (disposed) {
            return;
          }
          if (result) {
            const { frame } = result;
            const level: IMicLevel = {
              input: Math.max(...frame.normalizer.inputPeaks),
              output: Math.max(...frame.peaks),
            };
            latest.current = level;
            history.current.push(level);
            if (history.current.length > MIC_HISTORY) {
              history.current.splice(0, history.current.length - MIC_HISTORY);
            }
          }
        } catch (error) {
          reportError('reading the microphone’s levels', error);
        }
      }
      if (!disposed) {
        animation = requestAnimationFrame(paint);
      }
    };
    animation = requestAnimationFrame(paint);

    return () => {
      disposed = true;
      cancelAnimationFrame(animation);
      stream?.getTracks().forEach((track) => track.stop());
      read(null).catch((error: unknown) =>
        reportError('giving back the engine’s readings', error),
      );
    };
  }, [active, guid, name]);

  return { history, latest };
};

export default useMicLevels;
