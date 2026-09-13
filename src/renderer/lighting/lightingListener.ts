/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import { SCENE_TIME_WRAP_S } from 'common/sceneUniformContract';
import { getEaseFactor } from 'common/smoothing';
import { advanceEnergy, createEnergyState } from 'common/spectrumEnergy';
import workletUrl from '../remoteAudio/workletUrl';
import {
  createAxisCells,
  readAbsoluteLevels,
} from '../utils/autoBalanceCapture';
import type { ICaptureGraph } from '../graph/useLiveOutputSpectrum';
import {
  FFT_SIZE,
  NO_POINTS,
  TRACK_REFERENCE_RELEASE_DB,
  UPDATE_INTERVAL_MS,
  WAVEFORM_POINT_COUNT,
  createFrameBuffers,
  createFrequencyAxis,
  getPeakLevel,
  writeChannelWaveformPoints,
  writeFrequencyPoints,
} from '../graph/liveSpectrumFrames';
import {
  createSpectrumTexels,
  createWaveformTexels,
  fillSpectrumTexels,
  fillWaveformTexels,
} from '../graph/sceneUniforms';
import {
  LIGHTING_CLOCK_PROCESSOR,
  type ILightingSceneFrame,
} from './lightingSceneMessages';

/**
 * What the scene hears, measured for the lamps on the audio clock.
 *
 * The same measurement the graph's scene gets — the same analyser settings,
 * the same track-referenced decibel window, the same energy and beat — so the
 * lamps move with the music the way the picture does. Its own analyser on the
 * capture's source rather than the graph's frames, because the graph publishes
 * nothing while the window is hidden, and the desk is lit exactly when the
 * window is not being looked at.
 */

export interface ILightingListener {
  close(): void;
}

export interface IHeardFrame {
  frame: ILightingSceneFrame;
  /** Nothing is playing: the output measured below the silence floor. */
  silent: boolean;
}

export const startLightingListener = async (
  capture: ICaptureGraph,
  accent: [number, number, number],
  isPaused: () => boolean,
  onHeard: (heard: IHeardFrame) => void,
): Promise<ILightingListener> => {
  const { context, source } = capture;
  // Loaded into the capture's own context. A context that already has the
  // bundle (the output mirror uses it) resolves at once.
  await context.audioWorklet.addModule(workletUrl().href);

  const analyser = context.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.minDecibels = -100;
  analyser.maxDecibels = 0;
  // The graph's own value, and for the same reason: see useLiveOutputSpectrum.
  analyser.smoothingTimeConstant = 0.2;
  source.connect(analyser);

  const clock = new AudioWorkletNode(context, LIGHTING_CLOCK_PROCESSOR, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  // Silent, and connected all the way to the destination: a node the graph
  // does not pull toward an output is not guaranteed to be processed at all,
  // and an unprocessed clock never ticks.
  const mute = context.createGain();
  mute.gain.value = 0;
  source.connect(clock);
  clock.connect(mute).connect(context.destination);

  const frequencyData = new Float32Array(analyser.frequencyBinCount);
  const samples = new Float32Array(FFT_SIZE);
  const axis = createFrequencyAxis(context.sampleRate);
  const cells = createAxisCells(axis, context.sampleRate, FFT_SIZE);
  const levels = new Float64Array(axis.length);
  const buffers = createFrameBuffers();
  const waveformPoints = new Array<number>(WAVEFORM_POINT_COUNT).fill(0);
  const spectrum = createSpectrumTexels();
  const waveform = createWaveformTexels();
  const energy = createEnergyState();
  let reference: number | undefined;
  let timeSeconds = 0;
  let fade = 0;
  let closed = false;

  clock.port.onmessage = ({ data }: MessageEvent<unknown>) => {
    if (closed || typeof data !== 'number' || !Number.isFinite(data)) {
      return;
    }
    const deltaMs = data;
    let points = NO_POINTS;
    let peak: number | undefined;
    if (!isPaused()) {
      analyser.getFloatFrequencyData(frequencyData);
      readAbsoluteLevels(frequencyData, cells, levels);
      peak = getPeakLevel(frequencyData);
      if (peak !== undefined) {
        // The pump's follower, scaled from its tick to this one.
        const release =
          (TRACK_REFERENCE_RELEASE_DB * deltaMs) / UPDATE_INTERVAL_MS;
        reference =
          reference === undefined ? peak : Math.max(peak, reference - release);
        points = writeFrequencyPoints(
          buffers.points[0],
          axis,
          levels,
          reference,
        );
      }
      analyser.getFloatTimeDomainData(samples);
      writeChannelWaveformPoints(waveformPoints, [samples]);
    } else {
      waveformPoints.fill(0);
    }

    const heard = advanceEnergy(
      energy,
      points,
      MIN_GAIN,
      MAX_GAIN,
      deltaMs,
      points.length > 0,
    );
    fillSpectrumTexels(points, spectrum, MIN_GAIN, MAX_GAIN);
    fillWaveformTexels(waveformPoints, waveform);
    timeSeconds = (timeSeconds + deltaMs / 1000) % SCENE_TIME_WRAP_S;
    fade += (1 - fade) * getEaseFactor(deltaMs, 80);

    onHeard({
      frame: {
        timeSeconds,
        deltaMs,
        level: heard.level,
        beat: heard.beat,
        bands: [heard.bass, heard.mid, heard.treble],
        accent,
        fade,
        spectrum,
        waveform,
      },
      silent: peak === undefined,
    });
  };

  /**
   * Each connection this made, and only those: the capture's source feeds the
   * graph and the meters too. A capture that stopped first has already
   * disconnected its source from everything, and the browser answers a second
   * disconnect with InvalidAccessError — which here means the work is done.
   */
  const disconnect = (from: AudioNode, to?: AudioNode) => {
    try {
      if (to) {
        from.disconnect(to);
      } else {
        from.disconnect();
      }
    } catch (error) {
      if (!(
        error instanceof DOMException && error.name === 'InvalidAccessError'
      )) {
        throw error;
      }
    }
  };

  return {
    close: () => {
      closed = true;
      clock.port.onmessage = null;
      disconnect(source, analyser);
      disconnect(source, clock);
      disconnect(clock);
      disconnect(mute);
    },
  };
};
