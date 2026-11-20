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

import { useEffect, useRef, useState } from 'react';
import { describeSmartEqLayer, getSmartEqBands } from 'common/smartEq';
import { isSmartEqRewriteDue } from 'common/smartEqContinuous';
import {
  describeBalanceProgress,
  describeBalanceResult,
  describeCorrectionNeed,
  describeCorrectionShape,
} from './utils/autoBalanceNarration';
import { useFluidEqContext } from './utils/FluidEqContext';
import { useTranslation } from './utils/I18nContext';
import { setSmartEq as setSmartEqApi } from './utils/equalizerApi';
import { noteSmartEqWrite } from './audio/songEqSession';
import { useNowPlayingIdentity } from './audio/nowPlayingIdentity';
import { usePlaybackOwner } from './audio/playbackOwner';
import {
  IMeasurement,
  ISmartEqPreviewReport,
  measureSource,
} from './audio/smartEqMeasurement';
import type { TRawSourceKind } from './audio/rawSource';
import { useContinuousEq } from './utils/continuousEq';
import { isContinuousMode, useSmartEqMode } from './utils/smartEqMode';
import {
  CONTINUOUS_HALF_LIFE_MS,
  IBalanceReport,
} from './utils/autoBalanceCapture';
import {
  SMART_EQ_LAYOUT,
  gainsOf,
  movedRanges,
  smartEqLayerOf,
  solveSmartEq,
} from './utils/smartEqSolve';
import { flashCorrection } from './utils/correctionFlash';
import { planBandReveal, revealBands } from './utils/bandReveal';
import {
  registerSmartEqControl,
  setSmartEqListening,
  setSmartEqRunning,
  setSmartEqStatus,
  useSmartEqRun,
} from './utils/smartEqRun';
import {
  TSmartEqHeldOutcome,
  endSmartEqPreview,
  getSmartEqPreview,
  publishSmartEqPreview,
  startSmartEqPreview,
  useSmartEqRemeasures,
} from './utils/smartEqPreview';
import {
  atStrength,
  isReadyToHold,
  missingRangesOf,
  phaseOf,
  previewRegionsOf,
} from './utils/smartEqHold';

/**
 * Every Smart EQ measurement there is, hosted where no tab can end one.
 *
 * Renders nothing. It is mounted once, above the workspace tabs, and the EQ
 * page talks to it through `utils/smartEqRun` — which is the whole point:
 * both measurements used to live inside the EQ page's component, so switching
 * to the Voicing tab unmounted them mid-capture. A continuous mode meant to run
 * all evening stopped because somebody looked at something else, and came back
 * having forgotten every region it had heard.
 *
 * WHAT IT MEASURES IS THE SOURCE, and everything about how it corrects
 * follows from that. The measurement is of the sound before FluidEQ touches
 * it (`audio/rawSource.ts`): the record, with none of the bands, no voicing,
 * no rack and no Smart EQ layer in it. A solve is therefore a pure function
 * of the record and the mode, and a solve REPLACES the layer rather than
 * adding to it. The same record gives the same layer whatever was applied
 * before, whatever was played before, and whichever mode was on before — and
 * the listener's own bands, voicing and rack sit on top of it as the taste
 * they are, never measured and never corrected.
 *
 * It used to measure the endpoint's loopback — the record with every layer
 * and the whole rack already on it — subtract a model of four of those
 * layers, and add each solve onto the last as a residual. The rack was never
 * in the model, so a compressor, an exciter or the room reshaping the output
 * by several decibels read as faults in the record and were corrected; and
 * the residual loop meant the answer depended on where it started. Both were
 * heard, and both are gone with the loop.
 *
 * Both halves live here together on purpose. They share one status bubble
 * and only one of them may run: the loop stands down while a one-shot runs
 * (`isRunning` is in its dependencies) and the button tears the loop down
 * itself before asking for a tap (see `continuousAbortRef`).
 */
const SmartEqEngine = () => {
  const { smartEq, setSmartEq, getBandSetGeneration, bypassed } =
    useFluidEqContext();
  /**
   * The language, on a ref, and the ref is the point.
   *
   * Everything that writes a status here does it from inside a measurement
   * that runs for tens of seconds or, in a continuous mode, all evening — so
   * reading `t` from the closure would freeze the readout in whatever language
   * was selected when the measurement started. Worse, putting it in the
   * effect's dependencies would tear the measurement down and start it again
   * on a language change, taking every region's accumulated evidence with it.
   * A ref is the only version that is both current and free.
   */
  const { t } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;
  /** The flag the loop stands down for. */
  const { isRunning } = useSmartEqRun();
  const isContinuousOn = useContinuousEq();
  const isSmartBypassed = bypassed.includes('smart');
  const smartEqMode = useSmartEqMode();
  /**
   * Which tap hears the source. The Library plays through FluidEQ's own host,
   * whose input tap is the decoded file; everything else is heard through the
   * process loopback, which Windows delivers ahead of the endpoint's effects.
   */
  const owner = usePlaybackOwner();
  const sourceKind: TRawSourceKind = owner === 'library' ? 'host' : 'process';
  /**
   * Which song is playing, and whether anything is.
   *
   * The song is what a running mode measures ONE OF: its session restarts
   * when the song changes, so the layer written for a song is a function of
   * that song alone and the next song is met with an empty accumulator rather
   * than the tail of the last one. Where nothing names the song — a game, a
   * page with no media session — the session runs on a half-life instead and
   * follows the content by forgetting.
   *
   * Whether anything is playing is what tells the measurement it has gone
   * silent: a tap with nothing to hear sends nothing, and nothing is not an
   * event.
   */
  const { identity, isPlaying } = useNowPlayingIdentity();
  const songKey = identity?.key;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  /**
   * The measurement in flight, whichever kind, so silence and a change of
   * song can reach it.
   */
  const measurementRef = useRef<IMeasurement | undefined>(undefined);
  useEffect(() => {
    const measurement = measurementRef.current;
    measurement?.setSilent(!isPlaying);
    if (measurement && getSmartEqPreview().phase !== 'held') {
      publishSmartEqPreview({ isSilent: !isPlaying });
    }
  }, [isPlaying]);
  /**
   * The running mode's song has been heard and written, and its tap closed
   * (`smartEqHold.ts`). Until the next song or a press of Measure again
   * nothing measures; a session counted up opens a new tap.
   */
  const isHeldRef = useRef(false);
  /** What the hold was written from, so a change of mode re-solves it. */
  const heldReportRef = useRef<IBalanceReport | undefined>(undefined);
  const [session, setSession] = useState(0);
  const remeasures = useSmartEqRemeasures();
  /**
   * A new song is a different record: the accumulator starts again, on the
   * same tap while it is still listening. Not a restart of the whole session
   * — that would close the tap and reopen it, which for the process loopback
   * is the capture helper spawned afresh at every track change. A held song
   * has closed its tap already, so the next one opens a new session.
   */
  const songHalfLife = (key: string | undefined) =>
    key === undefined ? CONTINUOUS_HALF_LIFE_MS : undefined;
  const previousSongRef = useRef(songKey);
  useEffect(() => {
    if (previousSongRef.current === songKey) {
      return;
    }
    previousSongRef.current = songKey;
    if (isHeldRef.current) {
      setSession((count) => count + 1);
      return;
    }
    if (measurementRef.current) {
      measurementRef.current.restart(songHalfLife(songKey));
      startSmartEqPreview();
    }
  }, [songKey]);
  /**
   * The running mode's phase in a word, for the bubble: a condition rather
   * than a remark (`useSmartEqStatus`), and written only when it changes, since
   * the EQ page's editor subscribes to it. The heard seconds live in the
   * preview store, read by the two small things that draw them.
   */
  const listeningForRef = useRef('');
  /** A correction is on its way to the engine right now. */
  const isApplyingRef = useRef(false);
  /**
   * Which reference the loop is holding records to, and which tap it should
   * open, read from refs: the callbacks inside a measurement are held for as
   * long as it runs, so reading these through state would give them whatever
   * was current when it started.
   */
  const referenceModeRef = useRef(smartEqMode);
  referenceModeRef.current = smartEqMode;
  const sourceKindRef = useRef(sourceKind);
  sourceKindRef.current = sourceKind;
  const smartEqRef = useRef(smartEq);
  smartEqRef.current = smartEq;

  /** The whole answer for a report, under the mode chosen now. */
  const solve = (report: Pick<IBalanceReport, 'samples' | 'regions'>) =>
    solveSmartEq(report, referenceModeRef.current);

  /** The solved gains as the layer to write, keeping the listener's strength. */
  const layerOf = (
    gains: Record<string, number>,
    measurement: Parameters<typeof smartEqLayerOf>[1],
  ) => smartEqLayerOf(gains, measurement, smartEqRef.current?.intensity);

  /**
   * The curve forming on the graph, from a checkpoint: solved exactly as the
   * hold will write it, at the layer's strength, and written nowhere.
   */
  const showPreview = ({
    report,
    measured,
    heardMs,
    isSilent,
  }: ISmartEqPreviewReport) => {
    if (isHeldRef.current) {
      return;
    }
    const gains = solve(report);
    publishSmartEqPreview({
      phase: phaseOf(measured),
      heardMs,
      isSilent,
      gains: gains && atStrength(gains, smartEqRef.current?.intensity),
      regions: previewRegionsOf(report),
      meanCoverage: report.meanCoverage,
    });
  };
  const showPreviewRef = useRef(showPreview);
  showPreviewRef.current = showPreview;

  /** The graph's arrival: the dust settles onto what was decided. */
  const showHeld = (
    report: Pick<IBalanceReport, 'regions'>,
    outcome: TSmartEqHeldOutcome,
    gains: Record<string, number> | undefined,
  ) =>
    publishSmartEqPreview({
      phase: 'held',
      holdId: getSmartEqPreview().holdId + 1,
      outcome,
      isSilent: false,
      missing: missingRangesOf(report),
      regions: previewRegionsOf(report),
      gains: gains && atStrength(gains, smartEqRef.current?.intensity),
    });

  /**
   * The one-shot, reachable from an effect.
   *
   * `autoBalance` is rebuilt every render and closes over half the component,
   * so naming it as a dependency would re-run the mode-change effect constantly
   * — and that effect exists precisely to fire once, on a change.
   */
  const runAutoBalanceRef = useRef(() => {});
  const previousModeRef = useRef(smartEqMode);
  useEffect(() => {
    if (previousModeRef.current === smartEqMode) {
      return;
    }
    previousModeRef.current = smartEqMode;
    if (!isContinuousMode(smartEqMode)) {
      // The one-shot runs the moment it is chosen, like the other three do.
      runAutoBalanceRef.current();
    }
    // A continuous mode needs no setting up. Everything heard so far is of
    // the record and is as true under the new mode as under the old; only
    // the destination changes, and the loop reads that from a ref. It keeps
    // whatever layer is applied until its next settled solve and replaces it
    // then — the one transition that cannot make the output jump, since
    // nothing is cleared.
  }, [smartEqMode]);

  /**
   * The running continuous session, so the manual button can end it.
   *
   * The effect below would tear it down on its own — `isRunning` is in its
   * dependencies — but that happens on React's schedule, and `autoBalance`
   * opens its own tap in the same tick it sets the flag. Two taps on the
   * source at once is not wrong, but it is two captures for one answer; so
   * the loop is stopped here explicitly, before anything is opened.
   */
  const continuousAbortRef = useRef<AbortController | undefined>(undefined);
  const balanceAbortRef = useRef<AbortController | undefined>(undefined);
  // Bumped whenever a run is superseded, so a late resolution from an
  // abandoned measurement cannot write gains or overwrite the status.
  const balanceRunRef = useRef(0);

  /**
   * How the toolbar drives a measurement it does not own.
   *
   * Registered once, on mount, and both handles read through refs so the entry
   * in the store never goes stale. Withdrawn on unmount, which in practice
   * means the window closing: this component sits above the tabs and nothing
   * short of that takes it down.
   */
  useEffect(() => {
    registerSmartEqControl({
      run: () => runAutoBalanceRef.current(),
      cancel: () => balanceAbortRef.current?.abort(),
    });
    return () => registerSmartEqControl(undefined);
  }, []);

  // The host outlives every tab — that is the whole reason it exists — so this
  // no longer fires when somebody looks at the Voicing panel. It runs when the
  // window is going away, and a measurement must not keep resolving into a
  // component tree that is being torn down.
  useEffect(
    () => () => {
      balanceRunRef.current += 1;
      balanceAbortRef.current?.abort();
    },
    [],
  );

  /**
   * Listen to the source until every frequency region has been heard well
   * enough to correct, solve once, and write the answer as the layer.
   *
   * Pressing it again on the same passage gives the same answer, because the
   * answer is of the record and not of what the layer held: a second press
   * that finds nothing new to write says so and writes nothing.
   *
   * There is no fixed duration. The measurement runs until every frequency
   * region has been heard well enough to correct — or reports which range it
   * managed to measure, and leaves the rest alone.
   */
  const autoBalance = async () => {
    if (isRunning) {
      // The button is a Cancel while a measurement is running.
      balanceAbortRef.current?.abort();
      return;
    }

    // One tap on the source at a time. See `continuousAbortRef` for why
    // waiting for the effect to do this would be a race rather than an
    // ordering.
    continuousAbortRef.current?.abort();

    balanceRunRef.current += 1;
    const runId = balanceRunRef.current;
    const isCurrentRun = () => balanceRunRef.current === runId;
    const controller = new AbortController();
    balanceAbortRef.current = controller;

    setSmartEqRunning(true);
    isHeldRef.current = false;
    startSmartEqPreview();

    try {
      const layer = smartEqRef.current;
      setSmartEqStatus(
        tRef.current('eq.smart.status.listeningPercent', { percent: 0 }),
      );
      const measurement = measureSource(
        {
          source: sourceKindRef.current,
          signal: controller.signal,
          onProgress: (progress) => {
            if (isCurrentRun()) {
              setSmartEqStatus(describeBalanceProgress(progress, tRef.current));
            }
          },
          onPreview: (preview) => {
            if (isCurrentRun()) {
              showPreviewRef.current(preview);
            }
          },
        },
        tRef.current,
      );
      measurementRef.current = measurement;
      measurement.setSilent(!isPlayingRef.current);
      const result = await measurement.done;

      if (!isCurrentRun()) {
        return;
      }

      const gains = solve(result);
      if (!gains) {
        showHeld(result, 'short', undefined);
        setSmartEqStatus(tRef.current('eq.smart.status.notEnoughRange'));
        return;
      }
      const measured = layerOf(gains, {
        status: result.status,
        lowFrequency: result.lowFrequency,
        highFrequency: result.highFrequency,
      });

      // Compared on what will be written, not on object identity: a run that
      // lands within the rounding step of what is applied has genuinely found
      // nothing left to correct.
      const isUnchanged =
        describeSmartEqLayer(measured) === describeSmartEqLayer(layer);
      showHeld(result, isUnchanged ? 'unchanged' : 'written', gains);
      if (isUnchanged) {
        setSmartEqStatus(tRef.current('eq.smart.status.alreadyBalanced'));
        return;
      }

      setSmartEqStatus(tRef.current('eq.smart.status.applying'));

      // The same reveal the AutoEQ panel uses, pointed at the layer instead
      // of at the bands: its curve climbs onto the graph a band at a time
      // rather than appearing whole. The write below is still one message —
      // what is heard changes once, at the start — and the animation that
      // follows is only how the result is drawn.
      //
      // Revealed from the layer's previous gains rather than from silence,
      // because what is worth watching is where it moved.
      const generation = getBandSetGeneration();
      const isCurrent = () =>
        isCurrentRun() && getBandSetGeneration() === generation;
      const plan = measured
        ? planBandReveal(measured.filters, { from: layer?.filters })
        : undefined;

      setSmartEq(
        plan && measured ? { ...measured, filters: plan.initial } : measured,
      );
      await setSmartEqApi(measured);

      if (!isCurrent()) {
        return;
      }

      if (plan && measured) {
        const revealed = { ...plan.initial };
        await revealBands(
          plan.steps,
          (arriving) => {
            arriving.forEach(({ id, gain }) => {
              revealed[id] = { ...revealed[id], gain };
            });
            setSmartEq({ ...measured, filters: { ...revealed } });
          },
          { isCurrent },
        );
        if (!isCurrent()) {
          return;
        }
        setSmartEq(measured);
      }

      // What was heard, and then what was done about it. The first half
      // describes a measurement; the second is the gains written, which are
      // on disk and can be argued with.
      //
      // Joined through a key rather than with a template literal, because the
      // separator between the two halves is a typographic decision and one of
      // the ten dictionaries may want a different one.
      {
        const shape = describeCorrectionShape(
          Object.values(measured?.filters ?? {}),
          tRef.current,
        );
        const heard = describeBalanceResult(result, tRef.current);
        setSmartEqStatus(
          shape
            ? tRef.current('eq.smart.result.withShape', {
                result: heard,
                shape,
              })
            : heard,
        );
      }
    } catch (e) {
      if (!isCurrentRun()) {
        return;
      }
      endSmartEqPreview();
      // A failed measurement is a normal outcome (nothing to hear, cancelled,
      // no tap on the source); report it in place rather than as a global
      // failure that would blank the whole workspace.
      if (e instanceof DOMException && e.name === 'AbortError') {
        setSmartEqStatus(tRef.current('eq.smart.status.cancelled'));
      } else {
        // An Error's message is already translated: everything the
        // measurement rejects with is looked up before it is thrown. What is
        // left for the key below is a non-Error, which no code here throws
        // and only a browser can.
        setSmartEqStatus(
          e instanceof Error
            ? e.message
            : tRef.current('eq.smart.status.failed'),
        );
      }
    } finally {
      if (isCurrentRun()) {
        setSmartEqRunning(false);
        balanceAbortRef.current = undefined;
        measurementRef.current = undefined;
      }
    }
  };

  runAutoBalanceRef.current = () => {
    autoBalance().catch(() => {
      // Reported in the status line by the run itself.
    });
  };

  /**
   * Write what a held song was measured to, once — see `smartEqHold.ts`.
   *
   * Two conditions still stand between the answer and the engine: the fresh
   * answer has to differ from the written layer by an audible amount
   * (`isSmartEqRewriteDue`), so the same song played again is not a reload
   * on the engine's side, and the tilt fit needs a wide trusted span.
   */
  const writeHeld = (
    report: IBalanceReport,
  ): { outcome: TSmartEqHeldOutcome; gains?: Record<string, number> } => {
    const ready = report.regions.filter((region) => region.isCovered);
    const gains = ready.length > 0 ? solve(report) : undefined;
    if (!gains) {
      return { outcome: 'short' };
    }
    const layer = smartEqRef.current;
    const written = gainsOf(layer);
    const measured = layerOf(gains, {
      status: report.status === 'ready' ? 'ready' : 'partial',
      lowFrequency: ready[0].lowFrequency,
      highFrequency: ready[ready.length - 1].highFrequency,
    });
    if (
      isApplyingRef.current ||
      !isSmartEqRewriteDue(SMART_EQ_LAYOUT, written, gains) ||
      describeSmartEqLayer(measured) === describeSmartEqLayer(layer)
    ) {
      return { outcome: 'unchanged', gains };
    }
    // The ranges that actually moved, for the graph to light and the bubble
    // to name — not every range the write happened to carry.
    const moved = movedRanges(report.regions, gains, written);
    // Shut before the write, not after it: setting the flag in the promise
    // body would leave a gap between deciding to write and being marked as
    // writing, which is precisely the gap a race lives in.
    isApplyingRef.current = true;
    // Ours, so the song recorder keeps its loan through this write.
    noteSmartEqWrite(measured);
    setSmartEq(measured);
    setSmartEqApi(measured)
      .catch(() => {
        // Reported nowhere on purpose: a write that fails from a loop nobody
        // started should not raise the banner over the whole workspace.
        // Measure again, or the next song, writes again.
      })
      .finally(() => {
        isApplyingRef.current = false;
        // Marked here and nowhere earlier: this is the moment the chain on
        // disk actually changed, so it is the moment the sound did.
        flashCorrection(moved);
      });
    // What just moved, phrased as a need — "Needs more deep bass" — so it is
    // the same voice the measurement underneath it speaks in.
    setSmartEqStatus(
      describeCorrectionNeed(
        getSmartEqBands(layer),
        gains,
        tRef.current,
        moved,
      ),
    );
    return { outcome: 'written', gains };
  };

  /**
   * A running mode's checkpoint: nothing until the measurement is done with
   * the song, then the one write and the tap closed. The last song's
   * correction plays on until then (Ivan, 2026-11-20: "not sure if measuring
   * all the time is good").
   */
  const applyReport = (report: IBalanceReport, controller: AbortController) => {
    if (isHeldRef.current || controller.signal.aborted) {
      return;
    }
    const phase = phaseOf(report);
    const word = tRef.current(
      phase === 'settling'
        ? 'autoEq.smart.phase.settling'
        : 'autoEq.smart.phase.listening',
    );
    if (word !== listeningForRef.current) {
      listeningForRef.current = word;
      setSmartEqListening(word);
    }
    if (!isReadyToHold(report)) {
      return;
    }
    isHeldRef.current = true;
    heldReportRef.current = report;
    const { outcome, gains } = writeHeld(report);
    showHeld(report, outcome, gains);
    listeningForRef.current = '';
    setSmartEqListening('');
    // Closes the tap: a held song is heard no further.
    controller.abort();
  };

  // Held on a ref so the measurement is not torn down and restarted on every
  // render. Restarting is the one thing this must not do casually: it would
  // take every region's accumulated evidence with it.
  const applyReportRef = useRef(applyReport);
  applyReportRef.current = applyReport;

  /**
   * A mode chosen while a song is held: the evidence is of the record and as
   * true under one destination as another, so the held report is solved
   * again at once rather than heard again.
   */
  useEffect(() => {
    const report = heldReportRef.current;
    if (!isHeldRef.current || !report || !isContinuousMode(smartEqMode)) {
      return;
    }
    const { outcome, gains } = writeHeld(report);
    showHeld(report, outcome, gains);
    // Only the mode: everything else the write reads is current through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [smartEqMode]);

  useEffect(() => {
    // Switching the Smart EQ layer off stops it: a loop writing a layer that
    // is not in the chain is work nobody can hear. The chip is the switch,
    // and it is one press away.
    if (!isContinuousOn || isRunning || isSmartBypassed) {
      return undefined;
    }

    const controller = new AbortController();
    continuousAbortRef.current = controller;
    isApplyingRef.current = false;
    isHeldRef.current = false;
    heldReportRef.current = undefined;
    startSmartEqPreview();
    // A fresh session has heard nothing yet, and saying otherwise would leave
    // the bubble asserting a condition from the last one.
    listeningForRef.current = tRef.current('autoEq.smart.phase.listening');
    setSmartEqListening(listeningForRef.current);

    const measurement = measureSource(
      {
        source: sourceKind,
        signal: controller.signal,
        isContinuous: true,
        // One song where something names the song; a forgetting window
        // where nothing does. See `songKey` above. Read here for the first
        // song; a later one still listening arrives by `restart`.
        halfLifeMs: songHalfLife(previousSongRef.current),
        onReport: (report) => applyReportRef.current(report, controller),
        onPreview: (preview) => showPreviewRef.current(preview),
      },
      tRef.current,
    );
    measurementRef.current = measurement;
    measurement.setSilent(!isPlayingRef.current);
    measurement.done.catch((error: unknown) => {
      // Aborting is how this ends, and an abort rejects: nothing to report.
      // Anything else is the tap on the source going away, which is worth a
      // sentence — the mode is still switched on and now hears nothing.
      if (
        !(error instanceof DOMException && error.name === 'AbortError') &&
        error instanceof Error
      ) {
        setSmartEqStatus(error.message);
      }
    });
    return () => {
      controller.abort();
      if (continuousAbortRef.current === controller) {
        continuousAbortRef.current = undefined;
      }
      if (measurementRef.current === measurement) {
        measurementRef.current = undefined;
      }
      isHeldRef.current = false;
      endSmartEqPreview();
    };
    // The tap restarts the measurement, because a different tap is a
    // different sound and everything heard through the old one is of a
    // source no longer playing. So does a new song after a hold, whose tap is
    // closed (`session`), and Measure again (`remeasures`). The mode does
    // not: see the effect above.
  }, [
    isRunning,
    isContinuousOn,
    isSmartBypassed,
    sourceKind,
    session,
    remeasures,
  ]);

  return null;
};

export default SmartEqEngine;
