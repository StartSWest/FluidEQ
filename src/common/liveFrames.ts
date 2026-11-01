/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { AUDIO_CLOCK_TICKS_PER_SECOND } from './audioClockRate';
import { MAX_GAIN, MIN_GAIN } from './constants';

/**
 * A frame of the live spectrum, as the window's graph and visualizers read it
 * and as the core reads it for the desktop backgrounds: the analysis axis,
 * the averaging, the track reference and the writers that turn an analyser's
 * reading into points and a waveform.
 *
 * Plain arithmetic over typed arrays, shared so the two read the music the
 * same way — a desktop background is the same visualizer as the graph's, and
 * one that heard it through other numbers would move differently beside it.
 * The window's own modules re-export these (`liveSpectrumFrames.ts`).
 */

/** One point of a curve: a frequency and a level. */
export interface IChartPointData {
  x: number;
  y: number;
}

/**
 * The analyser window, and the one source of lag nothing downstream can undo.
 *
 * An FFT describes a whole window of audio at once, so the result is only ever
 * as current as the middle of it: 4096 samples is 85ms of sound at 48kHz, and
 * a kick inside it is reported some 43ms after it actually hit. Easing,
 * interpolation and frame rate all sit after that and can only ever make the
 * delay smoother, never shorter.
 *
 * Halved, so the delay halves with it. The cost is resolution — 23Hz per bin
 * rather than 12 — which the log-spaced display bins down anyway everywhere
 * except the very bottom of the range, and which is a fair trade for a curve
 * that moves when the music does.
 */
export const FFT_SIZE = 2048;
export const MIN_FREQUENCY = 20;
export const MAX_FREQUENCY = 20000;
export const POINT_COUNT = 320;
export const WAVEFORM_POINT_COUNT = 96;
/**
 * How often the analyser is read, which is most of how late the picture is.
 *
 * This used to be `BALANCE_FRAME_INTERVAL_MS` — the Smart EQ measurement's
 * cadence — and the two have no reason to be the same number. Forty-five
 * milliseconds is a fine rate at which to accumulate minutes of listening; it
 * is a poor one at which to watch a kick, because the tick alone puts the
 * drawing up to a frame behind before anything eases it.
 *
 * Safe to shorten because the measurement is driven by elapsed time rather than
 * by frame count: it reads `timestampMs` and clamps the real delta, so more
 * frames give it the same answer in more pieces.
 *
 * Thirty a second rather than fifty, and the difference is not taste. Every
 * tick publishes into a context and re-renders the chart, so the tick is also a
 * render budget: at twenty milliseconds a render that overruns means the next
 * tick lands before the queue has drained, the chain never breaks, and React
 * gives up with "Maximum update depth exceeded" — which it did.
 *
 * Kept by the audio clock now, not by a timer (`audio/audioClock.ts`): the
 * capture's own context ticks every thirtieth of a second of audio it renders.
 * The interval this was the period of was throttled to once a second behind a
 * minimised window, and to once a minute after five, which is where a Smart EQ
 * measurement is usually left to run. This is the tick's length, and every
 * rate written per tick is scaled from it.
 */
export const UPDATE_INTERVAL_MS = 1000 / AUDIO_CLOCK_TICKS_PER_SECOND;

/**
 * The spectrum analyser's averaging, per `UPDATE_INTERVAL_MS` tick. Why it is
 * this number is written where the pump's analyser is built.
 */
export const SPECTRUM_SMOOTHING = 0.2;

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
export const DRAW_SMOOTHING = SPECTRUM_SMOOTHING ** 2;

// The live trace shows real decibels referenced to THE TRACK, not to the
// volume knob. Windows loopback carries whatever volume is set, so an absolute
// dBFS scale would make the curve collapse the moment the user turns the
// system down — which says nothing about the music.
//
// Instead a slow peak-follower tracks the programme's own level and becomes
// the 0 dB line at the top of the plot. Every dB below that is a real dB below
// the track's own peak, so the shape and the height both mean something at any
// volume. Actual distortion is detected separately, from railed samples, so
// clipping still shows even though the reference moves.
export const LIVE_FULL_SCALE_DB = MAX_GAIN;
/**
 * Reference release, in dB per frame. Rises instantly to a new peak so a louder
 * passage cannot overshoot the top, then falls about 1 dB per second — slow
 * enough to ride out a quiet bar, fast enough to follow a track change within a
 * few seconds.
 *
 * Derived from the tick rather than written as a number, because it is a rate
 * per frame and the frames got shorter. Left at the old 0.045 it would have
 * fallen at two and a half dB a second the moment the interval was cut, which
 * is the sort of thing that changes how the whole plot behaves while looking
 * like a performance fix.
 */
export const TRACK_REFERENCE_RELEASE_DB = UPDATE_INTERVAL_MS / 1000;
/** Below this the output is silence; there is no meaningful shape to show. */
export const LIVE_SILENCE_DB = -95;

/**
 * The level meter's window, and the one number in this file that must not be
 * shortened.
 *
 * The meter reads sample peaks out of `getFloatTimeDomainData`, which hands back
 * the most recent `fftSize` samples and nothing older. At 48kHz, 2048 samples is
 * 42ms — comfortably more than the 33ms between ticks, so every sample the
 * output produced is seen by at least one read. Halve it and the window stops
 * covering the gap: a transient that lands in the missing eleven milliseconds is
 * never measured at all, and the meter silently under-reads the exact events it
 * exists to catch.
 *
 * No smoothing on these analysers, unlike the spectrum's. The FFT's averaging is
 * there to stop a jittery bin from making a noisy curve; a peak reading has no
 * such problem, and blending it with the previous block is just a slower attack
 * bolted on underneath the ballistics that are supposed to own it.
 */
export const LEVEL_FFT_SIZE = 2048;
/**
 * How many channels the meter will ever show.
 *
 * Two, and taken off the front of whatever the endpoint delivers. A surround
 * mix down-mixes discretely through the splitter, so those two are front left
 * and front right rather than a fold-down of six — which is the honest reading
 * for a meter, since it is those two that are about to clip the headphones.
 */
export const METER_CHANNELS = 2;

/** Log-spaced analysis frequencies. Constant for a given sample rate. */
export const createFrequencyAxis = (sampleRate: number): number[] => {
  const logMin = Math.log10(MIN_FREQUENCY);
  const logMax = Math.log10(Math.min(MAX_FREQUENCY, sampleRate / 2));
  return Array.from(
    { length: POINT_COUNT },
    (_value, index) =>
      10 ** (logMin + (index / (POINT_COUNT - 1)) * (logMax - logMin)),
  );
};

/**
 * Buffers for a frame of curve or waveform, allocated once per capture and
 * filled in place.
 *
 * The pump publishes 320 points and 96 waveform samples ~22 times a second.
 * Building them fresh meant roughly 7,100 short-lived point objects a second
 * for a curve where only the numbers changed. They come in pairs because React
 * still needs a changed array identity to re-render: the pump alternates, so
 * the array React is holding is never the one being overwritten.
 */
export interface IFrameBuffers {
  points: [IChartPointData[], IChartPointData[]];
  waveform: [number[], number[]];
}

export const createFrameBuffers = (): IFrameBuffers => {
  const makePoints = () =>
    Array.from({ length: POINT_COUNT }, () => ({ x: 0, y: 0 }));
  return {
    points: [makePoints(), makePoints()],
    waveform: [
      new Array(WAVEFORM_POINT_COUNT).fill(0),
      new Array(WAVEFORM_POINT_COUNT).fill(0),
    ],
  };
};

/** Shared empty, so silence and teardown never mint a fresh array. */
export const NO_POINTS: IChartPointData[] = [];

export const writeFrequencyPoints = (
  target: IChartPointData[],
  axis: number[],
  levels: Float64Array,
  trackReferenceDb: number,
): IChartPointData[] => {
  for (let index = 0; index < target.length; index += 1) {
    const level = levels[index];
    // The track's own peak lands on the top gridline; everything below it is
    // a real dB below that peak.
    const plotted = Number.isFinite(level)
      ? level - trackReferenceDb + LIVE_FULL_SCALE_DB
      : MIN_GAIN;
    const point = target[index];
    point.x = axis[index];
    point.y = Math.min(MAX_GAIN, Math.max(MIN_GAIN, plotted));
  }
  return target;
};

/** Loudest finite bin in the frame, or undefined when the output is silent. */
export const getPeakLevel = (
  frequencyData: Float32Array,
): number | undefined => {
  let peak = -Infinity;
  for (let index = 0; index < frequencyData.length; index += 1) {
    const level = frequencyData[index];
    if (Number.isFinite(level) && level > peak) {
      peak = level;
    }
  }
  return peak > LIVE_SILENCE_DB ? peak : undefined;
};

/**
 * Build the titlebar waveform from the same discrete channel samples as the
 * L/R output meter.
 *
 * The spectrum analyser above receives Chromium's stereo fold-down. That is
 * correct for a frequency response, but it is not a reliable waveform source:
 * correlated channels with opposite polarity can nearly cancel in the fold
 * even while both output meters are loud. Taking the strongest absolute sample
 * from the real channel analysers keeps the compact waveform honest without
 * inventing gain or changing its dB readout.
 */
export const writeChannelWaveformPoints = (
  target: number[],
  channelSamples: readonly Float32Array[],
): number[] => {
  const sampleCount = channelSamples.reduce(
    (shortest, channel) => Math.min(shortest, channel.length),
    Number.POSITIVE_INFINITY,
  );
  if (!Number.isFinite(sampleCount) || sampleCount <= 0) {
    target.fill(0);
    return target;
  }

  const bucketSize = sampleCount / target.length;
  for (let index = 0; index < target.length; index += 1) {
    const start = Math.floor(index * bucketSize);
    const end = Math.max(start + 1, Math.floor((index + 1) * bucketSize));
    let peak = 0;
    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      for (let channel = 0; channel < channelSamples.length; channel += 1) {
        peak = Math.max(peak, Math.abs(channelSamples[channel][sampleIndex]));
      }
    }
    target[index] = peak;
  }
  return target;
};

/** Inclusive FFT bin range backing one point of the analysis axis. */
export interface IAxisCell {
  firstBin: number;
  lastBin: number;
}

/**
 * Map each axis point to every FFT bin inside its cell.
 *
 * Reading a single nearest bin per point — which is fine for a display trace —
 * looks at barely a tenth of the spectrum: at 48 kHz with a 4096-point FFT the
 * 1536 bins between 2 kHz and 20 kHz are represented by ~107 single-bin
 * samples, so ~93% of the treble energy is never seen and what is left is a
 * noisy lottery. Averaging the whole cell is what makes the treble reading
 * stable enough to drive an EQ.
 */
export const createAxisCells = (
  axis: readonly number[],
  sampleRate: number,
  fftSize: number,
): IAxisCell[] => {
  const binWidth = sampleRate / fftSize;
  const maxBin = Math.max(1, fftSize / 2 - 1);
  const clampBin = (bin: number, low: number) =>
    Math.min(maxBin, Math.max(low, bin));

  return axis.map((frequency, index) => {
    // Cell edges are the geometric midpoints to the neighbouring points, so
    // cells tile the axis without gaps or overlap.
    const lower =
      index === 0 ? frequency : Math.sqrt(axis[index - 1] * frequency);
    const upper =
      index === axis.length - 1
        ? frequency
        : Math.sqrt(frequency * axis[index + 1]);

    // Bin 0 is DC and carries no musical information.
    const firstBin = clampBin(Math.round(lower / binWidth), 1);
    const lastBin = clampBin(Math.round(upper / binWidth), firstBin);
    return { firstBin, lastBin };
  });
};

/**
 * Power mean of each cell, in absolute dBFS. Writes into `out` to avoid
 * allocating a new array on every analyser frame.
 */
export const readAbsoluteLevels = (
  frequencyData: Float32Array,
  cells: IAxisCell[],
  out: Float64Array,
): Float64Array => {
  cells.forEach((cell, index) => {
    let power = 0;
    let count = 0;
    const last = Math.min(cell.lastBin, frequencyData.length - 1);
    for (let bin = cell.firstBin; bin <= last; bin += 1) {
      const level = frequencyData[bin];
      if (Number.isFinite(level)) {
        power += 10 ** (level / 10);
        count += 1;
      }
    }
    out[index] = count > 0 ? 10 * Math.log10(power / count) : -Infinity;
  });
  return out;
};

/*
 * Where the music stands between the speakers, for a scene's `uStereo`: its
 * balance, and how wide it is.
 *
 * Read from the two channels' own samples, not their peaks. Peaks say which
 * side is louder and nothing else: a wide mix with both sides at the same
 * level read as a mono one, and a hard-panned guitar and a centred vocal at
 * the same level cancelled out. The width is the share of the energy in the
 * difference between the channels — 0 for mono, a half for two unrelated
 * sides, 1 for one side the other's opposite — and the balance compares the
 * two sides' RMS levels, so the Windows volume under the capture cancels out.
 */

/** Below this mean energy a window is silence, and has no image. */
const SILENT_ENERGY = 1e-9;

/**
 * `[balance, width]` of one window of the two channels: balance -1 all left
 * to 1 all right, width 0..1. Written into `out`, which is returned.
 */
export const readStereoImage = (
  left: Float32Array,
  right: Float32Array,
  out: [number, number],
): [number, number] => {
  const length = Math.min(left.length, right.length);
  let leftEnergy = 0;
  let rightEnergy = 0;
  let sideEnergy = 0;
  for (let index = 0; index < length; index += 1) {
    const l = left[index];
    const r = right[index];
    leftEnergy += l * l;
    rightEnergy += r * r;
    const side = l - r;
    sideEnergy += side * side;
  }
  // Mid and side at the same scale, (l + r) and (l - r): together they hold
  // twice the two channels' energy, so the side's share needs no mid sum.
  const total = leftEnergy + rightEnergy;
  if (length === 0 || total / length < SILENT_ENERGY) {
    out[0] = 0;
    out[1] = 0;
    return out;
  }
  const leftLevel = Math.sqrt(leftEnergy);
  const rightLevel = Math.sqrt(rightEnergy);
  out[0] = (rightLevel - leftLevel) / (rightLevel + leftLevel);
  out[1] = Math.min(1, sideEnergy / (2 * total));
  return out;
};
