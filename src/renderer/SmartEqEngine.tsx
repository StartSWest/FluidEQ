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

import { useEffect, useRef } from 'react';
import type { ISmartEqSettings } from 'common/constants';
import {
  describeSmartEqLayer,
  getSmartEqBands,
  getSmartEqLayout,
} from 'common/smartEq';
import {
  buildSmartEqSettings,
  confineSmartEqResponse,
  isSmartEqRewriteDue,
} from 'common/smartEqContinuous';
import { getReferenceShape } from 'common/referenceCurve';
import {
  describeBalanceProgress,
  describeBalanceResult,
  describeContinuousProgress,
  describeCorrectionNeed,
  describeCorrectionShape,
} from './utils/autoBalanceNarration';
import { getPresenceLine, presenceAllowance } from './utils/presenceThreshold';
import { getCorrectionLimit } from './utils/correctionLimit';
import { useFluidEqContext } from './utils/FluidEqContext';
import { useTranslation } from './utils/I18nContext';
import { setSmartEq as setSmartEqApi } from './utils/equalizerApi';
import { noteSmartEqWrite } from './audio/songEqSession';
import { useNowPlayingIdentity } from './audio/nowPlayingIdentity';
import { usePlaybackOwner } from './audio/playbackOwner';
import { IMeasurement, measureSource } from './audio/smartEqMeasurement';
import type { TRawSourceKind } from './audio/rawSource';
import { useContinuousEq } from './utils/continuousEq';
import { isContinuousMode, useSmartEqMode } from './utils/smartEqMode';
import { buildBalancedGains } from './utils/autoBalance';
import {
  CONTINUOUS_HALF_LIFE_MS,
  IBalanceRegionReport,
  IBalanceReport,
} from './utils/autoBalanceCapture';
import { flashCorrection } from './utils/correctionFlash';
import { planBandReveal, revealBands } from './utils/bandReveal';
import {
  registerSmartEqControl,
  setSmartEqListening,
  setSmartEqRunning,
  setSmartEqStatus,
  useSmartEqRun,
} from './utils/smartEqRun';

/**
 * How long the bubble stays up after the last thing it had to say.
 *
 * It is a remark, not a readout. These modes run for hours and are silent for
 * most of that — nothing is written once a correction has settled — so a bubble
 * that stayed put would be a stale sentence hanging over the toolbar all
 * evening, describing something that finished long ago.
 *
 * Long enough to read twice, and reset by anything new, so a measurement
 * reporting progress every second keeps it up for as long as it is working. An
 * unchanged message does not reset it: saying the same thing again is not news,
 * and by then the correction has stopped moving.
 */
const STATUS_LINGER_MS = 6000;

/**
 * How far a band has to move for its range to be named and lit as "moved"
 * when a running mode writes, in dB. Below it the write is a refinement of a
 * range that was already right, and lighting it would say something changed
 * there that nobody can hear.
 */
const MOVED_DB = 0.5;

/** The bands a solve is asked for: the fixed layout, every gain at zero. */
const LAYOUT = getSmartEqLayout();

/** The layer's gains by band id, zero where it holds nothing. */
const gainsOf = (layer: ISmartEqSettings | undefined): Record<string, number> =>
  Object.fromEntries(
    getSmartEqBands(layer).map((band) => [band.id, band.gain]),
  );

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
  /** What the page shows, and the flag the loop stands down for. */
  const { status, isRunning } = useSmartEqRun();
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
    measurementRef.current?.setSilent(!isPlaying);
  }, [isPlaying]);
  /**
   * A new song is a different record: the accumulator starts again, on the
   * same tap. Not a restart of the whole session — that would close the tap
   * and reopen it, which for the process loopback is the capture helper
   * spawned afresh at every track change.
   */
  const songHalfLife = (key: string | undefined) =>
    key === undefined ? CONTINUOUS_HALF_LIFE_MS : undefined;
  const previousSongRef = useRef(songKey);
  useEffect(() => {
    if (previousSongRef.current === songKey) {
      return;
    }
    previousSongRef.current = songKey;
    measurementRef.current?.restart(songHalfLife(songKey));
  }, [songKey]);
  /**
   * What the capture is still waiting to hear, for the bubble's resting state.
   *
   * Published separately from the status, which is a remark with a timer on it:
   * this one is a condition, true for as long as it is true, and it must not be
   * cleared by a timeout that exists to stop a sentence going stale.
   *
   * Written only when the answer CHANGES, which is a handful of times per
   * capture rather than once a second — the EQ page lays out every band in
   * the editor and it subscribes to this, so a publish per checkpoint would
   * re-render the lot at the analyser's cadence.
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

  /**
   * How much boost each frequency has earned, read off the lines on the plot.
   *
   * Built here rather than inside the solver, because it joins two things the
   * solver has no business knowing about: what each range is doing at this
   * moment, which comes off the capture, and where somebody has dragged that
   * range's two lines, which is a preference. The solver is handed one number
   * per frequency and stays a function of its own measurement.
   *
   * Ranges are contiguous and a band falls in exactly one, so this is a scan
   * rather than an interpolation. Blending across an edge would let a silent
   * range borrow permission from a loud neighbour, which is the whole failure
   * being fixed, one step removed.
   */
  const allowanceFrom =
    (regions: IBalanceRegionReport[]) => (frequency: number) => {
      const region = regions.find(
        (entry) =>
          frequency >= entry.lowFrequency && frequency <= entry.highFrequency,
      );
      if (!region) {
        /*
         * No range covering this frequency means no presence information about
         * it, which is not the same claim as "nothing is playing here" — and
         * answering zero makes the second claim. A capture that reported no
         * ranges at all would then refuse every correction, silently, and look
         * exactly like a measurement that had decided the record was perfect.
         *
         * So absence of evidence permits rather than forbids. Everything
         * downstream still bounds it, and a frequency genuinely outside the
         * correctable span is declined long before this is consulted.
         */
        return 1;
      }
      return presenceAllowance(
        region.liveDb,
        getPresenceLine(
          'floor',
          region.label,
          region.centreFrequency,
          region.typicalDb,
        ),
        getPresenceLine(
          'full',
          region.label,
          region.centreFrequency,
          region.typicalDb,
        ),
      );
    };

  /**
   * The whole answer for a measured spectrum: the mode's destination, the
   * presence lines' allowance, the limit line, and nothing else — no layer,
   * no history. Undefined when the measurement cannot support an answer at
   * all (too narrow a trusted span for the tilt fit).
   */
  const solve = (
    report: Pick<IBalanceReport, 'samples' | 'regions'>,
  ): Record<string, number> | undefined => {
    const gains = buildBalancedGains(report.samples, LAYOUT, {
      // The mode's curve, whatever else is switched on. Which mode is chosen
      // decides the destination and nothing else does — see
      // `getReferenceShape`.
      reference: getReferenceShape(referenceModeRef.current),
      // A range nothing is playing in cannot be lifted, however loudly it
      // reports a deficit. See the presence lines on the plot.
      boostAllowance: allowanceFrom(report.regions),
      // Symmetric limits, whatever the listener chose. An asymmetric pair
      // biases a centred correction; see `correctionLimit`.
      maxBoost: getCorrectionLimit(),
      maxCut: getCorrectionLimit(),
    });
    if (Object.keys(gains).length === 0) {
      return undefined;
    }
    // The limit line bounds the CURVE, and bells sum: two lawful bands can
    // stack past it. Out of bounds is scaled home — see confineSmartEqResponse.
    return confineSmartEqResponse(gains, LAYOUT, getCorrectionLimit());
  };

  /** The solved gains as the layer to write, keeping the listener's strength. */
  const layerOf = (
    gains: Record<string, number>,
    measurement: Pick<
      ISmartEqSettings,
      'status' | 'lowFrequency' | 'highFrequency'
    >,
  ): ISmartEqSettings | undefined =>
    buildSmartEqSettings(
      LAYOUT,
      gains,
      {
        ...measurement,
        // The strength the listener set survives the write: a measurement is
        // a new shape for the layer, not a decision about how much of it to
        // apply.
        intensity: smartEqRef.current?.intensity,
      },
      getCorrectionLimit(),
    );

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

  // Said, then gone. See `STATUS_LINGER_MS`.
  useEffect(() => {
    if (!status) {
      return undefined;
    }
    const timer = window.setTimeout(
      () => setSmartEqStatus(''),
      STATUS_LINGER_MS,
    );
    return () => window.clearTimeout(timer);
  }, [status]);

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
      if (describeSmartEqLayer(measured) === describeSmartEqLayer(layer)) {
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
   * A running mode: solve from what has been heard of this song so far, and
   * write the answer when it has settled and differs from what is written.
   *
   * Every checkpoint brings the whole report. Nothing is remembered between
   * two of them — no destination, no step, no drift — because the estimate
   * behind the report IS the memory, and it is of the record: the answer at
   * any checkpoint is the answer for the song heard up to then. Two things
   * hold a write back, and both are conditions rather than clocks: the
   * estimate has to have settled (three checkpoints within a fraction of a
   * decibel, `isConverged`), so the layer is not rewritten while an intro is
   * still becoming a chorus; and the fresh answer has to differ from the
   * written layer by an audible amount (`isSmartEqRewriteDue`), so a
   * refinement nobody could hear is not a reload on the engine's side.
   */
  const applyReport = (report: IBalanceReport) => {
    // One correction at a time. A write is the IPC, the config rewrite and
    // the engine noticing; a second solve arriving while one is in flight
    // would be written over the top of it in whichever order they finish.
    if (isApplyingRef.current) {
      return;
    }
    // Not from an estimate that is still moving, and not from one that has
    // deliberately stopped — see `fullBandGate`: the record has dropped an
    // end of its spectrum and nothing is being heard.
    if (!report.isConverged || report.isBandLimited) {
      return;
    }
    const ready = report.regions.filter((region) => region.isCovered);
    if (ready.length === 0) {
      return;
    }
    const gains = solve(report);
    if (!gains) {
      // No answer this time. The tilt fit needs a wide trusted span, and a
      // song whose midrange has not been heard yet cannot support one. A
      // cycle skipped, not a wrong correction.
      return;
    }
    const layer = smartEqRef.current;
    const written = gainsOf(layer);
    if (!isSmartEqRewriteDue(LAYOUT, written, gains)) {
      return;
    }
    const measured = layerOf(gains, {
      status: report.status === 'ready' ? 'ready' : 'partial',
      lowFrequency: ready[0].lowFrequency,
      highFrequency: ready[ready.length - 1].highFrequency,
    });
    if (describeSmartEqLayer(measured) === describeSmartEqLayer(layer)) {
      return;
    }
    // The ranges that actually moved, for the graph to light and the bubble
    // to name — not every range the write happened to carry.
    const moved = report.regions.filter((region) =>
      LAYOUT.some(
        (band) =>
          band.frequency >= region.lowFrequency &&
          band.frequency <= region.highFrequency &&
          Math.abs((gains[band.id] ?? 0) - (written[band.id] ?? 0)) >= MOVED_DB,
      ),
    );

    // Shut before the write, not after it: setting the flag in the promise
    // body would leave a gap between deciding to write and being marked as
    // writing, which is precisely the gap a race lives in.
    isApplyingRef.current = true;
    // Ours, so the song recorder keeps its loan through this refinement.
    noteSmartEqWrite(measured);
    setSmartEq(measured);
    setSmartEqApi(measured)
      .catch(() => {
        // Reported nowhere on purpose: a write that fails from a loop nobody
        // started should not raise the banner over the whole workspace. The
        // next settled solve writes again.
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
  };

  // Held on a ref so the measurement is not torn down and restarted on every
  // render. Restarting is the one thing this must not do casually: it would
  // take every region's accumulated evidence with it.
  const applyReportRef = useRef(applyReport);
  applyReportRef.current = applyReport;

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
    // A fresh session has heard nothing yet, and saying otherwise would leave
    // the bubble asserting a condition from the last one.
    listeningForRef.current = tRef.current('eq.smart.status.listening');
    setSmartEqListening(listeningForRef.current);

    const measurement = measureSource(
      {
        source: sourceKind,
        signal: controller.signal,
        isContinuous: true,
        // One song, measured whole, where something names the song; a
        // forgetting window where nothing does. See `songKey` above. Read
        // here for the first song; every later one arrives by `restart`.
        halfLifeMs: songHalfLife(previousSongRef.current),
        // The same shape of sentence the button's own measurement writes, in
        // the plural, because this measurement is in the plural — see
        // `describeContinuousProgress`. Written only when the wording
        // changes: a publish is a re-render of the whole editor.
        onProgress: (progress) => {
          const next = describeContinuousProgress(progress, tRef.current);
          if (next !== listeningForRef.current) {
            listeningForRef.current = next;
            setSmartEqListening(next);
          }
        },
        onReport: (report) => applyReportRef.current(report),
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
    };
    // The tap restarts the measurement, because a different tap is a
    // different sound and everything heard through the old one is of a
    // source no longer playing. The mode does not: the evidence is of the
    // record and is as true under one destination as another, so the loop
    // reads the mode from a ref and the next settled solve aims there. A new
    // song restarts the accumulator, not the session — see `restart`.
  }, [isRunning, isContinuousOn, isSmartBypassed, sourceKind]);

  return null;
};

export default SmartEqEngine;
