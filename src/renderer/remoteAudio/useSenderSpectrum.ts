/* FluidEQ — GPL-3.0-or-later */

import { useEffect, useState } from 'react';
import {
  createAxisCells,
  readAbsoluteLevels,
} from '../utils/autoBalanceCapture';
import {
  createFrequencyAxis,
  getPeakLevel,
  writeFrequencyPoints,
} from '../graph/liveSpectrumFrames';
import {
  advanceLevel,
  amplitudeToDb,
  createLevelFollower,
  type IOutputLevel,
} from '../graph/outputLevel';
import type { IChartPointData } from '../graph/ChartController';
import openRemoteAudioPort from './openRemoteAudioPort';
import { SENDER_SPECTRUM_SIZE, type ISenderSpectrum } from './senderSpectrum';

interface ISenderFrame {
  points: IChartPointData[];
  waveform: number[];
  outputLevels: IOutputLevel[];
  isClipping: boolean;
}

const useSenderSpectrum = (enabled: boolean, paused: boolean) => {
  const [frame, setFrame] = useState<ISenderFrame>();
  useEffect(() => {
    if (!enabled) {
      setFrame(undefined);
      return undefined;
    }
    const url = new URL(
      process.env.NODE_ENV === 'production'
        ? './sender-spectrum.js'
        : '/sender-spectrum.dev.js',
      window.location.href,
    );
    const worker = new Worker(url);
    const abort = new AbortController();
    let cancelled = false;
    let animation = 0;
    let pending = false;
    let requestedAt = 0;
    let previousFrameAt = performance.now();
    let reference: number | undefined;
    let followers: ReturnType<typeof createLevelFollower>[] = [];
    worker.onmessage = ({ data }: MessageEvent<ISenderSpectrum>) => {
      pending = false;
      if (cancelled || paused || document.hidden) {
        return;
      }
      const now = performance.now();
      const delta = Math.min(200, Math.max(0, now - previousFrameAt));
      previousFrameAt = now;
      const axis = createFrequencyAxis(data.sampleRate);
      const levels = new Float64Array(axis.length);
      readAbsoluteLevels(
        data.frequency,
        createAxisCells(axis, data.sampleRate, SENDER_SPECTRUM_SIZE),
        levels,
      );
      const peak = getPeakLevel(data.frequency);
      reference =
        peak === undefined
          ? undefined
          : Math.max(peak, (reference ?? peak) - delta / 1000);
      if (followers.length !== data.peaks.length) {
        followers = data.peaks.map(() => createLevelFollower());
      }
      const outputLevels = data.peaks.map((value, index) => ({
        ...advanceLevel(followers[index], amplitudeToDb(value), delta),
        isClipping: value >= 1,
      }));
      setFrame({
        points:
          reference === undefined
            ? []
            : writeFrequencyPoints(
                axis.map(() => ({ x: 0, y: 0 })),
                axis,
                levels,
                reference,
              ),
        waveform: data.waveform,
        outputLevels,
        isClipping: outputLevels.some((level) => level.isClipping),
      });
    };
    // At most one display request is outstanding. A hidden/busy window cannot
    // accumulate FFT jobs, and the worker never backpressures the audio sender.
    const paint = (now: number) => {
      if (!document.hidden && !paused && !pending && now - requestedAt >= 33) {
        pending = true;
        requestedAt = now;
        worker.postMessage({ kind: 'read' });
      }
      animation = requestAnimationFrame(paint);
    };
    animation = requestAnimationFrame(paint);
    openRemoteAudioPort('analysis', abort.signal)
      .then((port) => {
        if (cancelled) {
          port.close();
        } else {
          worker.postMessage({ kind: 'attach', port }, [port]);
        }
        return undefined;
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        console.error('Could not attach the outgoing audio spectrum', error);
        setFrame(undefined);
        worker.terminate();
        cancelAnimationFrame(animation);
      });
    worker.onerror = (event) => {
      cancelled = true;
      abort.abort();
      console.error('Outgoing audio spectrum worker failed', event.message);
      setFrame(undefined);
      worker.terminate();
      cancelAnimationFrame(animation);
    };
    return () => {
      cancelled = true;
      abort.abort();
      cancelAnimationFrame(animation);
      worker.terminate();
    };
  }, [enabled, paused]);
  return enabled ? frame : undefined;
};

export default useSenderSpectrum;
