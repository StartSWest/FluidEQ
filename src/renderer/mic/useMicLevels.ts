/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The mic as the tab hears it: the stream the tab opens, what state that is
 * in, and the engine's own readings on the mic once it runs.
 *
 * The engine only runs on a mic while something records from it, so the tab
 * opens the mic itself while it is on screen, the way any recorder does, and
 * closes it when it is not. The stream asks Chromium for nothing of its own
 * (no echo cancelling, noise suppression or gain control): what is heard and
 * drawn is the engine's work, not the browser's. That stream comes out of the
 * capture effect, so it is what every other app receives — which is what
 * "Listen to myself" plays.
 *
 * The readings come from the engine's analysis link for that mic: the rack's
 * input peaks (the live Normalizer's tap), its output peaks, the compressor's
 * gains and the limiter's reduction. Read once per painted frame and never
 * while the window is hidden; one analysis reader exists for the whole
 * window, so the tab takes it while it is open and gives it back
 * (`read(null)`) when it closes.
 */

import { useEffect, useRef, useState } from 'react';
import { micInputFor } from '../../common/micInput';
import { reportError } from '../utils/logger';

export interface IMicLevel {
  /** Linear peak reaching the rack, 0 to 1. */
  input: number;
  /** Linear peak leaving it, 0 to 1. */
  output: number;
  /** The compressor's lowest band gain, dB, make-up included; absent off. */
  compressorGainDb?: number;
  /** The limiter's reduction, dB, never positive. */
  limiterDb: number;
  /** What the restoration took, dB, never positive (`IHostAnalysisDenoise`). */
  noiseTakenDb: number;
  /** The voice cleaner's blocks its worker missed in this reading's window. */
  late: number;
}

/**
 * Where the tab's own recording of the mic stands. `waiting` is open with no
 * reading from the engine yet: the engine has not been created on the mic,
 * which Windows decides (enhancements off, a driver that never loads it).
 */
export type TMicListen =
  'idle' | 'opening' | 'no-input' | 'blocked' | 'waiting' | 'live';

/** How many readings the picture keeps: a few seconds at 60 frames a second. */
export const MIC_HISTORY = 360;

const lowest = (values: readonly number[]) =>
  values.length > 0 ? Math.min(...values) : undefined;

/**
 * `history` is filled oldest first and read by the picture's own frame; the
 * newest reading is also in `latest`. Only `state` and `stream` render React,
 * and each changes a handful of times, never per frame.
 */
const useMicLevels = (
  guid: string | undefined,
  name: string,
  active: boolean,
): {
  history: React.MutableRefObject<IMicLevel[]>;
  latest: React.MutableRefObject<IMicLevel | undefined>;
  state: TMicListen;
  stream: MediaStream | undefined;
} => {
  const history = useRef<IMicLevel[]>([]);
  const latest = useRef<IMicLevel | undefined>(undefined);
  const [state, setState] = useState<TMicListen>('idle');
  const [stream, setStream] = useState<MediaStream>();

  useEffect(() => {
    const read = window.electron?.ipcRenderer?.readDspEngineAnalysis;
    history.current = [];
    latest.current = undefined;
    if (!active || !guid || typeof read !== 'function') {
      setState('idle');
      return undefined;
    }
    let disposed = false;
    let animation = 0;
    let opened: MediaStream | undefined;
    let hearing = false;
    setState('opening');

    const open = async () => {
      const deviceId = micInputFor(
        await navigator.mediaDevices.enumerateDevices(),
        name,
      );
      if (!deviceId) {
        if (!disposed) {
          setState('no-input');
        }
        return;
      }
      const result = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      if (disposed) {
        result.getTracks().forEach((track) => track.stop());
        return;
      }
      opened = result;
      setStream(result);
      setState(hearing ? 'live' : 'waiting');
    };
    open().catch((error: unknown) => {
      reportError('opening the microphone for its picture', error);
      if (!disposed) {
        setState('blocked');
      }
    });

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
              compressorGainDb: frame.dynamics?.active
                ? lowest(frame.dynamics.gainDb)
                : undefined,
              limiterDb: Math.min(0, frame.maximizerReductionDb),
              noiseTakenDb: Math.min(0, frame.denoise.reductionDb),
              late: frame.denoise.voiceUnderruns,
            };
            latest.current = level;
            history.current.push(level);
            if (history.current.length > MIC_HISTORY) {
              history.current.splice(0, history.current.length - MIC_HISTORY);
            }
          }
          // The engine answering is what "live" means; it stops answering
          // when Windows tears the effect down, and the line says so again.
          // Main answers `null` only when no engine is connected on the mic;
          // `undefined` is a connected engine with no frame newer than the
          // last read, which a 60 Hz paint asks for every other frame. Read
          // as silence, it flipped the live line and the readings between
          // live and waiting many times a second (Ivan, 2026-11-22: "a lot
          // of glitch in the text below the select").
          const now = result === undefined ? hearing : result !== null;
          if (now !== hearing) {
            hearing = now;
            if (opened) {
              setState(now ? 'live' : 'waiting');
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
      opened?.getTracks().forEach((track) => track.stop());
      setStream(undefined);
      read(null).catch((error: unknown) =>
        reportError('giving back the engine’s readings', error),
      );
    };
  }, [active, guid, name]);

  return { history, latest, state, stream };
};

export default useMicLevels;
