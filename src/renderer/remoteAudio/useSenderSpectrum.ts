/* FluidEQ — GPL-3.0-or-later */

import { useCallback, useEffect, useRef, useState } from 'react';
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
  createGraphSliceReader,
  followGraphReference,
  type IGraphSliceReader,
  writeGraphPoints,
} from '../graph/liveGraphBand';
import {
  advanceLevel,
  amplitudeToDb,
  createLevelFollower,
  type IOutputLevel,
} from '../graph/outputLevel';
import type { IChartPointData } from '../graph/ChartController';
import { reportError } from '../utils/logger';
import openRemoteAudioPort from './openRemoteAudioPort';
import { SENDER_SPECTRUM_SIZE, type ISenderSpectrum } from './senderSpectrum';

export interface ISenderFrame {
  points: IChartPointData[];
  /**
   * Across a graph's whole width, as the local capture's are; from the one
   * transform the sender makes, so without the local capture's longer window
   * for the bottom octaves (`liveGraphBand.ts`).
   */
  graphPoints: IChartPointData[];
  waveform: number[];
  outputLevels: IOutputLevel[];
  isClipping: boolean;
}

export interface ISenderSpectrumReader {
  frame: ISenderFrame | undefined;
  readFrame: () => Promise<ISenderFrame | undefined>;
}

interface IPendingRead {
  promise: Promise<ISenderFrame | undefined>;
  resolve: (frame: ISenderFrame | undefined) => void;
  hasExternalReader: boolean;
}

const noFrame = (): Promise<ISenderFrame | undefined> =>
  Promise.resolve(undefined);

const useSenderSpectrum = (
  enabled: boolean,
  paused: boolean,
): ISenderSpectrumReader => {
  const [frame, setFrame] = useState<ISenderFrame>();
  const requestReadRef = useRef(noFrame);
  const readFrame = useCallback(() => requestReadRef.current(), []);
  useEffect(() => {
    if (!enabled) {
      setFrame(undefined);
      requestReadRef.current = noFrame;
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
    let pendingRead: IPendingRead | undefined;
    let requestedAt = 0;
    let previousFrameAt = performance.now();
    let reference: number | undefined;
    let graphSlices: IGraphSliceReader | undefined;
    let followers: ReturnType<typeof createLevelFollower>[] = [];
    const finishPendingRead = (nextFrame: ISenderFrame | undefined) => {
      const pending = pendingRead;
      pendingRead = undefined;
      pending?.resolve(nextFrame);
    };
    const startRead = (hasExternalReader: boolean) => {
      if (cancelled || paused) {
        return noFrame();
      }
      if (pendingRead) {
        pendingRead.hasExternalReader ||= hasExternalReader;
        return pendingRead.promise;
      }
      let settleRead: IPendingRead['resolve'] = () => undefined;
      const promise = new Promise<ISenderFrame | undefined>((resolve) => {
        settleRead = resolve;
      });
      pendingRead = { promise, resolve: settleRead, hasExternalReader };
      requestedAt = performance.now();
      worker.postMessage({ kind: 'read' });
      return promise;
    };
    const requestExternalRead = () => startRead(true);
    requestReadRef.current = requestExternalRead;
    worker.onmessage = ({ data }: MessageEvent<ISenderSpectrum>) => {
      const pending = pendingRead;
      if (!pending || cancelled || paused) {
        finishPendingRead(undefined);
        return;
      }
      if (document.hidden && !pending.hasExternalReader) {
        finishPendingRead(undefined);
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
      // Slices of an octave, as the local graphs read, against the loudest
      // slice (`liveGraphBand.ts`); rebuilt only when the rate changes.
      if (graphSlices?.sampleRate !== data.sampleRate) {
        graphSlices = createGraphSliceReader(
          data.sampleRate,
          SENDER_SPECTRUM_SIZE,
        );
      }
      const graphLevels = graphSlices.read(data.frequency);
      const graphReference = followGraphReference(graphSlices, delta);
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
      const nextFrame = {
        points:
          reference === undefined
            ? []
            : writeFrequencyPoints(
                axis.map(() => ({ x: 0, y: 0 })),
                axis,
                levels,
                reference,
              ),
        graphPoints:
          reference === undefined || graphReference === undefined
            ? []
            : writeGraphPoints(
                graphSlices.axis.map(() => ({ x: 0, y: 0 })),
                graphSlices.axis,
                graphLevels,
                graphReference,
              ),
        waveform: data.waveform,
        outputLevels,
        isClipping: outputLevels.some((level) => level.isClipping),
      };
      // Background wallpaper pulls need the transformed frame, but publishing
      // it through React would wake the entire hidden renderer tree.
      if (!document.hidden) {
        setFrame(nextFrame);
      }
      finishPendingRead(nextFrame);
    };
    // At most one display request is outstanding. A hidden/busy window cannot
    // accumulate FFT jobs, and the worker never backpressures the audio sender.
    const paint = (now: number) => {
      if (
        !document.hidden &&
        !paused &&
        !pendingRead &&
        now - requestedAt >= 33
      ) {
        startRead(false);
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
        cancelled = true;
        abort.abort();
        finishPendingRead(undefined);
        reportError('Could not attach the outgoing audio spectrum', error);
        setFrame(undefined);
        worker.terminate();
        cancelAnimationFrame(animation);
      });
    worker.onerror = (event) => {
      cancelled = true;
      abort.abort();
      finishPendingRead(undefined);
      reportError('Outgoing audio spectrum worker failed', event.message);
      setFrame(undefined);
      worker.terminate();
      cancelAnimationFrame(animation);
    };
    return () => {
      cancelled = true;
      abort.abort();
      finishPendingRead(undefined);
      if (requestReadRef.current === requestExternalRead) {
        requestReadRef.current = noFrame;
      }
      cancelAnimationFrame(animation);
      worker.terminate();
    };
  }, [enabled, paused]);
  return { frame: enabled ? frame : undefined, readFrame };
};

export default useSenderSpectrum;
