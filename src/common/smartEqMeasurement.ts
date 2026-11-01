/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from './i18n';
import {
  type IBalanceCaptureState,
  type IBalanceListenBounds,
  type IBalanceProgress,
  type IBalanceReport,
  type IBalanceResult,
  accumulateBalanceFrame,
  buildBalanceProgress,
  buildBalanceResult,
  createAxisCells,
  createBalanceCaptureState,
  evaluateBalanceCapture,
  flipBalanceProgress,
  isBalanceCheckDue,
  readAbsoluteLevels,
  shouldFinishBalanceCapture,
} from './autoBalanceCapture';
import { createFrequencyAxis, getPeakLevel } from './liveFrames';
import { type TPresenceEdge, presenceAllowance } from './presenceLines';

/**
 * A Smart EQ measurement: the sound before FluidEQ processes it, accumulated
 * until it has been heard well enough to correct.
 *
 * Nothing here samples on a clock. A frame arriving is what advances the
 * measurement; a checkpoint is due after a second of LISTENED time, which
 * only frames can add; silence is told to it by whoever knows the transport
 * (`setSilent`), because a tap that has gone quiet sends nothing at all, and
 * nothing is not an event.
 *
 * The core runs it (`main/smartEq/smartEqRunner.ts`), fed by the tap it opens
 * (`main/smartEq/rawSourceFrames.ts`), and the window draws what it publishes.
 */

/** One window of the source, on the analyser's own axis and scale. */
export interface IRawSourceFrame {
  /** The analysis axis these levels sit on, in Hz. */
  axis: number[];
  /** Absolute level at each axis point, in dB — the analyser's own scale. */
  levels: Float64Array;
  /** The loudest bin, in the same scale; undefined for silence. */
  peakDb: number | undefined;
  sampleRate: number;
}

/**
 * Turns one FFT frame of `fftSize / 2` dB values into a frame on the axis.
 *
 * Every frame lands on the analyser's own axis at the analyser's own scale,
 * so the accumulator behind it needs no idea which tap it is hearing.
 */
export const createFrameBuilder = (fftSize: number) => {
  let sampleRate = 0;
  let axis: number[] = [];
  let cells: ReturnType<typeof createAxisCells> = [];
  let levels = new Float64Array(0);
  return (bins: Float32Array, rate: number): IRawSourceFrame => {
    if (rate !== sampleRate) {
      sampleRate = rate;
      axis = createFrequencyAxis(rate);
      cells = createAxisCells(axis, rate, fftSize);
      levels = new Float64Array(axis.length);
    }
    readAbsoluteLevels(bins, cells, levels);
    return { axis, levels, peakDb: getPeakLevel(bins), sampleRate };
  };
};

/** What the graph draws of a running measurement. */
export interface IMeasurementView {
  progress: IBalanceProgress | undefined;
  /** Each range's live level, on the plot's own axis — the mark in the band. */
  presenceLevels: number[];
  /** The same levels followed slowly, which is where the lines sit. */
  presenceTypical: number[];
}

/** What the graph draws of a measurement, as the window receives it. */
export const isMeasurementView = (value: unknown): value is IMeasurementView =>
  typeof value === 'object' &&
  value !== null &&
  Array.isArray((value as IMeasurementView).presenceLevels) &&
  Array.isArray((value as IMeasurementView).presenceTypical);

export const NO_MEASUREMENT_VIEW: IMeasurementView = {
  progress: undefined,
  presenceLevels: [],
  presenceTypical: [],
};

export interface ISmartEqMeasurementOptions extends IBalanceListenBounds {
  /**
   * Run until ended rather than until the measurement is complete — the
   * running modes, which want to keep hearing the record rather than an
   * answer about it.
   */
  isContinuous?: boolean;
  /**
   * How long evidence keeps its full weight, for a session that never ends.
   *
   * Absent means never forget, which is right for a measurement that stops of
   * its own accord and for a running mode measuring one song: the answer
   * wanted is the whole song's. Given, old evidence fades — for a running
   * mode on a source that names no song, where a change of record can only
   * be followed by forgetting the last one.
   */
  halfLifeMs?: number;
  /**
   * Where a presence line is now. Asked on every frame, because somebody can
   * drag the lines mid-capture.
   */
  lineOf: (
    edge: TPresenceEdge,
    label: string,
    centreFrequency: number,
    typicalDb: number,
  ) => number;
  /** A monotonic clock in ms, read once per frame heard. */
  now: () => number;
  onView: (view: IMeasurementView) => void;
  onProgress?: (progress: IBalanceProgress) => void;
  /** Every checkpoint's full report, for a running mode to solve from. */
  onReport?: (report: IBalanceReport) => void;
  /** A one-shot heard enough. */
  onResult?: (result: IBalanceResult) => void;
  /** The measurement cannot go on; the key says why. */
  onFailed: (reason: TranslationKey) => void;
}

export interface ISmartEqMeasurement {
  /** A frame from the tap: what moves the measurement on. */
  hear: (frame: IRawSourceFrame) => void;
  /**
   * What the transport says: nothing is playing right now. The bubble says
   * so at once rather than sitting on a stale percentage.
   */
  setSilent: (silent: boolean) => void;
  /**
   * Forget everything heard so far and start again, on the same tap.
   *
   * A different record has started: what was accumulated describes the last
   * one and must not colour this one. The tap stays open — closing and
   * reopening it for every song would spawn the capture helper afresh each
   * time — and the next frame begins a fresh accumulator, on the half-life
   * given (see `halfLifeMs`).
   */
  restart: (halfLifeMs?: number) => void;
  /** Hear nothing more, and clear what the graph draws of it. */
  end: () => void;
}

export const createSmartEqMeasurement = (
  options: ISmartEqMeasurementOptions,
): ISmartEqMeasurement => {
  let state: IBalanceCaptureState | undefined;
  let presenceGate: Float64Array | undefined;
  let { halfLifeMs } = options;
  let sampleRate = 0;
  let lastPercent = 0;
  let lastProgress: IBalanceProgress | undefined;
  let view = NO_MEASUREMENT_VIEW;
  let isSilent = false;
  let isOver = false;

  const publish = (next: IMeasurementView) => {
    view = next;
    options.onView(next);
  };

  const end = () => {
    if (isOver) {
      return;
    }
    isOver = true;
    publish(NO_MEASUREMENT_VIEW);
  };

  /** The presence gate, recomputed from the lines on every frame. */
  const gateOf = (heard: IBalanceCaptureState, into: Float64Array) => {
    heard.regions.forEach((region, index) => {
      const typical = heard.typicalDb[index];
      // eslint-disable-next-line no-param-reassign -- the scratch buffer is the point
      into[index] = presenceAllowance(
        heard.liveDb[index],
        options.lineOf('floor', region.label, region.centreFrequency, typical),
        options.lineOf('full', region.label, region.centreFrequency, typical),
      );
    });
    return into;
  };

  const publishProgress = (progress: IBalanceProgress) => {
    lastPercent = progress.percent;
    lastProgress = progress;
    publish({ ...view, progress });
    options.onProgress?.(progress);
  };

  const flipProgress = () => {
    if (lastProgress && state) {
      publishProgress(
        flipBalanceProgress(lastProgress, {
          isSilent,
          isPaused: false,
          isBandLimited: state.fullBand.isHolding,
          listenedMs: state.listenedMs,
          percent: lastPercent,
        }),
      );
    }
  };

  const evaluate = (heard: IBalanceCaptureState) => {
    if (!isBalanceCheckDue(heard)) {
      if (
        lastProgress &&
        (isSilent !== lastProgress.isSilent ||
          heard.fullBand.isHolding !== lastProgress.isBandLimited)
      ) {
        flipProgress();
      }
      return;
    }
    const report = evaluateBalanceCapture(heard, options);
    publishProgress(
      buildBalanceProgress(report, lastPercent, {
        isSilent,
        isPaused: false,
        isContinuous: Boolean(options.isContinuous),
      }),
    );
    options.onReport?.(report);
    if (!options.isContinuous && shouldFinishBalanceCapture(report)) {
      end();
      options.onResult?.(buildBalanceResult(report));
    }
  };

  return {
    hear: (frame) => {
      if (isOver) {
        return;
      }
      if (!state) {
        sampleRate = frame.sampleRate;
        state = createBalanceCaptureState(frame.axis, halfLifeMs);
        presenceGate = new Float64Array(state.regions.length);
      } else if (frame.sampleRate !== sampleRate) {
        // Index-to-frequency changed underneath the accumulator. Mixing two
        // axes yields frequency-shifted garbage, which is the worst possible
        // input to an EQ writer. Never resample — stop.
        end();
        options.onFailed('eq.smart.error.formatChanged');
        return;
      }
      const heard = state;
      if (frame.peakDb !== undefined) {
        isSilent = false;
        accumulateBalanceFrame(heard, {
          levels: frame.levels,
          peakDb: frame.peakDb,
          timestampMs: options.now(),
        });
        // The gate depends on where somebody has dragged the lines, which can
        // happen mid-capture, so it is refreshed every frame rather than held.
        heard.presenceGate = gateOf(heard, presenceGate as Float64Array);
        publish({
          ...view,
          presenceLevels: Array.from(heard.liveDb),
          presenceTypical: Array.from(heard.typicalDb),
        });
      }
      evaluate(heard);
    },
    setSilent: (silent) => {
      if (isSilent === silent || isOver) {
        return;
      }
      isSilent = silent;
      flipProgress();
    },
    restart: (nextHalfLifeMs) => {
      if (isOver) {
        return;
      }
      halfLifeMs = nextHalfLifeMs;
      state = undefined;
      presenceGate = undefined;
      lastPercent = 0;
      lastProgress = undefined;
      publish(NO_MEASUREMENT_VIEW);
    },
    end,
  };
};
