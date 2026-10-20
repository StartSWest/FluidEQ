/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The live spectrum behind the DSP EQ's curve: what it reads, and how it moves.
 *
 * It was one smoothed window in every 2048 samples — 23 pictures a second,
 * a 75 ms blend, every point under 300 Hz read from bins 23 Hz wide — and it
 * looked a beat behind the music with the bass a blob (Ivan, 2026-10-17:
 * "more realtime ... more realistic show for freq but not exactly same smooth
 * as the graph analyzer but something professional"). An engine that sends
 * the EQ tap live (`meters_eq_live.h`) gives it the window ending now and a
 * 16384-point window for the bottom octaves, which this reads the way the
 * main graph reads its own two (`readBandLevels`), at a finer slice, with an
 * analyser's ballistics on top.
 *
 * A TWENTY-FOURTH OF AN OCTAVE, where the main graph reads a twelfth. That is
 * where a piano's or a bass's partials stand apart from each other above
 * 300 Hz — the detail an EQ is aimed at — while the slice still sums enough
 * bins to keep one transform's grain off the screen.
 *
 * FAST UP, SMOOTH DOWN. A level rises with an 8 ms half-life, so a hit is on
 * screen in the frame it is heard, and falls with 125 ms — 3 dB every 125 ms,
 * 24 dB a second: the decay of a note reads as a decay, not a flicker. Both in power,
 * so a steady tone reads its own level and noise does not drag the curve down
 * between its peaks. The main graph's analyser follows both ways within
 * 10 ms, which is the smoothness asked to be different here.
 *
 * EVERY FRAME THE SCREEN DRAWS. A measurement arrives with each block of
 * audio, a hundred a second in shared mode; the drawing eases toward the
 * newest one on every animation frame, timed by the clock, so a 144 or
 * 240 Hz screen sees the curve move in every frame instead of the same
 * picture twice and a step (Ivan, 2026-10-17: "really smooth no limit").
 * A frame costs one multiply and one logarithm a point; the slices are read
 * only when a measurement lands.
 *
 * Frames from an older engine are already smoothed by it and are drawn as
 * they come, at that engine's twelfth of an octave.
 */
import {
  createGraphBandLayout,
  createGraphSliceReader,
  IGraphBandLayout,
  IGraphSliceReader,
  readBandLevels,
} from '../graph/graphSlices';
import { getEaseFactor } from '../../common/smoothing';
import type { IDspAnalyser } from './store';

/** How much of an octave each point stands for. */
export const EQ_SPECTRUM_OCTAVES = 1 / 24;

/**
 * Points across the plot: about seventy an octave. At the main graph's 320 a
 * partial a twenty-fourth of an octave wide fell on one point or two and was
 * drawn as a needle; at this density each one is the rounded peak its slice
 * actually makes as it passes.
 */
export const EQ_SPECTRUM_POINTS = 768;

/** The rise and the fall, as half-lives in power (`getEaseFactor`). */
export const EQ_SPECTRUM_RISE_HALF_LIFE_MS = 8;
export const EQ_SPECTRUM_FALL_HALF_LIFE_MS = 125;

/**
 * A gap between frames longer than this — the window was hidden, the music
 * paused — is not a fall that lasted that long: the next reading is drawn as
 * it is.
 */
export const EQ_SPECTRUM_LONGEST_STEP_MS = 250;

/** Decibels as power, into `out`; silence as zero. */
export const powerOf = (levelsDb: Float64Array, out: Float64Array): void => {
  for (let index = 0; index < out.length; index += 1) {
    const level = levelsDb[index];
    out[index] = Number.isFinite(level) ? 10 ** (level / 10) : 0;
  }
};

/**
 * One step of the ballistics: `held` (power, in place) toward `target`
 * (power), over `elapsedMs`, written as decibels into `out`.
 */
export const followSpectrum = (
  held: Float64Array,
  target: Float64Array,
  elapsedMs: number,
  out: Float64Array,
): void => {
  const gap = !(elapsedMs <= EQ_SPECTRUM_LONGEST_STEP_MS);
  const rise = gap
    ? 1
    : getEaseFactor(elapsedMs, EQ_SPECTRUM_RISE_HALF_LIFE_MS);
  const fall = gap
    ? 1
    : getEaseFactor(elapsedMs, EQ_SPECTRUM_FALL_HALF_LIFE_MS);
  for (let index = 0; index < held.length; index += 1) {
    const power = target[index];
    const was = held[index];
    const now = was + (power - was) * (power > was ? rise : fall);
    held[index] = now;
    out[index] = now > 0 ? 10 * Math.log10(now) : -Infinity;
  }
};

export interface IEqSpectrumReading {
  axis: readonly number[];
  levels: Float64Array;
}

export interface IEqSpectrum {
  /** The levels to draw now, from what the EQ tap last sent. */
  read: (analyser: IDspAnalyser, sampleRate: number) => IEqSpectrumReading;
}

/** The two windows' layout, remade only when the rate or the window moves. */
interface ILayoutKey {
  sampleRate: number;
  shortBins: number;
  detailWindow: number;
  detailBins: number;
  layout: IGraphBandLayout;
}

export const createEqSpectrum = (): IEqSpectrum => {
  let bins = new Float32Array(0);
  let slices: IGraphSliceReader | undefined;
  let layout: ILayoutKey | undefined;
  /** The ballistics' state and the newest measurement, in power. */
  let held = new Float64Array(0);
  let target = new Float64Array(0);
  /** What is drawn, in dB. */
  let drawn: IEqSpectrumReading | undefined;
  let generation = -1;
  /** When the drawing last stepped, by the clock. */
  let steppedAt = Number.NEGATIVE_INFINITY;

  const readBins = (analyser: IDspAnalyser) => {
    if (bins.length !== analyser.frequencyBinCount) {
      bins = new Float32Array(analyser.frequencyBinCount);
    }
    analyser.getFloatFrequencyData(bins);
  };

  /** The short window alone, at the main graph's twelfth of an octave. */
  const readShortWindow = (sampleRate: number): IEqSpectrumReading => {
    if (
      slices === undefined ||
      slices.sampleRate !== sampleRate ||
      slices.fftSize !== bins.length * 2
    ) {
      slices = createGraphSliceReader(
        sampleRate,
        bins.length * 2,
        EQ_SPECTRUM_POINTS,
      );
    }
    return { axis: slices.axis, levels: slices.read(bins) };
  };

  const readBothWindows = (
    sampleRate: number,
    detailWindow: number,
    detail: Float32Array,
  ): IEqSpectrumReading => {
    if (
      layout === undefined ||
      layout.sampleRate !== sampleRate ||
      layout.shortBins !== bins.length ||
      layout.detailWindow !== detailWindow ||
      layout.detailBins !== detail.length
    ) {
      layout = {
        sampleRate,
        shortBins: bins.length,
        detailWindow,
        detailBins: detail.length,
        layout: createGraphBandLayout(
          sampleRate,
          bins.length * 2,
          detailWindow,
          {
            lowBins: detail.length,
            detailOctaves: EQ_SPECTRUM_OCTAVES,
            points: EQ_SPECTRUM_POINTS,
          },
        ),
      };
    }
    return {
      axis: layout.layout.axis,
      levels: readBandLevels(layout.layout, bins, detail),
    };
  };

  return {
    read: (analyser, sampleRate) => {
      const { live } = analyser;
      if (!live) {
        readBins(analyser);
        return readShortWindow(sampleRate);
      }
      if (!drawn || live.generation !== generation) {
        readBins(analyser);
        // Before the first long window has come, the short one alone: one
        // frame or two, on the same axis, so the ballistics carry across.
        const reading = live.detail
          ? readBothWindows(sampleRate, live.detailWindow, live.detail)
          : readShortWindow(sampleRate);
        if (!drawn || held.length !== reading.levels.length) {
          held = new Float64Array(reading.levels.length);
          target = new Float64Array(reading.levels.length);
          drawn = {
            axis: reading.axis,
            levels: new Float64Array(reading.levels.length),
          };
          steppedAt = Number.NEGATIVE_INFINITY;
        }
        drawn.axis = reading.axis;
        powerOf(reading.levels, target);
        generation = live.generation;
      }
      const now = performance.now();
      followSpectrum(held, target, now - steppedAt, drawn.levels);
      steppedAt = now;
      return drawn;
    },
  };
};
