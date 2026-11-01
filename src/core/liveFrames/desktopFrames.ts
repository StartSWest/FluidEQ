/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DRAW_SMOOTHING,
  FFT_SIZE,
  LEVEL_FFT_SIZE,
  METER_CHANNELS,
  NO_POINTS,
  TRACK_REFERENCE_RELEASE_DB,
  UPDATE_INTERVAL_MS,
  createAxisCells,
  createFrameBuffers,
  createFrequencyAxis,
  getPeakLevel,
  readAbsoluteLevels,
  readStereoImage,
  writeChannelWaveformPoints,
  writeFrequencyPoints,
  type IAxisCell,
  type IChartPointData,
} from '../../common/liveFrames';
import { createCoreAnalyser, type ICoreAnalyser } from './analyser';

/** What a desktop background is handed for one frame of its scene. */
export interface IDesktopFrame {
  points: IChartPointData[];
  waveform: number[];
  /** Balance and width; absent while what is heard is one channel. */
  stereo?: [number, number];
}

export interface IDesktopFrameReader {
  /** The heard sound's analyser, which every block is pushed into. */
  analyser: ICoreAnalyser;
  /**
   * The newest frame. Reads between two blocks of audio share one, and it is
   * overwritten when the next block arrives: hand it on, do not keep it.
   */
  read(): IDesktopFrame;
}

/**
 * A desktop background's frame of the music, made in the core the way the
 * window's drawing reader made one for a background (`liveFrameReader.ts`),
 * from the same arithmetic (`common/liveFrames.ts`):
 *
 * - due only once more audio has been heard, and averaged over the audio that
 *   passed, at the drawing's own rate (`DRAW_SMOOTHING`), so a background at
 *   144 Hz averages no harder than one at 60;
 * - its points against the track's own loudest bin, rising at once and
 *   falling by the reference's release over the audio heard — the release a
 *   background always had, being the reader behind a hidden window;
 * - its waveform and stereo image from the front pair's own samples, the
 *   meter's two thousand and forty-eight.
 */
export const createDesktopFrameReader = (): IDesktopFrameReader => {
  const analyser = createCoreAnalyser(FFT_SIZE, LEVEL_FFT_SIZE);
  const frequencyData = new Float32Array(FFT_SIZE / 2);
  const channelSamples = Array.from(
    { length: METER_CHANNELS },
    () => new Float32Array(LEVEL_FFT_SIZE),
  );
  const buffers = createFrameBuffers();
  const stereo: [number, number] = [0, 0];
  const frame: IDesktopFrame = {
    points: NO_POINTS,
    waveform: buffers.waveform[0],
  };
  let rate = 0;
  let axis: number[] = [];
  let cells: IAxisCell[] = [];
  let levels = new Float64Array(0);
  let trackReference: number | undefined;
  let readAt: number | undefined;

  return {
    analyser,
    read: () => {
      const at = analyser.audioMs();
      // Nothing heard yet is silence, with no axis to read it on.
      if (at === readAt || analyser.sampleRate() === 0) {
        return frame;
      }
      const elapsedMs =
        readAt === undefined
          ? Number.POSITIVE_INFINITY
          : Math.max(0, at - readAt);
      readAt = at;
      if (analyser.sampleRate() !== rate) {
        rate = analyser.sampleRate();
        axis = createFrequencyAxis(rate);
        cells = createAxisCells(axis, rate, FFT_SIZE);
        levels = new Float64Array(axis.length);
      }

      analyser.readFrequency(
        frequencyData,
        DRAW_SMOOTHING ** (elapsedMs / UPDATE_INTERVAL_MS),
      );
      readAbsoluteLevels(frequencyData, cells, levels);

      const heard = channelSamples.slice(0, analyser.channelCount());
      heard.forEach((samples, channel) =>
        analyser.readChannel(channel, samples),
      );
      frame.waveform = writeChannelWaveformPoints(buffers.waveform[0], heard);
      if (heard.length >= 2) {
        frame.stereo = readStereoImage(heard[0], heard[1], stereo);
      } else {
        delete frame.stereo;
      }

      // Silence is no points, as it is in the window, so a scene reads the
      // same "nothing is playing" from either.
      const peak = getPeakLevel(frequencyData);
      if (peak === undefined) {
        frame.points = NO_POINTS;
        return frame;
      }
      trackReference =
        trackReference === undefined
          ? peak
          : Math.max(
              trackReference -
                (Number.isFinite(elapsedMs)
                  ? (elapsedMs / UPDATE_INTERVAL_MS) *
                    TRACK_REFERENCE_RELEASE_DB
                  : 0),
              peak,
            );
      frame.points = writeFrequencyPoints(
        buffers.points[0],
        axis,
        levels,
        trackReference,
      );
      return frame;
    },
  };
};
