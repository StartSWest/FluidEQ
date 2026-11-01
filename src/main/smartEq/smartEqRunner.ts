/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISmartEqSettings } from '../../common/constants';
import type { Translate, TranslationKey } from '../../common/i18n';
import {
  CONTINUOUS_HALF_LIFE_MS,
  type IBalanceReport,
  type IBalanceResult,
} from '../../common/autoBalanceCapture';
import {
  describeBalanceProgress,
  describeBalanceResult,
  describeContinuousProgress,
  describeCorrectionNeed,
  describeCorrectionShape,
} from '../../common/autoBalanceNarration';
import { getSmartEqBands } from '../../common/smartEq';
import {
  type IMeasurementView,
  type IRawSourceFrame,
  type ISmartEqMeasurement,
  createSmartEqMeasurement,
} from '../../common/smartEqMeasurement';
import {
  isSameSmartEqLayer,
  planSmartEqRewrite,
  smartEqLayerOf,
  solveSmartEq,
} from '../../common/smartEqSolve';
import { presenceLineAt } from '../../common/presenceLines';
import { isContinuousMode } from '../../common/smartEqMode';
import type {
  ISmartEqCoreSettings,
  ISmartEqRunState,
  ISmartEqWrote,
} from '../../common/smartEqCore';
import type { TRawSourceKind } from './rawSourceFrames';

/**
 * Every Smart EQ measurement there is, run where no window can end one.
 *
 * WHAT IT MEASURES IS THE SOURCE, and everything about how it corrects
 * follows from that: the sound before FluidEQ touches it
 * (`rawSourceFrames.ts`), with none of the bands, no voicing, no rack and no
 * Smart EQ layer in it. A solve is therefore a pure function of the record
 * and the mode (`common/smartEqSolve.ts`), and it REPLACES the layer rather
 * than adding to it — the listener's own bands, voicing and rack sit on top
 * of it as the taste they are, never measured and never corrected.
 *
 * Both measurements live here together on purpose. They share one status
 * bubble and only one of them may run: the running mode stands down while a
 * one-shot runs and comes back when it is over.
 *
 * It ran in the window, so a running mode meant to run all evening stopped
 * whenever the window reloaded, and could never run without one. The window
 * now asks for a one-shot, hands over its settings and what is playing, and
 * draws what it is told.
 */

/** What is playing, as the window's players report it. */
export interface ISmartEqNowPlaying {
  /** Which song, where something names it. */
  songKey: string | undefined;
  isPlaying: boolean;
  /** Which tap hears it: the Library's host, or the process loopback. */
  source: TRawSourceKind;
}

export interface ISmartEqRunnerDeps {
  settings: () => ISmartEqCoreSettings;
  /** The layer written now, on the output being edited. */
  layer: () => ISmartEqSettings | undefined;
  /** The Smart EQ chip is switched off: a layer nobody hears. */
  isBypassed: () => boolean;
  /** Write a layer through the update path; true when it landed. */
  write: (layer: ISmartEqSettings | undefined) => Promise<boolean>;
  openSource: (
    kind: TRawSourceKind,
    onFrame: (frame: IRawSourceFrame) => void,
    onLost: (reason: TranslationKey) => void,
  ) => Promise<() => void>;
  text: Translate;
  /** A monotonic clock in ms. */
  now: () => number;
  tellState: (state: ISmartEqRunState) => void;
  tellRemark: (text: string) => void;
  tellView: (view: IMeasurementView) => void;
  tellWrote: (wrote: ISmartEqWrote) => void;
  /** A running mode wrote: the song memory keeps its loan through it. */
  onRefined?: (layer: ISmartEqSettings | undefined) => void;
}

/** The measurement in flight, whichever kind, and how to close its tap. */
interface ISession {
  measurement: ISmartEqMeasurement;
  source: TRawSourceKind;
  close: (() => void) | undefined;
  isOver: boolean;
  /** A running mode's write is on its way; a second waits its turn. */
  isApplying: boolean;
}

/** How a one-shot's wait ends when somebody presses Cancel. */
const CANCELLED = 'cancelled' as const;

/**
 * Errors from the taps carry a translation key (`rawSourceFrames.ts`);
 * anything else is a measurement that failed in a way nobody planned for,
 * and says so rather than blaming the source.
 */
const reasonOf = (error: unknown): TranslationKey =>
  error instanceof Error && error.message.startsWith('eq.smart.error.')
    ? (error.message as TranslationKey)
    : 'eq.smart.status.failed';

/**
 * One song, measured whole, where something names the song; a forgetting
 * window where nothing does — a game, a page with no media session.
 */
const halfLifeFor = (songKey: string | undefined) =>
  songKey === undefined ? CONTINUOUS_HALF_LIFE_MS : undefined;

export const createSmartEqRunner = (deps: ISmartEqRunnerDeps) => {
  const { text: t } = deps;
  let playing: ISmartEqNowPlaying = {
    songKey: undefined,
    isPlaying: false,
    source: 'process',
  };
  let runState = { isRunning: false, listeningFor: '' };
  let continuous: ISession | undefined;
  let once: ISession | undefined;
  /** Ends the one-shot's wait with "cancelled"; undefined when none runs. */
  let cancelOnce: (() => void) | undefined;
  /** Bumped whenever a one-shot is over, so a late answer writes nothing. */
  let onceRun = 0;
  let isClosed = false;

  const setRunState = (next: Partial<ISmartEqRunState>) => {
    const merged = { ...runState, ...next };
    if (
      merged.isRunning === runState.isRunning &&
      merged.listeningFor === runState.listeningFor
    ) {
      return;
    }
    runState = merged;
    deps.tellState(runState);
  };

  const lineOf = (
    edge: 'floor' | 'full',
    label: string,
    centreFrequency: number,
    typicalDb: number,
  ) => {
    const { presenceOffsets, mode } = deps.settings();
    return presenceLineAt(
      presenceOffsets,
      mode,
      edge,
      label,
      centreFrequency,
      typicalDb,
    );
  };

  const endSession = (session: ISession | undefined) => {
    if (!session || session.isOver) {
      return;
    }
    // eslint-disable-next-line no-param-reassign -- the session is this module's own record
    session.isOver = true;
    session.measurement.end();
    session.close?.();
  };

  /** Open the tap for a session, unless it ended while the tap was opening. */
  const listen = (
    session: ISession,
    onLost: (reason: TranslationKey) => void,
  ) =>
    deps
      .openSource(
        session.source,
        (frame) => session.measurement.hear(frame),
        onLost,
      )
      .then((close) => {
        if (session.isOver) {
          close();
        } else {
          // eslint-disable-next-line no-param-reassign -- see endSession
          session.close = close;
        }
        return undefined;
      });

  /* --- a running mode --- */

  const applyReport = (session: ISession, report: IBalanceReport) => {
    // One correction at a time. A write is the update path, the config
    // rewrite and the engine noticing; a second solve arriving while one is
    // in flight would be written over the top of it in whichever order they
    // finish.
    if (session.isApplying) {
      return;
    }
    const written = deps.layer();
    const plan = planSmartEqRewrite(report, written, deps.settings());
    if (!plan) {
      return;
    }
    // eslint-disable-next-line no-param-reassign -- see endSession
    session.isApplying = true;
    deps.onRefined?.(plan.layer);
    deps
      .write(plan.layer)
      .catch(() => false)
      .then((landed) => {
        // eslint-disable-next-line no-param-reassign -- see endSession
        session.isApplying = false;
        // Told here and nowhere earlier: this is the moment the chain on disk
        // actually changed, so it is the moment the sound did. A write that
        // failed is said nowhere on purpose: a loop nobody started should not
        // raise the banner over the whole workspace, and the next settled
        // solve writes again.
        if (landed) {
          deps.tellWrote({
            kind: 'refined',
            layer: plan.layer,
            from: written,
            moved: plan.moved,
          });
        }
        return undefined;
      })
      .catch(() => undefined);
    // What just moved, phrased as a need — "Needs more deep bass" — so it is
    // the same voice the measurement underneath it speaks in.
    deps.tellRemark(
      describeCorrectionNeed(
        getSmartEqBands(written),
        plan.gains,
        t,
        plan.moved,
      ),
    );
  };

  const stopContinuous = () => {
    endSession(continuous);
    continuous = undefined;
    setRunState({ listeningFor: '' });
  };

  const startContinuous = () => {
    let session: ISession | undefined;
    const lost = (reason: TranslationKey) => {
      if (session && continuous === session) {
        stopContinuous();
        // The mode is still switched on and now hears nothing: worth a sentence.
        deps.tellRemark(t(reason));
      }
    };
    const measurement = createSmartEqMeasurement({
      isContinuous: true,
      halfLifeMs: halfLifeFor(playing.songKey),
      lineOf,
      now: deps.now,
      onView: deps.tellView,
      // Said only when the wording changes: a publish is a redraw of the
      // whole editor.
      onProgress: (progress) =>
        setRunState({ listeningFor: describeContinuousProgress(progress, t) }),
      onReport: (report) => {
        if (session && !session.isOver) {
          applyReport(session, report);
        }
      },
      onFailed: lost,
    });
    session = {
      measurement,
      source: playing.source,
      close: undefined,
      isOver: false,
      isApplying: false,
    };
    continuous = session;
    // A fresh session has heard nothing yet, and saying otherwise would leave
    // the bubble asserting a condition from the last one.
    setRunState({ listeningFor: t('eq.smart.status.listening') });
    measurement.setSilent(!playing.isPlaying);
    listen(session, lost).catch((error: unknown) => lost(reasonOf(error)));
  };

  /**
   * Run the running mode when it should run, and only then: switched on, a
   * running mode chosen, the layer heard, no one-shot in progress. A
   * different tap is a different sound, so a change of tap starts it again;
   * a change of mode does not — the evidence is of the record and is as true
   * under one destination as another, and the next settled solve aims at the
   * new one.
   */
  const follow = () => {
    const { continuous: isOn, mode } = deps.settings();
    const wanted =
      !isClosed &&
      isOn &&
      isContinuousMode(mode) &&
      !deps.isBypassed() &&
      once === undefined;
    if (!wanted) {
      if (continuous) {
        stopContinuous();
      }
      return;
    }
    if (continuous && continuous.source !== playing.source) {
      stopContinuous();
    }
    if (!continuous) {
      startContinuous();
    }
  };

  /* --- the one-shot --- */

  const measureOnce = (runId: number): Promise<IBalanceResult> =>
    new Promise((resolve, reject) => {
      const isCurrent = () => onceRun === runId;
      let session: ISession | undefined;
      const fail = (reason: TranslationKey | typeof CANCELLED) => {
        endSession(session);
        reject(new Error(reason));
      };
      const measurement = createSmartEqMeasurement({
        lineOf,
        now: deps.now,
        onView: deps.tellView,
        onProgress: (progress) => {
          if (isCurrent()) {
            deps.tellRemark(describeBalanceProgress(progress, t));
          }
        },
        onResult: (result) => {
          endSession(session);
          resolve(result);
        },
        onFailed: fail,
      });
      session = {
        measurement,
        source: playing.source,
        close: undefined,
        isOver: false,
        isApplying: false,
      };
      once = session;
      cancelOnce = () => fail(CANCELLED);
      measurement.setSilent(!playing.isPlaying);
      listen(session, fail).catch((error: unknown) => fail(reasonOf(error)));
    });

  /**
   * Listen to the source until every frequency region has been heard well
   * enough to correct, solve once, and write the answer as the layer.
   *
   * Pressing it again on the same passage gives the same answer, because the
   * answer is of the record and not of what the layer held: a second press
   * that finds nothing new to write says so and writes nothing. There is no
   * fixed duration.
   */
  const runOnce = async () => {
    onceRun += 1;
    const runId = onceRun;
    const isCurrent = () => onceRun === runId && !isClosed;
    // One tap on the source at a time.
    stopContinuous();
    setRunState({ isRunning: true });
    deps.tellRemark(t('eq.smart.status.listeningPercent', { percent: 0 }));
    try {
      const result = await measureOnce(runId);
      if (!isCurrent()) {
        return;
      }
      const settings = deps.settings();
      const gains = solveSmartEq(result, settings);
      if (!gains) {
        deps.tellRemark(t('eq.smart.status.notEnoughRange'));
        return;
      }
      const from = deps.layer();
      const measured = smartEqLayerOf(
        gains,
        {
          status: result.status,
          lowFrequency: result.lowFrequency,
          highFrequency: result.highFrequency,
        },
        from,
        settings.limitDb,
      );
      // Compared on what will be written, not on object identity: a run that
      // lands within the rounding step of what is applied has genuinely found
      // nothing left to correct.
      if (isSameSmartEqLayer(measured, from)) {
        deps.tellRemark(t('eq.smart.status.alreadyBalanced'));
        return;
      }
      deps.tellRemark(t('eq.smart.status.applying'));
      if (!(await deps.write(measured)) || !isCurrent()) {
        return;
      }
      deps.tellWrote({ kind: 'measured', layer: measured, from, moved: [] });
      // What was heard, and then what was done about it, joined through a key
      // because the separator is a typographic decision a language may make
      // differently.
      const shape = describeCorrectionShape(
        Object.values(measured?.filters ?? {}),
        t,
      );
      const heard = describeBalanceResult(result, t);
      deps.tellRemark(
        shape
          ? t('eq.smart.result.withShape', { result: heard, shape })
          : heard,
      );
    } catch (error) {
      if (isCurrent()) {
        // A failed measurement is a normal outcome (nothing to hear,
        // cancelled, no tap on the source): said in place, never as a
        // failure that would blank the whole workspace.
        deps.tellRemark(
          error instanceof Error && error.message === CANCELLED
            ? t('eq.smart.status.cancelled')
            : t(reasonOf(error)),
        );
      }
    } finally {
      if (onceRun === runId) {
        onceRun += 1;
        endSession(once);
        once = undefined;
        cancelOnce = undefined;
        setRunState({ isRunning: false });
        follow();
      }
    }
  };

  return {
    state: (): ISmartEqRunState => runState,
    /** The button: a one-shot, or Cancel while one runs. */
    run: () => {
      if (cancelOnce) {
        cancelOnce();
        return;
      }
      runOnce().catch(() => undefined);
    },
    cancel: () => cancelOnce?.(),
    /** The settings, the layer or its chip changed: run what should run. */
    follow,
    nowPlaying: (next: ISmartEqNowPlaying) => {
      const previous = playing;
      playing = next;
      if (previous.isPlaying !== next.isPlaying) {
        // A tap with nothing to hear sends nothing, and nothing is not an
        // event: the transport is what says it has gone silent.
        continuous?.measurement.setSilent(!next.isPlaying);
        once?.measurement.setSilent(!next.isPlaying);
      }
      if (previous.songKey !== next.songKey) {
        // A new song is a different record: the accumulator starts again, on
        // the same tap — not a restart of the whole session, which would
        // spawn the capture helper afresh at every track change.
        continuous?.measurement.restart(halfLifeFor(next.songKey));
      }
      follow();
    },
    close: () => {
      isClosed = true;
      cancelOnce?.();
      stopContinuous();
    },
  };
};

export type TSmartEqRunner = ReturnType<typeof createSmartEqRunner>;
