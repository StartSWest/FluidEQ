/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import type { Translate, TranslationKey } from 'common/i18n';
import {
  IBalanceCaptureState,
  IBalanceListenBounds,
  IBalanceProgress,
  IBalanceReport,
  IBalanceResult,
  accumulateBalanceFrame,
  buildBalanceProgress,
  buildBalanceResult,
  createBalanceCaptureState,
  evaluateBalanceCapture,
  flipBalanceProgress,
  isBalanceCheckDue,
  shouldFinishBalanceCapture,
} from '../utils/autoBalanceCapture';
import { getPresenceLine, presenceAllowance } from '../utils/presenceThreshold';
import { IRawSourceFrame, TRawSourceKind, openRawSource } from './rawSource';

/**
 * A Smart EQ measurement: the raw source, accumulated until it has been heard
 * well enough to correct.
 *
 * This used to live inside the loopback hook, pumped by the same interval that
 * draws the graph, because the loopback was what it measured. It measures the
 * source now (`rawSource.ts`), which arrives on its own cadence and has nothing
 * to do with what the graph is drawing — so it lives here, fed by frames, and
 * the graph reads what it publishes through the store below.
 *
 * Nothing here samples on a clock. A frame arriving is what advances the
 * measurement; a checkpoint is due after a second of LISTENED time, which
 * only frames can add; silence is told to it by whoever knows the transport
 * (`setSilent`), because a tap that has gone quiet sends nothing at all, and
 * nothing is not an event.
 */
export interface IMeasurementOptions extends IBalanceListenBounds {
  source: TRawSourceKind;
  signal?: AbortSignal;
  /**
   * Run until aborted rather than until the measurement is complete — the
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
  onProgress?: (progress: IBalanceProgress) => void;
  /** Every checkpoint's full report, for a running mode to solve from. */
  onReport?: (report: IBalanceReport) => void;
}

export interface IMeasurement {
  /** Resolves when a one-shot has heard enough; rejects on abort or loss. */
  done: Promise<IBalanceResult>;
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
}

/** What the graph draws of a running measurement. */
export interface IMeasurementView {
  progress: IBalanceProgress | undefined;
  /** Each range's live level, on the plot's own axis — the mark in the band. */
  presenceLevels: number[];
  /** The same levels followed slowly, which is where the lines sit. */
  presenceTypical: number[];
}

const NO_LEVELS: number[] = [];
let view: IMeasurementView = {
  progress: undefined,
  presenceLevels: NO_LEVELS,
  presenceTypical: NO_LEVELS,
};
const listeners = new Set<() => void>();
const publish = (next: IMeasurementView) => {
  view = next;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const read = () => view;

export const useSmartEqMeasurement = (): IMeasurementView =>
  useSyncExternalStore(subscribe, read, read);

/** Errors from the taps carry a translation key; anything else is passed on. */
const describe = (error: unknown, t: Translate): Error => {
  if (error instanceof Error && error.message.startsWith('eq.smart.error.')) {
    return new Error(t(error.message as TranslationKey));
  }
  return error instanceof Error
    ? error
    : new Error(t('eq.smart.status.failed'));
};

/** The presence gate, recomputed from the lines on every frame. */
const gateOf = (state: IBalanceCaptureState, into: Float64Array) => {
  state.regions.forEach((region, index) => {
    // eslint-disable-next-line no-param-reassign -- the scratch buffer is the point
    into[index] = presenceAllowance(
      state.liveDb[index],
      getPresenceLine(
        'floor',
        region.label,
        region.centreFrequency,
        state.typicalDb[index],
      ),
      getPresenceLine(
        'full',
        region.label,
        region.centreFrequency,
        state.typicalDb[index],
      ),
    );
  });
  return into;
};

/**
 * Listen to the source until every frequency region has been heard well
 * enough to correct, then resolve with the averaged spectrum — or, for a
 * running mode, keep listening and report at every checkpoint until aborted.
 */
export const measureSource = (
  options: IMeasurementOptions,
  t: Translate,
): IMeasurement => {
  let state: IBalanceCaptureState | undefined;
  let presenceGate: Float64Array | undefined;
  let { halfLifeMs } = options;
  let sampleRate = 0;
  let lastPercent = 0;
  let lastProgress: IBalanceProgress | undefined;
  let isSilent = false;
  let settled = false;
  let close: (() => void) | undefined;
  let resolveDone: (value: IBalanceResult) => void = () => undefined;
  let rejectDone: (reason: Error) => void = () => undefined;
  const done = new Promise<IBalanceResult>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });

  const end = (outcome: IBalanceResult | Error) => {
    if (settled) {
      return;
    }
    settled = true;
    options.signal?.removeEventListener('abort', onAbort);
    close?.();
    close = undefined;
    publish({
      progress: undefined,
      presenceLevels: NO_LEVELS,
      presenceTypical: NO_LEVELS,
    });
    if (outcome instanceof Error) {
      rejectDone(outcome);
    } else {
      resolveDone(outcome);
    }
  };
  function onAbort() {
    end(new DOMException('Measurement cancelled.', 'AbortError'));
  }

  const publishProgress = (progress: IBalanceProgress) => {
    lastPercent = progress.percent;
    lastProgress = progress;
    publish({ ...view, progress });
    options.onProgress?.(progress);
  };

  const evaluate = () => {
    if (!state || settled) {
      return;
    }
    const bandLimited = state.fullBand.isHolding;
    if (!isBalanceCheckDue(state)) {
      if (
        lastProgress &&
        (isSilent !== lastProgress.isSilent ||
          bandLimited !== lastProgress.isBandLimited)
      ) {
        publishProgress(
          flipBalanceProgress(lastProgress, {
            isSilent,
            isPaused: false,
            isBandLimited: bandLimited,
            listenedMs: state.listenedMs,
            percent: lastPercent,
          }),
        );
      }
      return;
    }
    const report = evaluateBalanceCapture(state, options);
    publishProgress(
      buildBalanceProgress(report, lastPercent, {
        isSilent,
        isPaused: false,
        isContinuous: Boolean(options.isContinuous),
      }),
    );
    options.onReport?.(report);
    if (!options.isContinuous && shouldFinishBalanceCapture(report)) {
      end(buildBalanceResult(report));
    }
  };

  const onFrame = (frame: IRawSourceFrame) => {
    if (settled) {
      return;
    }
    if (!state) {
      sampleRate = frame.sampleRate;
      state = createBalanceCaptureState(frame.axis, halfLifeMs);
      presenceGate = new Float64Array(state.regions.length);
    } else if (frame.sampleRate !== sampleRate) {
      // Index-to-frequency changed underneath the accumulator. Mixing two
      // axes yields frequency-shifted garbage, which is the worst possible
      // input to an EQ writer. Never resample — abort.
      end(new Error(t('eq.smart.error.formatChanged')));
      return;
    }
    if (frame.peakDb !== undefined) {
      if (isSilent) {
        isSilent = false;
      }
      accumulateBalanceFrame(state, {
        levels: frame.levels,
        peakDb: frame.peakDb,
        timestampMs: performance.now(),
      });
      // The gate depends on where somebody has dragged the lines, which can
      // happen mid-capture, so it is refreshed every frame rather than held.
      state.presenceGate = gateOf(state, presenceGate as Float64Array);
      publish({
        ...view,
        presenceLevels: Array.from(state.liveDb),
        presenceTypical: Array.from(state.typicalDb),
      });
    }
    evaluate();
  };

  if (options.signal?.aborted) {
    end(new DOMException('Measurement cancelled.', 'AbortError'));
  } else {
    options.signal?.addEventListener('abort', onAbort);
    openRawSource({
      kind: options.source,
      onFrame,
      onLost: (reason) => end(new Error(t(reason))),
    })
      .then((closeSource) => {
        if (settled) {
          closeSource();
        } else {
          close = closeSource;
        }
        return undefined;
      })
      .catch((error: unknown) => end(describe(error, t)));
  }

  return {
    done,
    restart: (nextHalfLifeMs) => {
      if (settled) {
        return;
      }
      halfLifeMs = nextHalfLifeMs;
      state = undefined;
      presenceGate = undefined;
      lastPercent = 0;
      lastProgress = undefined;
      publish({
        progress: undefined,
        presenceLevels: NO_LEVELS,
        presenceTypical: NO_LEVELS,
      });
    },
    setSilent: (silent) => {
      if (isSilent === silent || settled) {
        return;
      }
      isSilent = silent;
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
    },
  };
};
