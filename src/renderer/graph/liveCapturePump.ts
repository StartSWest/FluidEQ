/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import type { Dispatch, SetStateAction } from 'react';
import { announceOutputSignal, createSignalEdge } from '../audio/outputSignal';
import {
  createAxisCells,
  IAxisCell,
  readAbsoluteLevels,
} from '../utils/autoBalanceCapture';
import { IChartPointData } from './ChartController';
import type { ICaptureNodes } from './liveCaptureGraph';
import {
  connectDrawAnalyser,
  createLiveFrameReader,
  type ILiveFrameReader,
} from './liveFrameReader';
import { createLiveGraphBand } from './liveGraphBand';
import { connectSoundAnalysers, createLiveSound } from './liveSound';
import {
  CLIP_HOLD_MS,
  FFT_SIZE,
  LEVEL_FFT_SIZE,
  NO_POINTS,
  SILENT_WAVEFORM,
  TRACK_REFERENCE_RELEASE_DB,
  UPDATE_INTERVAL_MS,
  createFrameBuffers,
  createFrequencyAxis,
  detectClipping,
  getPeakLevel,
  isMeterAtRest,
  writeChannelWaveformPoints,
  writeFrequencyPoints,
} from './liveSpectrumFrames';
import {
  ILevelFollower,
  IOutputLevel,
  LEVEL_FLOOR_DB,
  advanceLevel,
  amplitudeToDb,
  createLevelFollower,
  readPeakAmplitude,
} from './outputLevel';

/** A value the hook keeps across renders, read and written by the pump. */
interface IBox<T> {
  current: T;
}

export interface ICapturePumpDeps {
  context: AudioContext;
  nodes: ICaptureNodes;
  /** The window cannot be seen: the pump has nothing to draw on. */
  isHiddenRef: IBox<boolean>;
  isPausedRef: IBox<boolean>;
  /** Cleared the moment sound is heard (`deviceChangedUnheardRef`). */
  deviceChangedUnheardRef: IBox<boolean>;
  pointsRef: IBox<IChartPointData[]>;
  isClippingRef: IBox<boolean>;
  /** Where the drawing's reader is put, and read from on every block. */
  frameReaderRef: IBox<ILiveFrameReader | undefined>;
  setPoints: Dispatch<SetStateAction<IChartPointData[]>>;
  setGraphPoints: Dispatch<SetStateAction<IChartPointData[]>>;
  setWaveform: Dispatch<SetStateAction<number[]>>;
  setOutputLevels: Dispatch<SetStateAction<IOutputLevel[]>>;
  setIsClipping: Dispatch<SetStateAction<boolean>>;
}

/**
 * What a live capture does with each block of audio: the spectrum's points,
 * the graphs' own reading, the meter and the waveform, published as frames.
 *
 * Builds the drawing's reader into `frameReaderRef` as it goes, and returns
 * the pump the capture's audio clock drives.
 */
const createCapturePump = ({
  context,
  nodes: { analyser, source, meterAnalysers },
  isHiddenRef,
  isPausedRef,
  deviceChangedUnheardRef,
  pointsRef,
  isClippingRef,
  frameReaderRef,
  setPoints,
  setGraphPoints,
  setWaveform,
  setOutputLevels,
  setIsClipping,
}: ICapturePumpDeps) => {
  const frequencyData = new Float32Array(analyser.frequencyBinCount);
  const axis = createFrequencyAxis(context.sampleRate);
  const cells: IAxisCell[] = createAxisCells(
    axis,
    context.sampleRate,
    FFT_SIZE,
  );
  const levelBuffer = new Float64Array(axis.length);
  const buffers = createFrameBuffers();
  // The graphs' own points, taken from the drawing's reader below.
  const graphBuffers = createFrameBuffers();
  let bufferSlot = 0;
  // Shared with the drawing's reader, which may see a new peak first.
  const trackReference: { current: number | undefined } = {
    current: undefined,
  };
  const isSignalEdge = createSignalEdge();
  frameReaderRef.current = createLiveFrameReader({
    analyser: connectDrawAnalyser(context, source),
    channelAnalysers: meterAnalysers,
    axis,
    cells,
    graph: createLiveGraphBand(context, source, FFT_SIZE),
    trackReference,
    // The display pump skips hidden windows. Wallpaper reads still need a
    // reference that follows quieter music.
    releaseReference: () => isHiddenRef.current,
    sound: createLiveSound(connectSoundAnalysers(context, source)),
  });

  // One block of samples, read into again per channel per tick, and the
  // ballistics that carry each channel's two readings between ticks.
  const meterSamples = meterAnalysers.map(
    () => new Float32Array(LEVEL_FFT_SIZE),
  );
  const meterFollowers: ILevelFollower[] = meterAnalysers.map(() =>
    createLevelFollower(),
  );
  // Kept per channel. The spectrum analyser combines the stereo signal,
  // which can cancel a rail in one side and can never say which side
  // clipped. The meter already owns discrete float samples, so those are
  // the only honest source for both the channel warning and the global OR.
  const meterClipUntilMs = meterAnalysers.map(() => 0);
  // Published in pairs for the same reason the points are: React needs a
  // changed identity to re-render, so the frame it is holding must not be
  // the one being overwritten. Two channels of two numbers is not much to
  // allocate, but it would be allocated thirty times a second forever.
  //
  // The waveform's pair and these share `levelSlot`, which says which one
  // React holds and flips only when a frame is published. Resting in
  // silence publishes nothing, so flipping every tick would have written
  // the first loud frame into the array React already held and handed it
  // back under the same identity: no render, and sound returning unseen.
  let levelSlot = 0;
  let isMeterResting = false;
  const meterFrames: [IOutputLevel[], IOutputLevel[]] = [
    meterAnalysers.map(() => ({
      levelDb: LEVEL_FLOOR_DB,
      peakDb: LEVEL_FLOOR_DB,
      isClipping: false,
    })),
    meterAnalysers.map(() => ({
      levelDb: LEVEL_FLOOR_DB,
      peakDb: LEVEL_FLOOR_DB,
      isClipping: false,
    })),
  ];
  // Wall clock rather than a frame count, because the fall rates are per
  // second and a tick is handled late whenever the renderer is busy.
  let lastMeterMs = performance.now();

  // `audioMs` is the audio this tick stands for — see `audioClock.ts`.
  const pump = (audioMs: number) => {
    // Nothing to draw on: the entire frame is waste, down to the FFT the
    // analyser only computes when it is read. Smart EQ no longer measures
    // this stream — it hears the source (`rawSource.ts`) — so a hidden
    // window has nothing here to keep running.
    if (isHiddenRef.current || isPausedRef.current) {
      return;
    }

    analyser.getFloatFrequencyData(frequencyData);
    readAbsoluteLevels(frequencyData, cells, levelBuffer);
    const peak = getPeakLevel(frequencyData);
    // Sound starting is the moment Windows is known to be playing through
    // this output — see `outputSignal.ts` for who needs to know.
    if (isSignalEdge(peak !== undefined)) {
      announceOutputSignal(context);
    }

    let reference: number | undefined;
    if (peak !== undefined) {
      // Heard, so whatever device came or went since was not this one.
      deviceChangedUnheardRef.current = false;
      // Instant attack, slow release: follows the track, ignores the
      // volume knob, and never lets a transient push the curve off-scale.
      // The release is per tick, scaled by the audio this tick actually
      // stands for.
      trackReference.current =
        trackReference.current === undefined
          ? peak
          : Math.max(
              peak,
              trackReference.current -
                (TRACK_REFERENCE_RELEASE_DB * audioMs) / UPDATE_INTERVAL_MS,
            );
      reference = trackReference.current;
    }

    // Alternate buffers: React needs a changed identity to re-render, so
    // the frame it is holding must not be the one being overwritten.
    bufferSlot = bufferSlot === 0 ? 1 : 0;
    if (reference === undefined) {
      if (pointsRef.current.length > 0) {
        pointsRef.current = NO_POINTS;
        setPoints(pointsRef.current);
        setGraphPoints(NO_POINTS);
      }
    } else {
      pointsRef.current = writeFrequencyPoints(
        buffers.points[bufferSlot],
        axis,
        levelBuffer,
        reference,
      );
      setPoints(pointsRef.current);
      // The drawing's own reading of this block, copied because the
      // reader reuses its frame. It used to be measured here a second
      // time, with a long window of its own: two 16384-point transforms
      // per block for one graph. The reader does its work once per
      // block of audio however many ask (`liveFrameReader.ts`), and the
      // picture the canvas falls back on between fresh reads is then
      // the one it drew.
      const drawn = frameReaderRef.current?.read().graphPoints ?? NO_POINTS;
      if (drawn.length === 0) {
        setGraphPoints(NO_POINTS);
      } else {
        const target = graphBuffers.points[bufferSlot];
        drawn.forEach(({ x, y }, index) => {
          target[index].x = x;
          target[index].y = y;
        });
        setGraphPoints(target);
      }
    }
    /*
     * The meter, in real decibels below full scale.
     *
     * Read here rather than beside the FFT above because it is
     * presentation and nothing else — no measurement consults it, so
     * behind a hidden window it is pure waste. The ballistics carry on
     * from wherever they were when the window went away; the attack is
     * instant, so the first visible frame is already correct and only the
     * fall has any catching up to do.
     *
     * Clamped, because a window that has been minimised for an hour hands
     * back an hour as its first delta and would drop the meter to the
     * floor in a single step for no reason anybody watching could name.
     */
    const meterNowMs = performance.now();
    const meterDeltaMs = Math.min(200, Math.max(0, meterNowMs - lastMeterMs));
    lastMeterMs = meterNowMs;
    const nextLevelSlot = levelSlot === 0 ? 1 : 0;
    const meterFrame = meterFrames[nextLevelSlot];
    let anyChannelClipping = false;
    for (let channel = 0; channel < meterAnalysers.length; channel += 1) {
      const channelSamples = meterSamples[channel];
      meterAnalysers[channel].getFloatTimeDomainData(channelSamples);
      // A 45 ms clipped frame would disappear before the eye registers
      // it, but the hold must preserve the channel that actually railed.
      //
      // Railed samples, and nothing else. A peak at -1 dBFS used to
      // count as well, on the belief that Windows' loopback limits a
      // decibel under full scale; it called every loud record clipped
      // whether or not anything had touched it.
      const channelPeak = readPeakAmplitude(channelSamples);
      if (detectClipping(channelSamples)) {
        meterClipUntilMs[channel] = meterNowMs + CLIP_HOLD_MS;
      }
      const channelIsClipping = meterNowMs < meterClipUntilMs[channel];
      anyChannelClipping ||= channelIsClipping;
      const follower = advanceLevel(
        meterFollowers[channel],
        amplitudeToDb(channelPeak),
        meterDeltaMs,
      );
      meterFrame[channel].levelDb = follower.levelDb;
      meterFrame[channel].peakDb = follower.peakDb;
      meterFrame[channel].isClipping = channelIsClipping;
    }
    if (anyChannelClipping !== isClippingRef.current) {
      isClippingRef.current = anyChannelClipping;
      setIsClipping(anyChannelClipping);
    }
    const waveformFrame = writeChannelWaveformPoints(
      buffers.waveform[nextLevelSlot],
      meterSamples,
    );
    /*
     * Silence is published once, and then not again until sound returns.
     *
     * A visible window never went idle: silence was published here
     * thirty times a second for as long as it was open, a new waveform
     * and level pair every tick, so every consumer of the frame
     * re-rendered and both meters cleared and redrew the same rest. Now
     * the frame that brings the last reading down to rest goes out as
     * `SILENT_WAVEFORM`, and nothing after it, which is the rule
     * `points` already follows. Every tick until then still goes out,
     * so the meters reach the floor on the frames they always did; a
     * reading counted in frames finishes on its own clock from there.
     */
    const isAtRest = isMeterAtRest(waveformFrame, meterFrame);
    if (!isAtRest || !isMeterResting) {
      levelSlot = nextLevelSlot;
      setWaveform(isAtRest ? SILENT_WAVEFORM : waveformFrame);
      setOutputLevels(meterFrame);
    }
    isMeterResting = isAtRest;
  };
  return pump;
};

export default createCapturePump;
