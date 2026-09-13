/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  type IAxisCell,
  readAbsoluteLevels,
} from '../utils/autoBalanceCapture';
import type { IChartPointData } from './ChartController';
import {
  FFT_SIZE,
  NO_POINTS,
  SPECTRUM_SMOOTHING,
  UPDATE_INTERVAL_MS,
  createFrameBuffers,
  getPeakLevel,
  writeChannelWaveformPoints,
  writeFrequencyPoints,
} from './liveSpectrumFrames';
import { readPeakAmplitude } from './outputLevel';

/**
 * The live spectrum and waveform as they are at the moment a frame is drawn.
 *
 * WHY A DRAWING DOES NOT TAKE THE PUMP'S FRAME. The capture itself is not
 * late: measured on the FluidEQ Engine against a WASAPI loopback of the same
 * endpoint, the analyser holds each sample within -2 to +9 ms of the time
 * Windows stamps it for the device (median +2.6 ms), and that loopback is
 * taken after the engine, so its own latency needs no correcting either. The
 * delay was added afterwards. The pump reads every 33 ms on a timer the
 * display knows nothing about, so the picture a scene drew was 16 ms old at
 * the median and up to 98 ms old when the renderer was busy — measured in the
 * running window — before any easing had its turn.
 *
 * Reading here, inside the animation frame, removes that wait entirely. The
 * pump keeps its own analyser and its own cadence for everything that is not
 * a drawing: Smart EQ's evidence, the clip warning, the React frame.
 *
 * WHY ITS OWN ANALYSER. `AnalyserNode` averages each transform with the one
 * before it, per read. A second reader on the pump's node would change the
 * averaging under Smart EQ's measurement, so the drawing reads a twin fed
 * from the same source.
 */
export interface ILiveFrame {
  points: IChartPointData[];
  waveform: number[];
  /**
   * Each real channel's loudest sample in the window, as a linear amplitude:
   * what the output meter needs, and what the pump's meter reading was
   * taken from 33 ms earlier.
   */
  channelPeaks: number[];
}

export interface ILiveFrameReader {
  /**
   * The newest frame. Callers between two blocks of audio share one, and it
   * is overwritten when the next block arrives: read it, do not keep it.
   */
  read(): ILiveFrame;
}

export interface ILiveFrameReaderOptions {
  /** The drawing's own analyser, `FFT_SIZE` wide, on the capture's source. */
  analyser: AnalyserNode;
  /** The discrete channel analysers the waveform is taken from. */
  channelAnalysers: readonly AnalyserNode[];
  axis: number[];
  cells: IAxisCell[];
  /**
   * The pump's track reference, shared. A louder frame seen here first raises
   * it, exactly as the pump would; only the pump lets it fall.
   */
  trackReference: { current: number | undefined };
  /**
   * How much audio has been rendered, in milliseconds; the analyser's own
   * context clock by default.
   */
  audioTimeMs?: () => number;
}

/**
 * The drawing's averaging, per `UPDATE_INTERVAL_MS`: the pump's, squared.
 *
 * The pump's 0.2 is a coefficient per 33 ms read, so a reader at display rate
 * rescales it by the audio that actually passed, or a 144 Hz screen would
 * average four times as hard as a 30 Hz one. Squared is half the time
 * constant, and that is measured, not chosen. Replaying a recorded track
 * through this pipeline, keeping the pump's constant flickered less than the
 * pump does today (1.30 dB of frame-to-frame curvature against 2.17 at 100 Hz)
 * but put the bass 10 to 15 ms behind where half of it does. Half flickers as
 * today does — 2.13 dB at 100 Hz, 3.95 against 3.61 at 60 Hz. None at all
 * flickered 75% more again at 100 Hz, which is a look nobody asked for.
 */
const DRAW_SMOOTHING = SPECTRUM_SMOOTHING ** 2;

/**
 * Keyed to the AUDIO clock, not the display's.
 *
 * The analyser only has something new once another block of audio has been
 * rendered, so the context's clock is what says a read is worth doing, and
 * how much time the averaging should span. Keyed to the animation frame
 * instead, the Studio stage — drawn after the title-bar waveform and the
 * readouts in the same frame — was handed a read taken 6 ms earlier at the
 * median and 53 ms earlier in a slow frame, although fresher audio had
 * already arrived. And a wall-clock gap between two reads says nothing about
 * how much music lies between the two transforms.
 */
export const createLiveFrameReader = ({
  analyser,
  channelAnalysers,
  axis,
  cells,
  trackReference,
  audioTimeMs = () => analyser.context.currentTime * 1000,
}: ILiveFrameReaderOptions): ILiveFrameReader => {
  const frequencyData = new Float32Array(analyser.frequencyBinCount);
  const levels = new Float64Array(axis.length);
  const buffers = createFrameBuffers();
  const channelSamples = channelAnalysers.map(
    (channel) => new Float32Array(channel.fftSize),
  );
  const frame: ILiveFrame = {
    points: NO_POINTS,
    waveform: buffers.waveform[0],
    channelPeaks: channelAnalysers.map(() => 0),
  };
  let readAt: number | undefined;

  return {
    read: () => {
      const at = audioTimeMs();
      if (at === readAt) {
        return frame;
      }
      const elapsedMs =
        readAt === undefined
          ? Number.POSITIVE_INFINITY
          : Math.max(0, at - readAt);
      readAt = at;

      analyser.smoothingTimeConstant =
        DRAW_SMOOTHING ** (elapsedMs / UPDATE_INTERVAL_MS);
      analyser.getFloatFrequencyData(frequencyData);
      readAbsoluteLevels(frequencyData, cells, levels);

      channelAnalysers.forEach((channel, index) => {
        channel.getFloatTimeDomainData(channelSamples[index]);
        frame.channelPeaks[index] = readPeakAmplitude(channelSamples[index]);
      });
      frame.waveform = writeChannelWaveformPoints(
        buffers.waveform[0],
        channelSamples,
      );

      // Silence is no points, as it is from the pump, so a drawing reads the
      // same "nothing is playing" from either.
      const peak = getPeakLevel(frequencyData);
      if (peak === undefined) {
        frame.points = NO_POINTS;
        return frame;
      }
      trackReference.current =
        trackReference.current === undefined
          ? peak
          : Math.max(trackReference.current, peak);
      frame.points = writeFrequencyPoints(
        buffers.points[0],
        axis,
        levels,
        trackReference.current,
      );
      return frame;
    },
  };
};

/** Build the drawing's analyser beside the pump's, on the same source. */
export const connectDrawAnalyser = (
  context: BaseAudioContext,
  source: AudioNode,
): AnalyserNode => {
  const analyser = context.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.minDecibels = -100;
  analyser.maxDecibels = 0;
  source.connect(analyser);
  return analyser;
};
