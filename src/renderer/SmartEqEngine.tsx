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

import { startTransition, useEffect, useRef, useState } from 'react';
import type { ISmartEqSettings } from 'common/constants';
import {
  SMART_EQ_MAX_FREQUENCY,
  SMART_EQ_MIN_FREQUENCY,
  describeSmartEqLayer,
  getSmartEqBands,
  hasSmartEqLayer,
} from 'common/smartEq';
import {
  describeBalanceProgress,
  describeBalanceResult,
  describeCorrectionNeed,
  describeCorrectionShape,
} from './utils/autoBalanceNarration';
import { useFluidEqContext } from './utils/FluidEqContext';
import { useFluidEqSmartEq } from './utils/fluidEqSmartEq';
import { useTranslation } from './utils/I18nContext';
import { setSmartEq as setSmartEqApi } from './utils/equalizerApi';
import {
  isSongSoundLent,
  noteSmartEqHeld,
  noteSmartEqWrite,
} from './audio/songEqSession';
import { createSmartEqLive } from './audio/smartEqLive';
import { useCurrentEngine } from './utils/audioEngineContext';
import { useNowPlayingIdentity } from './audio/nowPlayingIdentity';
import { usePlaybackOwner } from './audio/playbackOwner';
import { useLastPlayingOwner } from './audio/transportSource';
import {
  IMeasurement,
  ISmartEqPreviewReport,
  measureSource,
} from './audio/smartEqMeasurement';
import type { TRawSourceKind } from './audio/rawSource';
import { useContinuousEq } from './utils/continuousEq';
import {
  CONTINUOUS_HALF_LIFE_MS,
  IBalanceReport,
} from './utils/autoBalanceCapture';
import {
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
  departSmartEqPreview,
  endSmartEqPreview,
  getSmartEqPreview,
  publishSmartEqPreview,
  startSmartEqPreview,
  useSmartEqRemeasures,
} from './utils/smartEqPreview';
import { THeldSongs, createHeldSongs } from './utils/heldSongs';
import {
  SONG_LISTEN_BOUNDS,
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
 * of the record, and a solve REPLACES the layer rather than adding to it.
 * The same record gives the same layer whatever was applied before and
 * whatever was played before — and
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
  const { setSmartEq, getBandSetGeneration, bypassed } = useFluidEqContext();
  const smartEq = useFluidEqSmartEq();
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
  /**
   * Which tap hears the source. The Library plays through FluidEQ's own host,
   * whose input tap is the decoded file; everything else is heard through the
   * process loopback, which Windows delivers ahead of the endpoint's effects.
   *
   * Asked of whoever last played, not of who owns playback this instant: the
   * Library gives up ownership the moment it pauses, so a pause flipped the
   * tap to the process loopback and a resume flipped it back — each flip a
   * new session, the song heard again from nothing and written again
   * mid-song.
   */
  const owner = usePlaybackOwner();
  const lastPlayingOwner = useLastPlayingOwner();
  const sourceKind: TRawSourceKind =
    (owner ?? lastPlayingOwner) === 'library' ? 'host' : 'process';
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
  /**
   * The songs that are done, kept apart from the session that heard them
   * (`heldSongs.ts`).
   *
   * The hold used to live and die with the measuring effect, so anything
   * that re-ran that effect — the Smart chip switched off and on, the tap
   * changing, the running mode toggled — forgot the song was done and heard
   * it again from nothing, writing a second curve from a different stretch
   * of it. And a player whose title flickered (an ad, a media session
   * dropping for a moment) counted as two song changes, so the same song
   * came back as a new one. A song now stays done until Measure again is
   * pressed on it: coming back to it resumes its hold and measures nothing.
   */
  const heldSongsRef = useRef<THeldSongs>(createHeldSongs());
  const [session, setSession] = useState(0);
  const remeasures = useSmartEqRemeasures();
  /** The Measure again count the held songs were last checked against. */
  const remeasuredRef = useRef(remeasures);
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
  /**
   * The Smart layer as it plays: what the window holds, or a step shown a
   * moment ago that the window has not drawn yet (`show` below). Taken from
   * the window only when the window's layer moves, so a render for anything
   * else while a step waits to be drawn does not put the layer before it back
   * — the walk would then measure its next step from a layer no longer
   * playing, and step twice as far.
   */
  const smartEqRef = useRef(smartEq);
  const windowSmartEqRef = useRef(smartEq);
  if (windowSmartEqRef.current !== smartEq) {
    windowSmartEqRef.current = smartEq;
    smartEqRef.current = smartEq;
  }
  const setSmartEqRef = useRef(setSmartEq);
  setSmartEqRef.current = setSmartEq;
  const engine = useCurrentEngine();
  const engineRef = useRef(engine);
  engineRef.current = engine;
  /** `ISmartEqLiveDeps.canWalk`, read through refs so it is always current. */
  const canWalk = () => engineRef.current === 'fluid' && !isSongSoundLent();
  /**
   * The correction put on while it is measured, not only at the end (Ivan,
   * 2026-11-27) — `audio/smartEqLive.ts`, and the reasoning in
   * `utils/smartEqLiveApply.ts`. Every write a measurement makes goes through
   * it. The ref mirrors what is shown at once, so a step half a second later
   * steps from it whether or not the window has drawn since.
   *
   * Shown as a transition. The engine has the step already (`smartEqLive`
   * writes it first); what is left is the graph drawing its Smart line and the
   * output curve 0.5 dB nearer, and drawn urgently that was one block of the
   * main thread a step — about once a second while a song is measured — that
   * every frame of the graph waited behind (measured 2026-11-27 in the app
   * harness: a long task at every step). As a transition React draws it in
   * slices between frames; a newer step simply replaces it.
   */
  const [live] = useState(() =>
    createSmartEqLive({
      playing: () => smartEqRef.current,
      show: (layer) => {
        smartEqRef.current = layer;
        startTransition(() => setSmartEqRef.current(layer));
      },
      canWalk,
      songKey: () => previousSongRef.current,
    }),
  );
  useEffect(() => {
    if (previousSongRef.current === songKey) {
      return;
    }
    heldSongsRef.current.leave(previousSongRef.current);
    previousSongRef.current = songKey;
    // The last song's walk, if one was still landing, ends with it: its
    // curve goes with the song (`closeSession`), and the new song forms
    // from what plays now.
    live.begin();
    // Held, a new session opens a tap for the new song or resumes it if it
    // was held before; on a held song, it closes whatever was measuring
    // meanwhile. The session effect decides which.
    if (isHeldRef.current || heldSongsRef.current.get(songKey)) {
      setSession((count) => count + 1);
      return;
    }
    if (measurementRef.current) {
      measurementRef.current.restart(songHalfLife(songKey));
      startSmartEqPreview();
    }
    // `live` is made once and never changes; named so the rule can see it.
  }, [songKey, live]);
  /**
   * The running mode's phase in a word, for the bubble: a condition rather
   * than a remark (`useSmartEqStatus`), and written only when it changes, since
   * the EQ page's editor subscribes to it. The heard seconds live in the
   * preview store, read by the two small things that draw them.
   */
  const listeningForRef = useRef('');
  /**
   * Which tap the loop should open, read from a ref: the callbacks inside a
   * measurement are held for as long as it runs, so reading it through state
   * would give them whatever was current when it started.
   */
  const sourceKindRef = useRef(sourceKind);
  sourceKindRef.current = sourceKind;

  /** The whole answer for a report. */
  const solve = (report: Pick<IBalanceReport, 'samples' | 'regions'>) =>
    solveSmartEq(report);

  /** The solved gains as the layer to write, keeping the listener's strength. */
  const layerOf = (
    gains: Record<string, number>,
    measurement: Parameters<typeof smartEqLayerOf>[1],
  ) => smartEqLayerOf(gains, measurement, smartEqRef.current?.intensity);

  /** What a report measured, as the layer records it. */
  const measuredOf = (report: Pick<IBalanceReport, 'regions' | 'status'>) => {
    const covered = report.regions.filter((region) => region.isCovered);
    return {
      status:
        report.status === 'ready' ? ('ready' as const) : ('partial' as const),
      lowFrequency: covered[0]?.lowFrequency ?? SMART_EQ_MIN_FREQUENCY,
      highFrequency:
        covered[covered.length - 1]?.highFrequency ?? SMART_EQ_MAX_FREQUENCY,
    };
  };

  /** Gains to the layer a report writes, for a step or for the take. */
  const builderOf =
    (measurement: Parameters<typeof smartEqLayerOf>[1]) =>
    (gains: Record<string, number>) =>
      layerOf(gains, measurement);

  /**
   * A measurement that ends with no curve to land — too little heard to
   * correct, cancelled, its tap gone — leaves the sound as it found it: what
   * the walk put on comes off again, walked off on `tap`'s music where the
   * tap is still open and put back at once where it is not. Left on, a
   * half-formed curve played on under "the sound stays as it was".
   */
  const unform = (tap?: AbortController) => {
    const formed = live.endForming();
    if (formed) {
      live.land(
        formed.layer,
        builderOf({
          status: 'partial',
          lowFrequency: SMART_EQ_MIN_FREQUENCY,
          highFrequency: SMART_EQ_MAX_FREQUENCY,
        }),
        () => undefined,
        tap,
      );
    }
  };

  /**
   * The curve forming on the graph, from a checkpoint: solved exactly as the
   * hold will write it, at the layer's strength — and what plays one step
   * nearer it (`live.form`).
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
      isHeardForming: canWalk(),
    });
    // And heard, a step at a time: the same solve, so what plays walks
    // toward exactly the curve drawn forming.
    if (gains) {
      live.form(gains, builderOf(measuredOf(report)));
    }
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
   * What was heard, and then what was done about it. The first half
   * describes a measurement; the second is the gains written, which are on
   * disk and can be argued with.
   *
   * Joined through a key rather than with a template literal, because the
   * separator between the two halves is a typographic decision and one of the
   * ten dictionaries may want a different one.
   */
  const describeTake = (
    result: Parameters<typeof describeBalanceResult>[0],
    measured: ISmartEqSettings | undefined,
  ) => {
    const shape = describeCorrectionShape(
      Object.values(measured?.filters ?? {}),
      tRef.current,
    );
    const heard = describeBalanceResult(result, tRef.current);
    return shape
      ? tRef.current('eq.smart.result.withShape', { result: heard, shape })
      : heard;
  };

  /**
   * The one-shot, reachable from the store's control (`registerSmartEqControl`).
   *
   * `autoBalance` is rebuilt every render and closes over half the component,
   * so the control, registered once, reaches it through this ref.
   */
  const runAutoBalanceRef = useRef(() => {});

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
    // And a fresh forming: whatever was walking in belongs to what this press
    // replaces.
    live.begin();

    balanceRunRef.current += 1;
    const runId = balanceRunRef.current;
    const isCurrentRun = () => balanceRunRef.current === runId;
    const controller = new AbortController();
    balanceAbortRef.current = controller;

    setSmartEqRunning(true);
    isHeldRef.current = false;
    // A press is a fresh answer for this song: a running mode coming back
    // after it measures the song again rather than putting the old hold back
    // over what the press wrote.
    heldSongsRef.current.forget(previousSongRef.current);
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
          // The tap outlives the take while its curve walks in.
          onAfterTake: (isLast) => live.afterTake(controller, isLast),
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
        unform(controller);
        showHeld(result, 'short', undefined);
        setSmartEqStatus(tRef.current('eq.smart.status.notEnoughRange'));
        return;
      }
      const build = builderOf({
        status: result.status,
        lowFrequency: result.lowFrequency,
        highFrequency: result.highFrequency,
      });
      const measured = build(gains);
      // What played before the measurement moved anything, when it did: what
      // the press found is a question about the take, not about the last
      // step of the walk toward it.
      const formed = live.endForming();
      const before = formed ? formed.layer : layer;
      const isInPlace =
        describeSmartEqLayer(measured) ===
        describeSmartEqLayer(smartEqRef.current);

      // Compared on what will be written, not on object identity: a run that
      // lands within the rounding step of what is applied has genuinely found
      // nothing left to correct.
      const isUnchanged =
        describeSmartEqLayer(measured) === describeSmartEqLayer(before);
      showHeld(result, isUnchanged ? 'unchanged' : 'written', gains);
      if (isUnchanged && (isInPlace || !formed)) {
        // What plays is this song's measurement: the song's, for this play.
        if (measured) {
          noteSmartEqHeld(measured);
        }
        setSmartEqStatus(tRef.current('eq.smart.status.alreadyBalanced'));
        return;
      }

      if (formed) {
        // The curve has been coming in, heard and drawn, while it formed: no
        // reveal. The take's own curve lands now when it is a step away or
        // nearer, and otherwise on the music's next half seconds.
        if (!isInPlace) {
          live.land(measured, build, () => undefined, controller);
        }
        if (measured) {
          noteSmartEqHeld(measured);
        }
        setSmartEqStatus(
          isUnchanged
            ? tRef.current('eq.smart.status.alreadyBalanced')
            : describeTake(result, measured),
        );
        return;
      }

      // Nothing walked in — Equalizer APO, a song's own kept sound playing,
      // or a curve that never moved what plays — so the take is written
      // whole and drawn arriving, as it always was; the tap has nothing
      // left to do.
      controller.abort();
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
      // Measure once is of the song playing: saved for it where saving is
      // on, and taken off at its end either way.
      if (measured) {
        noteSmartEqHeld(measured);
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

      setSmartEqStatus(describeTake(result, measured));
    } catch (e) {
      if (!isCurrentRun()) {
        return;
      }
      // Cancelled or failed: nothing to land, and the tap is already shut.
      unform();
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
      // The tap closes with the run, unless the take's curve is still
      // walking in on it.
      if (!live.isWalkingOn(controller)) {
        controller.abort();
      }
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
   * Written whenever it is not exactly what plays. It also had to differ by
   * a decibel somewhere on the curve, which kept a song on the LAST song's
   * curve whenever the two were close, so what a song played under depended
   * on what played before it. That rule was for a loop rewriting one song
   * all evening; a hold writes once per song, and the same song played again
   * resumes its own hold (`heldSongs.ts`), which describes the same layer and
   * writes nothing. The tilt fit still needs a wide trusted span.
   *
   * Judged against what played before the song's curve started coming in
   * (`endForming`), so "written" and what the bubble names are the change
   * the song got, not the last step of it. Written through `smartEqLive`:
   * given the tap, a curve more than a step from what plays walks in on it.
   * It used to refuse while a write was in flight, which once kept two
   * checkpoints of an older loop from both writing; every write now goes out
   * in the order it was decided and the last one wins, and the refusal could
   * only drop a newer answer.
   */
  const writeHeld = (
    report: IBalanceReport,
    tap?: AbortController,
  ): {
    outcome: TSmartEqHeldOutcome;
    gains?: Record<string, number>;
    /** What the song measures to, written now or already playing. */
    layer?: ISmartEqSettings;
  } => {
    const ready = report.regions.filter((region) => region.isCovered);
    const gains = ready.length > 0 ? solve(report) : undefined;
    if (!gains) {
      unform(tap);
      return { outcome: 'short' };
    }
    const playing = smartEqRef.current;
    const formed = live.endForming();
    const before = formed ? formed.layer : playing;
    const build = builderOf(measuredOf(report));
    const measured = build(gains);
    const isNew =
      describeSmartEqLayer(measured) !== describeSmartEqLayer(before);
    const isInPlace =
      describeSmartEqLayer(measured) === describeSmartEqLayer(playing);
    if (!isNew && isInPlace) {
      return { outcome: 'unchanged', gains, layer: measured };
    }
    // The ranges that actually moved, for the graph to light and the bubble
    // to name — not every range the write happened to carry.
    const moved = isNew
      ? movedRanges(report.regions, gains, gainsOf(before))
      : [];
    if (isInPlace) {
      // The walk has already brought it here.
      flashCorrection(moved);
    } else {
      // Ours, so the song recorder keeps its loan through it. Marked when it
      // lands and nowhere earlier: that is the moment the chain on disk
      // reaches the song's curve, so it is the moment the sound does.
      live.land(measured, build, () => flashCorrection(moved), tap);
    }
    if (!isNew) {
      return { outcome: 'unchanged', gains, layer: measured };
    }
    // What just moved, phrased as a need — "Needs more deep bass" — so it is
    // the same voice the measurement underneath it speaks in.
    setSmartEqStatus(
      describeCorrectionNeed(
        getSmartEqBands(before),
        gains,
        tRef.current,
        moved,
      ),
    );
    return { outcome: 'written', gains, layer: measured };
  };

  /**
   * A running mode's checkpoint: nothing until the measurement is done with
   * the song, then the take held, its curve landed and the tap closed (Ivan,
   * 2026-11-20: "not sure if measuring all the time is good"). Until then the
   * curve comes in a step at a time as it forms, under the FluidEQ Engine
   * (Ivan, 2026-11-27: "continue to apply the EQ while measuring"); the
   * last song's correction no longer plays on, it went with the last song.
   */
  const applyReport = (
    report: IBalanceReport,
    controller: AbortController,
    measurement: IMeasurement,
  ) => {
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
    // A held song is measured no further: the take is this report, the
    // moment it was ready, exactly as when nothing was put on before it.
    measurement.hold();
    const { outcome, gains, layer } = writeHeld(report, controller);
    heldSongsRef.current.set(previousSongRef.current, {
      report,
      outcome,
      gains,
    });
    // Done with this song: saved for it now, and its alone.
    if (layer) {
      noteSmartEqHeld(layer);
    }
    showHeld(report, outcome, gains);
    listeningForRef.current = '';
    setSmartEqListening('');
    // Closes the tap, unless the song's curve is walking in on its music.
    if (!live.isWalkingOn(controller)) {
      controller.abort();
    }
  };

  // Held on a ref so the measurement is not torn down and restarted on every
  // render. Restarting is the one thing this must not do casually: it would
  // take every region's accumulated evidence with it.
  const applyReportRef = useRef(applyReport);
  applyReportRef.current = applyReport;
  const writeHeldRef = useRef(writeHeld);
  writeHeldRef.current = writeHeld;
  const unformRef = useRef(unform);
  unformRef.current = unform;

  useEffect(() => {
    // Switching the Smart EQ layer off stops it: a loop writing a layer that
    // is not in the chain is work nobody can hear. The chip is the switch,
    // and it is one press away.
    if (!isContinuousOn || isRunning || isSmartBypassed) {
      return undefined;
    }

    // A session of its own forms afresh, and a walk left from the last one
    // ended with it.
    live.begin();
    const songs = heldSongsRef.current;
    if (remeasuredRef.current !== remeasures) {
      // Measure again: this song is heard afresh.
      remeasuredRef.current = remeasures;
      songs.forget(previousSongRef.current);
    }
    const held = songs.get(previousSongRef.current);
    if (held) {
      // Done with this song already: nothing to hear. Written again only if
      // the layer playing is not this song's curve (another song's, or one
      // put on while the mode was off) — the same solve of the same report,
      // so the same curve every time. The same holdId, so the graph does not
      // play the arrival again.
      isHeldRef.current = true;
      const again = writeHeldRef.current(held.report);
      const outcome = again.outcome === 'written' ? 'written' : held.outcome;
      songs.set(previousSongRef.current, {
        ...held,
        outcome,
        gains: again.gains,
      });
      publishSmartEqPreview({
        phase: 'held',
        outcome,
        isSilent: false,
        missing: missingRangesOf(held.report),
        regions: previewRegionsOf(held.report),
        gains:
          again.gains && atStrength(again.gains, smartEqRef.current?.intensity),
      });
      listeningForRef.current = '';
      setSmartEqListening('');
      return () => {
        isHeldRef.current = false;
        endSmartEqPreview();
      };
    }

    const controller = new AbortController();
    continuousAbortRef.current = controller;
    isHeldRef.current = false;
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
        ...SONG_LISTEN_BOUNDS,
        // One song where something names the song; a forgetting window
        // where nothing does. See `songKey` above. Read here for the first
        // song; a later one still listening arrives by `restart`.
        halfLifeMs: songHalfLife(previousSongRef.current),
        onReport: (report) =>
          applyReportRef.current(report, controller, measurement),
        onPreview: (preview) => showPreviewRef.current(preview),
        // After the hold the tap is only the walk's cadence (`applyReport`).
        onAfterTake: (isLast) => live.afterTake(controller, isLast),
      },
      tRef.current,
    );
    measurementRef.current = measurement;
    measurement.setSilent(!isPlayingRef.current);
    measurement.done.catch((error: unknown) => {
      // Aborting is how this ends, and an abort rejects: nothing to report.
      // Anything else is the tap on the source going away, which is worth a
      // sentence — the mode is still switched on and now hears nothing —
      // unless the song was already held, when the tap was only carrying
      // the last of its curve in and that has landed whole (`onAfterTake`).
      if (
        (error instanceof DOMException && error.name === 'AbortError') ||
        isHeldRef.current
      ) {
        return;
      }
      // Nothing is measuring any more, so nothing may say it is: the graph's
      // chip and the panel went on reading "Listening" over a tap that had
      // failed, which looked exactly like a measurement that never ends.
      if (measurementRef.current === measurement) {
        measurementRef.current = undefined;
      }
      // And what its curve put on comes off with it.
      unformRef.current();
      endSmartEqPreview();
      listeningForRef.current = '';
      setSmartEqListening('');
      setSmartEqStatus(
        error instanceof Error
          ? error.message
          : tRef.current('eq.smart.status.failed'),
      );
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
    // closed (`session`), and Measure again (`remeasures`). A song already
    // held is never measured again by any of these but Measure again: see
    // `heldSongsRef`. `live` is made once and never changes.
  }, [
    live,
    isRunning,
    isContinuousOn,
    isSmartBypassed,
    sourceKind,
    session,
    remeasures,
  ]);

  /**
   * Smart correction switched off takes its correction off: out of what is
   * heard and off the graph (Ivan, 2026-11-20: "when smart correction is
   * turned off, the curves need to disappear too"). Switching off used to
   * stop the measuring and leave the last curve written, playing and drawn.
   * Switched on again, the song playing resumes its hold (`heldSongs.ts`) and
   * its curve comes back without being measured again.
   *
   * Only on the switch going from on to off: a window opening with the mode
   * off leaves whatever a one-shot press last wrote. The graph is handed the
   * curve that leaves, to fade out where the layer's line just was.
   */
  const wasContinuousOnRef = useRef(isContinuousOn);
  useEffect(() => {
    const wasOn = wasContinuousOnRef.current;
    wasContinuousOnRef.current = isContinuousOn;
    const layer = smartEqRef.current;
    if (!wasOn || isContinuousOn || !hasSmartEqLayer(layer)) {
      return;
    }
    departSmartEqPreview(atStrength(gainsOf(layer), layer?.intensity));
    noteSmartEqWrite(undefined);
    setSmartEq(undefined);
    setSmartEqApi(undefined).catch(() => {
      // Reported nowhere, like every background Smart EQ write here; the
      // next song or a press of the switch writes again.
    });
    // Only the switch: the layer and the setters are read through refs or
    // are stable, and this must not run when they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [isContinuousOn]);

  return null;
};

export default SmartEqEngine;
