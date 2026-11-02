/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createAxisCells, readAbsoluteLevels } from 'common/autoBalanceCapture';
import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import { SCENE_TIME_WRAP_S } from 'common/sceneUniformContract';
import { getEaseFactor } from 'common/smoothing';
import { holdEnergy, type ISpectrumEnergy } from 'common/spectrumEnergy';
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
import type { ILightingSceneFrame } from './lightingSceneMessages';

/**
 * One frame for the lamps' scene, from what an analyser holds and what the
 * music is heard as: the spectrum against the track's own loudest, the
 * waveform, the scene's clock and its fade in. The window's listener makes
 * its frames with this (`lightingListener.ts`), on Chromium's analyser; the
 * lamps' C++ host makes its own (`LampListener`), and `lampFrameFixture.ts`
 * runs this very code on the analyser's clone to hold the two together.
 */

export interface IHeardFrame {
  frame: ILightingSceneFrame;
  /** Nothing is playing: the output measured below the silence floor. */
  silent: boolean;
}

/** What a frame reads of the sound: an `AnalyserNode`, or its clone. */
export interface ILampAnalyser {
  getFloatFrequencyData(target: Float32Array<ArrayBuffer>): void;
  getFloatTimeDomainData(target: Float32Array<ArrayBuffer>): void;
}

/**
 * Frames at `rate`, `deltaMs` of audio after the last; paused, the lamps
 * hold what they last showed, as the picture does. The frame is this maker's
 * own and is overwritten by the next: hand it on, never keep it.
 */
export const createLampFrameMaker = (
  rate: number,
  accent: [number, number, number],
  analyser: ILampAnalyser,
  music: () => ISpectrumEnergy,
): ((deltaMs: number, paused: boolean) => IHeardFrame) => {
  const frequencyData = new Float32Array(FFT_SIZE / 2);
  const samples = new Float32Array(FFT_SIZE);
  const axis = createFrequencyAxis(rate);
  const cells = createAxisCells(axis, rate, FFT_SIZE);
  const levels = new Float64Array(axis.length);
  const buffers = createFrameBuffers();
  const waveformPoints = new Array<number>(WAVEFORM_POINT_COUNT).fill(0);
  const spectrum = createSpectrumTexels();
  const waveform = createWaveformTexels();
  let last: ISpectrumEnergy | undefined;
  let reference: number | undefined;
  let timeSeconds = 0;
  let fade = 0;

  return (deltaMs, paused) => {
    let points = NO_POINTS;
    let peak: number | undefined;
    if (!paused) {
      analyser.getFloatFrequencyData(frequencyData);
      readAbsoluteLevels(frequencyData, cells, levels);
      peak = getPeakLevel(frequencyData);
      if (peak !== undefined) {
        // The pump's follower, scaled from its tick to this frame.
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

    const heard = paused && last ? holdEnergy(last) : music();
    last = heard;
    fillSpectrumTexels(points, spectrum, MIN_GAIN, MAX_GAIN);
    fillWaveformTexels(waveformPoints, waveform);
    timeSeconds = (timeSeconds + deltaMs / 1000) % SCENE_TIME_WRAP_S;
    fade += (1 - fade) * getEaseFactor(deltaMs, 80);

    return {
      frame: {
        timeSeconds,
        deltaMs,
        level: heard.level,
        beat: heard.beat,
        bands: [heard.bass, heard.mid, heard.treble],
        musicAccent: [heard.accent, heard.accentSerial],
        musicRun: [heard.run, heard.runSpeed],
        rhythm: heard.rhythm,
        voice: [heard.voice.open, heard.voice.pitch, heard.voice.sure],
        accent,
        fade,
        spectrum,
        waveform,
      },
      silent: peak === undefined,
    };
  };
};
