/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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
import {
  TSmartEqDrift,
  blendSmartEqTarget,
  buildSmartEqSettings,
  confineSmartEqResponse,
  describeSmartEqLayer,
  getSmartEqBands,
  stepSmartEqGains,
  CONTINUOUS_SETTLE_DB,
} from 'common/smartEq';
import { getReferenceShape } from 'common/referenceCurve';
import { getVoicingFilters } from 'common/voicing';
import { getDriverFilters } from 'common/driver';
import { getHeadphoneFilters } from 'common/headphone';
import { getPresenceLine, presenceAllowance } from './utils/presenceThreshold';
import { getCorrectionLimit } from './utils/correctionLimit';
import { useFluidEqContext } from './utils/FluidEqContext';
import { useTranslation } from './utils/I18nContext';
import { sortHelper } from './utils/utils';
import { setSmartEq as setSmartEqApi } from './utils/equalizerApi';
import { useLiveAudioControl } from './audio/LiveAudioContext';
import { useContinuousEq } from './utils/continuousEq';
import { isContinuousMode, useSmartEqMode } from './utils/smartEqMode';
import {
  IBalanceRegionReport,
  IBalanceReport,
  buildBalancedGains,
  describeBalanceProgress,
  describeContinuousProgress,
  describeBalanceResult,
  describeCorrectionNeed,
  describeCorrectionShape,
} from './utils/autoBalance';
import { flashCorrection } from './utils/correctionFlash';
import {
  setSmartEqDisagreement,
  setSmartEqQuietUntil,
} from './utils/smartEqDisagreement';
import {
  buildChainGainDb,
  buildLayerTargetCurve,
} from './utils/layerTargetCurve';
import { planBandReveal, revealBands } from './utils/bandReveal';
import {
  registerSmartEqControl,
  setSmartEqListening,
  setSmartEqRunning,
  setSmartEqStatus,
  useSmartEqRun,
} from './utils/smartEqRun';

/**
 * How many times a measurement will restart itself.
 *
 * Changing the sound mid-capture restarts rather than cancels. Bounded so that
 * someone fiddling with sliders while it listens eventually gets an answer
 * instead of an endless loop.
 */
const MAX_BALANCE_ATTEMPTS = 3;

/**
 * How long after a correction lands before the analyser is believed again.
 *
 * Equalizer APO reloads its config when the file changes, and what comes out
 * while it does is neither the old chain nor the new one. Averaging that in is
 * how a correction ends up measured against half of itself — and the regions
 * that were just corrected are exactly the ones freshly cleared and listening,
 * so they are exactly the ones that would swallow it.
 *
 * Three quarters of a second is comfortably longer than a reload and shorter
 * than the gap between two checkpoints, so in the ordinary case it costs
 * nothing at all: the window has closed again before the next one is due.
 */
const CONTINUOUS_SETTLE_MS = 750;

/** After this, an outstanding write is treated as lost rather than pending. */
const CONTINUOUS_APPLY_TIMEOUT_MS = 10000;

/**
 * The least time between two corrections.
 *
 * Separate from the settle above, which is about the analyser being lied to for
 * a moment while Equalizer APO reloads. This one is about the person in the
 * room. Checkpoints arrive about once a second, and a mode that is allowed to
 * act on every one of them is a mode that can rewrite the config a dozen times
 * a minute and announce each — which is exhausting to sit next to even when
 * every individual correction is right.
 *
 * Twenty seconds, with a deadband large enough that most checkpoints have
 * nothing to say anyway. Together they turn the mode from something fidgeting
 * constantly into something that speaks up when it has a reason to.
 */
const CONTINUOUS_QUIET_MS = 20000;

/**
 * The shortest that window gets, when what is waiting is worth hearing about.
 *
 * Twenty seconds for everything was the same wait for a correction of eight
 * tenths of a decibel and one of four, and that has no defence: the window
 * exists so nobody has to notice this mode a dozen times a minute, and a
 * correction big enough to hear is not the kind anybody minds noticing.
 *
 * So the wait scales with what is at stake. At the deadband it is the full
 * twenty seconds, because a correction that only just clears the bar is exactly
 * the sort that should wait its turn. At three decibels out it is four, because
 * by then the sound is audibly wrong and making somebody sit through most of a
 * minute of it to spare them a config write is the wrong trade.
 *
 * The window is global rather than per range, and that is not a limitation to
 * be worked around: a write rewrites the whole config and Equalizer APO reloads
 * the lot. Nine independent windows would be nine reloads, which is the thing
 * being rationed. What is NOT waited on is the other ranges being ready -- only
 * the ranges with something to say are written, and the rest are not held back
 * by them.
 */
const CONTINUOUS_QUIET_MIN_MS = 4000;

/** Disagreement at which the wait is as short as it gets, in dB. */
const CONTINUOUS_URGENT_DB = 3;

/**
 * How long to wait before the next write, given the largest thing pending.
 *
 * Linear between the deadband and `CONTINUOUS_URGENT_DB`, so there is no step
 * at which the behaviour jumps -- a correction that grows while it waits gets
 * its turn sooner rather than crossing a threshold and lurching.
 */
const quietWindowFor = (largestDb: number) => {
  const span = CONTINUOUS_URGENT_DB - CONTINUOUS_SETTLE_DB;
  const over = Math.max(0, Math.min(span, largestDb - CONTINUOUS_SETTLE_DB));
  const t = span > 0 ? over / span : 1;
  return Math.round(
    CONTINUOUS_QUIET_MS - (CONTINUOUS_QUIET_MS - CONTINUOUS_QUIET_MIN_MS) * t,
  );
};

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
 * Every Smart EQ measurement there is, hosted where no tab can end one.
 *
 * Renders nothing. It is mounted once, above the workspace tabs, and the EQ
 * page talks to it through `utils/smartEqRun` — which is the whole point:
 * both measurements used to live inside the EQ page's component, so switching
 * to the Voicing tab unmounted them mid-capture. A continuous mode meant to run
 * all evening stopped because somebody looked at something else, and came back
 * having forgotten every region it had heard.
 *
 * Both halves live here together on purpose. They share one analyser session,
 * and only one of them may hold it: the loop stands down while a one-shot runs
 * (`isRunning` is in its dependencies) and the button tears the loop down
 * itself before asking for the analyser (see `continuousAbortRef`). Keeping
 * them in one component is what makes that ordering expressible at all.
 */
const SmartEqEngine = () => {
  const {
    filters,
    convolution,
    voicing,
    driver,
    smartEq,
    headphone,
    setSmartEq,
    getBandSetGeneration,
    bypassed,
    headsetSignature,
  } = useFluidEqContext();
  const { captureBalanceProfile, isActive: isLiveOutputActive } =
    useLiveAudioControl();
  /**
   * The language, on a ref, and the ref is the point.
   *
   * Everything that writes a status here does it from inside a capture that
   * runs for tens of seconds or, in a continuous mode, all evening — so reading
   * `t` from the closure would freeze the readout in whatever language was
   * selected when the capture started. Worse, putting it in the effect's
   * dependencies would tear the capture down and start it again on a language
   * change, taking every region's accumulated evidence with it. A ref is the
   * only version that is both current and free.
   *
   * A sentence already on screen stays in the old language until the next one
   * is written, which for a running measurement is about a second.
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
   * What the capture is still waiting to hear, for the bubble's resting state.
   *
   * Published separately from the status, which is a remark with a timer on it:
   * this one is a condition, true for as long as it is true, and it must not be
   * cleared by a timeout that exists to stop a sentence going stale.
   *
   * Written only when the answer CHANGES, which is a handful of times per
   * capture rather than once a second. That distinction still matters even now
   * that it is published from outside the view — the EQ page lays out every
   * band in the editor, and it subscribes to this, so a publish per checkpoint
   * would re-render the lot at the analyser's cadence.
   */
  const listeningForRef = useRef('');
  /** A correction is on its way to Equalizer APO right now. */
  const isApplyingRef = useRef(false);
  /** When it set off, so a write that never returns cannot wedge the mode. */
  const applyStartedAtRef = useRef(0);
  /** When the chain can be believed again, after the last one landed. */
  const applySettledAtRef = useRef(0);
  /** Regions to clear once it has: what they heard mid-change is not evidence. */
  const pendingResetRef = useRef<number[]>([]);
  /** The floor between two corrections — see CONTINUOUS_QUIET_MS. */
  const quietUntilRef = useRef(0);
  /**
   * Where the correction is heading, averaged over every window so far.
   *
   * The one thing in this loop that deliberately outlives a region being
   * cleared. See `blendSmartEqTarget` for why an average of destinations is
   * meaningful across corrections where an average of measurements is not.
   */
  const longRunTargetRef = useRef<Record<string, number>>({});
  /** How many windows running each band has disagreed with that estimate. */
  const longRunDriftRef = useRef<TSmartEqDrift>({});
  /**
   * Which bands are part-way through a correction, so they can be held to a
   * finishing tolerance rather than a starting one.
   *
   * See `CONTINUOUS_SETTLE_DB`. Without it a band stops the moment it is inside
   * the trigger and stays there — the correction reaches a level and never
   * completes, which is what it looked like from the outside.
   */
  const movingBandsRef = useRef<Set<string>>(new Set());
  /**
   * Which reference the loop is holding records to, read from a ref.
   *
   * The capture runs for as long as the mode is on and the callback inside it
   * is held on a ref for the same reason, so reading the mode through state
   * would give it whatever was current when the capture started.
   */
  const referenceModeRef = useRef(smartEqMode);
  referenceModeRef.current = smartEqMode;

  /*
   * ARRIVING AT A CONTINUOUS MODE USED TO THROW THE CORRECTION AWAY, AND MUST
   * NOT.
   *
   * The argument for clearing was about the closed loop, and it was not silly.
   * The layer already applied was built to satisfy the OLD reference and the
   * measurement includes it, so the new mode can listen to a record already
   * bent toward somebody else's idea of right and find little left to disagree
   * with. Switching from Target to Detail could keep the target curve.
   *
   * What that argument left out is what clearing sounds like. A correction that
   * is mostly cuts — which most of them are, since a record is more often too
   * much of something than too little — disappears all at once, and the output
   * jumps up by however much it was holding down. Not a fade: one config write.
   * On headphones that is unpleasant. On a PA in front of people it is the kind
   * of thing that damages equipment and ears, and it fires on an ordinary menu
   * click, which is the worst possible trigger for it.
   *
   * So the new mode starts from the curve the old one left and works from
   * there. Every continuous mode is a closed loop over the output: whatever it
   * inherits is measured, compared against its own reference, and moved toward
   * it a step at a time. Inheriting a curve costs convergence time. Clearing
   * costs a level jump nobody asked for, and only one of those is recoverable.
   *
   * The inheritance the old comment worried about is real but narrower than it
   * says, and it is fixed in the right place instead: only the modes that FIT
   * the tilt rather than holding one can mistake our own correction for the
   * record's tonality, because a fitted line absorbs whatever tilt it is shown.
   * Balance and Target hold a slope and converge on it from anywhere.
   */
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
    // A continuous mode needs no setting up. It keeps whatever curve is already
    // applied and steers it toward its own reference on the next checkpoint,
    // which is the only transition that cannot make the output jump.
  }, [smartEqMode]);

  /*
   * A VOICING CHANGE USED TO RESTART THE CORRECTION, AND NO LONGER DOES.
   *
   * There was an effect here that cleared the Smart EQ layer whenever the
   * voicing changed, announced it, and let the loop rebuild over the following
   * minute. It was right at the time: the voicing was part of what the
   * correction aimed at, so a new one made the old answer stale.
   *
   * Neither half of that is true now. The voicing is subtracted from the
   * capture, so it is not in what the correction measures, and the destination
   * is the mode's own curve, so it is not in what the correction aims at. A
   * voicing change leaves the Smart EQ layer exactly as valid as it was a second
   * earlier — and throwing it away meant a minute of rebuilding, audibly, every
   * time somebody tried a different flavour.
   */
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
   * The running Continuous EQ capture, so the manual button can end it.
   *
   * There is only one analyser session, and starting a second is refused. The
   * effect below would tear this one down on its own — `isRunning` is in its
   * dependencies — but that happens on React's schedule, and `autoBalance`
   * reaches for the analyser in the same tick it sets the flag. Whether the
   * teardown wins the race depends on whether there is a layer to clear first,
   * because that is what puts an `await` in front of the capture. So it is done
   * here explicitly instead: pressing Smart EQ stops the loop before it asks
   * for anything.
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

  // The chain as it is right now, not as it was when this render's closures
  // were made. A measurement runs for tens of seconds, and everything captured
  // in that closure is frozen at the moment it started — which is how the guard
  // meant to notice the layout changing mid-capture ended up comparing the
  // measured set against itself and never firing, and how the voicing used to
  // be read for the target curve long after the user had switched it.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const voicingRef = useRef(voicing);
  voicingRef.current = voicing;
  const driverRef = useRef(driver);
  driverRef.current = driver;
  /*
   * The published headphone correction, excused like the driver.
   *
   * It corrects a transducer and a digital loopback cannot hear one, so it will
   * always look like error to this measurement and cancelling it is always
   * wrong. On a ref for the same reason every other layer here is: the capture
   * runs for minutes and the closure would freeze whatever was applied when it
   * started.
   */
  const headphoneRef = useRef(headphone);
  headphoneRef.current = headphone;
  // The bands as the AutoEQ panel wrote them, which is how the target curve
  // keeps a headphone correction while still correcting what the user has done
  // to the same bands since.
  const headsetSignatureRef = useRef(headsetSignature);
  headsetSignatureRef.current = headsetSignature;
  const convolutionRef = useRef(convolution);
  convolutionRef.current = convolution;
  const smartEqRef = useRef(smartEq);
  smartEqRef.current = smartEq;
  const bypassedRef = useRef(bypassed);
  bypassedRef.current = bypassed;

  /**
   * Everything audible, as one comparable string.
   *
   * The accumulator averages frames from whatever chain was live, so any change
   * to that chain part-way through contaminates the result — not only the band
   * count the old guard watched, but a gain nudge, a voicing switch, a driver
   * change or a convolution appearing. All of it is read from refs, because the
   * question is what is live now, not what was live when the run started.
   *
   * The Smart EQ layer is not in here, but it is guarded — separately, against
   * what the run itself believes it wrote, rather than against a snapshot of
   * the ref. ActiveLayers' clear button and every refreshState write it too, so
   * it cannot be assumed to move only when the run moves it; and a snapshot
   * would report the run's own optimistic clear as an outside change, because
   * React owes us nothing about when the next render lands.
   */
  const describeLiveChain = () =>
    JSON.stringify([
      Object.values(filtersRef.current)
        .sort(sortHelper)
        .map(
          (filter) =>
            `${filter.type}@${filter.frequency}/${filter.gain}/${filter.quality}`,
        ),
      voicingRef.current?.profileId ?? '',
      voicingRef.current?.intensity ?? 0,
      driverRef.current?.profileId ?? '',
      driverRef.current?.intensity ?? 0,
      convolutionRef.current?.fileName ?? convolutionRef.current?.name ?? '',
    ]);

  /**
   * Listen to what is actually coming out of the speakers, then flatten the
   * peaks and dips it finds while leaving the music's own spectral tilt alone.
   *
   * The answer lands in the Smart EQ layer, never in the bands on screen. What
   * the measurement finds is the residual of the whole chain — the bands, the
   * voicing, the driver compensation and the last Smart EQ correction, all
   * heard together — so it belongs to none of them individually and writing it
   * into the bands meant a measurement quietly rewrote a tuning someone had
   * built by hand.
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

    // The analyser takes one session at a time, and Continuous EQ holds one for
    // as long as it is switched on. See `continuousAbortRef` for why waiting
    // for the effect to do this would be a race rather than an ordering.
    continuousAbortRef.current?.abort();

    balanceRunRef.current += 1;
    const runId = balanceRunRef.current;
    const isCurrentRun = () => balanceRunRef.current === runId;
    const controller = new AbortController();
    balanceAbortRef.current = controller;

    setSmartEqRunning(true);

    try {
      let attempt = 0;

      // Runs once normally. It goes round again only when the audible chain
      // changed while it was listening.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        attempt += 1;

        // The layer this attempt is measuring against, read fresh every time
        // round. Carrying it *across* attempts was how one profile's accumulated
        // correction ended up written into whichever profile the user had
        // switched to, since the commonest reason to go round again is that they
        // loaded another one.
        const layer = smartEqRef.current;

        // NOT from flat, which it used to be, and the reversal is worth the
        // paragraph.
        //
        // The old rule cleared this layer before listening, on the argument that
        // measuring an already-corrected output has a blind spot: a region cut
        // hard has little energy left in it, so the measurement marks it
        // untrustworthy and never touches it again — the correction hiding the
        // problem it is causing. Clearing first was the way out of that.
        //
        // It is the wrong trade because of what it does to the ordinary case.
        // Pressing this is asking "fix what I am hearing"; clearing the layer
        // changes what is being heard before anything is measured, so the run
        // answers a question about a chain the user was not listening to and
        // rebuilds a correction they already had. It also threw away the one
        // thing that makes repeated runs converge.
        //
        // What is measured now is the output as it stands, all of it, and what
        // is solved is the residual against the mode's own destination. The
        // blind spot is real and stays: a range cut so hard nothing is left to
        // measure will not be found. Clear EQ is the way out of that, and it is
        // one press away and says exactly what it does — which is a better place
        // for a destructive act than the inside of a button labelled "listen".

        // The layer's own bands, so the solve accumulates onto what it wrote
        // last time instead of onto whatever the user's editor happens to hold.
        const bands = getSmartEqBands(layer);
        const chainBeforeCapture = describeLiveChain();
        // What this run believes the layer to be. Comparing the live layer
        // against this after the capture is what tells somebody else's write —
        // the chip's clear button, a profile load — from the run's own.
        const layerBeforeCapture = describeSmartEqLayer(layer);

        setSmartEqStatus(
          tRef.current('eq.smart.status.listeningPercent', { percent: 0 }),
        );
        const result = await captureBalanceProfile({
          signal: controller.signal,
          getChainGainDb: (axis) => chainGainDbRef.current(axis),
          onProgress: (progress) => {
            if (isCurrentRun()) {
              setSmartEqStatus(describeBalanceProgress(progress, tRef.current));
            }
          },
        });

        if (!isCurrentRun()) {
          return;
        }

        // Changing anything audible mid-capture invalidates the average: the
        // frames it is built from describe two different chains. Rather than
        // throwing away the half-minute the user just spent listening, measure
        // again against what they now have — reaching for a slider part-way
        // through is a perfectly reasonable thing to do, and being told off for
        // it is not.
        //
        // The layer counts as part of that chain. Clearing it from the chip
        // while a run listens used to be silently undone, because the run went
        // on to write `the gains it started from + this residual` back over the
        // top of the clear.
        if (
          describeLiveChain() !== chainBeforeCapture ||
          describeSmartEqLayer(smartEqRef.current) !== layerBeforeCapture
        ) {
          if (attempt >= MAX_BALANCE_ATTEMPTS) {
            setSmartEqStatus(tRef.current('eq.smart.status.keptChanging'));
            return;
          }
          setSmartEqStatus(tRef.current('eq.smart.status.soundChanged'));
          // eslint-disable-next-line no-continue
          continue;
        }

        // Steer toward the destination the chosen mode names, rather than
        // merely flattening — the same reference the continuous modes use, so
        // Target means the same thing whichever way it is reached.
        //
        // What the measurement is allowed to leave alone.
        //
        // The capture accumulates the output, so everything applied is in it.
        // Driving all of that to the reference would cancel the layers somebody
        // deliberately chose — pick a voicing and Smart EQ would quietly undo
        // it, which is the least useful thing it could possibly do.
        //
        // TWO LAYERS ARE EXCUSED, AND ONLY TWO: the voicing and the driver.
        //
        // A voicing is a colouration somebody asked for by name. A driver
        // correction compensates the transducer, which is the one thing a
        // digital loopback categorically cannot hear — so it will always look
        // like error to this measurement and cancelling it is always wrong.
        //
        // Everything else is what the correction listens for: the bands, a
        // headset curve applied into them, and the convolution. All three are
        // part of what is coming out, and if what is coming out is wrong they
        // are corrected like anything else.
        //
        // The cost of putting the headset curve on that side belongs in
        // writing, because it is not obvious: it is also a correction for
        // something invisible to a loopback, so Smart EQ will flatten it over a
        // few passes. A headphone correction that must survive belongs in the
        // driver layer.
        const gains = buildBalancedGains(result.samples, bands, {
          reference: getReferenceShape(referenceModeRef.current),
          // A range nothing is playing in cannot be lifted, however loudly it
          // reports a deficit. See the presence lines on the plot.
          boostAllowance: allowanceFrom(result.regions),
          // Symmetric limits, whatever the listener chose. An asymmetric pair
          // biases a centred correction; see `correctionLimit`.
          maxBoost: getCorrectionLimit(),
          maxCut: getCorrectionLimit(),
          targetCurve: buildLayerTargetCurve(
            voicingRef.current,
            driverRef.current,
            undefined,
            headphoneRef.current,
            bypassedRef.current,
          ),
        });
        if (Object.keys(gains).length === 0) {
          setSmartEqStatus(tRef.current('eq.smart.status.notEnoughRange'));
          return;
        }

        const measured = buildSmartEqSettings(
          bands,
          confineSmartEqResponse(gains, bands, getCorrectionLimit()),
          {
            status: result.status,
            lowFrequency: result.lowFrequency,
            highFrequency: result.highFrequency,
          },
          getCorrectionLimit(),
        );

        // Compared on what will be written, not on object identity: a run that
        // moves every band by less than the rounding step has genuinely found
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
        // because a run after the first is a correction to a correction, and
        // what is worth watching is where it moved.
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

        // What was heard, and then what was done about it. The first half was
        // all this said for a long time, and it is the half the app cannot be
        // held to: it describes a measurement. The second half is the gains it
        // wrote, which are on disk and can be argued with.
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
        break;
      }
    } catch (e) {
      if (!isCurrentRun()) {
        return;
      }
      // A failed measurement is a normal outcome (nothing playing, cancelled,
      // capture unavailable); report it in place rather than as a global
      // failure that would blank the whole workspace.
      if (e instanceof DOMException && e.name === 'AbortError') {
        setSmartEqStatus(tRef.current('eq.smart.status.cancelled'));
      } else {
        // An Error's own message is passed through, and it is already
        // translated: everything the capture rejects with is looked up in
        // `useLiveOutputSpectrum` before it is thrown, precisely so this line
        // does not have to guess. What is left for the key below is the case
        // where something threw a non-Error, which no code here does and only a
        // browser can.
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
      }
    }
  };

  runAutoBalanceRef.current = () => {
    autoBalance().catch(() => {
      // Reported in the status line by the run itself.
    });
  };

  /**
   * Continuous EQ: measure, move a little, measure again, for as long as there
   * is music.
   *
   * The difference from pressing the button is entirely in the size of the
   * move. A solve says where every band belongs; this goes half a decibel of
   * the way there and solves again, so the correction arrives without ever
   * announcing itself — and so that what it converges on is the system rather
   * than the song. A correction that could keep up with the content would be a
   * dynamic EQ: it would flatten a bass drop at exactly the moment the drop is
   * meant to land. This one moves far slower than the music does, so one
   * track's emphasis and the next one's cancel, and only what every track
   * agrees about survives — which is the headphones and the room, which is the
   * thing worth correcting.
   *
   * It never clears first. The from-flat rule the button follows exists for a
   * real reason, written out where the button does it, but applying it here
   * would mean the correction going away for the length of every capture, over
   * and over. Pressing Smart EQ by hand is still the way to start again, and
   * doing so suspends this loop rather than racing it: `isRunning` is in the
   * dependencies, so the effect tears down and comes back when the manual run
   * finishes.
   *
   * ONE capture, not a series of them, and that is what makes the ranges
   * independent. Every restart would put all nine regions back to zero
   * together, so they would fill together, become ready together and be
   * corrected together — which is what a series of measurements looks like from
   * the outside and is exactly what this is not meant to be. Here each region
   * fills at its own rate, is corrected the moment it alone has been heard well
   * enough, and is cleared on its own so it can start again while its
   * neighbours carry on undisturbed.
   */
  const applyReadyRegions = (report: IBalanceReport): number[] => {
    // ONE correction at a time, and nothing measured while one is landing.
    //
    // Checkpoints arrive about once a second and a write takes an unknown
    // fraction of that: the IPC, the config rewrite, Equalizer APO noticing and
    // reloading. Two of them overlapping is not a rare race but the ordinary
    // case, and it goes wrong twice over — the second solve reads a layer React
    // has not re-rendered yet, so it starts from the pre-step gains and applies
    // the same step a second time, and the two writes reach APO in whichever
    // order they finish in.
    //
    // The window stays shut for a moment after the write lands as well. What
    // the analyser hears while APO reloads is neither the old chain nor the new
    // one, and averaging it in is how a correction gets measured against half
    // of itself.
    //
    // The in-flight flag carries a deadline, because it is cleared by a promise
    // and a promise that never settles would switch this mode off for the rest
    // of the session with nothing on screen saying so. Ten seconds is far
    // longer than a config write has ever taken; a write still outstanding then
    // is not coming back, and carrying on is a better answer than stopping
    // forever.
    const isWriteInFlight =
      isApplyingRef.current &&
      Date.now() - applyStartedAtRef.current < CONTINUOUS_APPLY_TIMEOUT_MS;
    if (isWriteInFlight || Date.now() < applySettledAtRef.current) {
      return [];
    }

    // The transitional frames, thrown away now that the settle is over. The
    // regions were cleared at the moment of the write so they could not be
    // corrected twice; this second clear is about what they heard *since*, back
    // when the chain was mid-change.
    if (pendingResetRef.current.length > 0) {
      const stale = pendingResetRef.current;
      pendingResetRef.current = [];
      return stale;
    }

    // Not yet, whatever the measurement says. Checked after the stale clear
    // above rather than before it, because throwing away contaminated frames is
    // housekeeping the quiet window has no business delaying — it is about how
    // often the correction may CHANGE, not about how often the loop may think.
    if (Date.now() < quietUntilRef.current) {
      return [];
    }

    // Read fresh each time rather than carried: over an evening the user will
    // have moved a band, loaded a profile, cleared the layer. Every one of
    // those makes the gains a held copy started from wrong.
    const layer = smartEqRef.current;
    const bands = getSmartEqBands(layer);
    const ready = report.regions
      .map((region, index) => ({ region, index }))
      .filter(({ region }) => region.isCovered);
    if (ready.length === 0) {
      return [];
    }

    // The whole curve, for all three, which is what Smart EQ has always used.
    //
    // The nine range levels were here first and the argument for them was
    // sound: each is a weighted mean over every frame that had energy in that
    // range, where a point of the smoothed curve is one FFT bin averaged with
    // its neighbours. Sturdier, and deliberately blind to anything narrower
    // than an octave.
    //
    // Too blind, as it turns out. A resonance sits *inside* a range, so a range
    // average smears it into that range's own level and there is nothing left
    // to correct — and the difference is audible: the one-shot measurement,
    // which never used ranges, is the one people actually like the sound of.
    //
    // The continuous modes can afford the finer input where the one-shot
    // cannot, because everything that protects them sits downstream of this: a
    // band must be a decibel out before it moves at all, it moves half a
    // decibel at a time, the destination is averaged over many windows, and the
    // total is capped. None of that is true of a single measurement applied
    // whole.
    const solved = buildBalancedGains(report.samples, bands, {
      // A range nothing is playing in cannot be lifted, however loudly it
      // reports a deficit. See the presence lines on the plot.
      boostAllowance: allowanceFrom(report.regions),
      // Symmetric limits, whatever the listener chose. An asymmetric pair
      // biases a centred correction; see `correctionLimit`.
      maxBoost: getCorrectionLimit(),
      maxCut: getCorrectionLimit(),
      // The mode's curve, whatever else is switched on. Which mode is chosen
      // decides the destination and nothing else does — see
      // `getReferenceShape`.
      reference: getReferenceShape(referenceModeRef.current),
      // The same two exceptions the one-shot makes, for the same reasons: the
      // voicing is a named choice and the driver corrects the one thing this
      // measurement cannot hear. Everything else in the output is fair game.
      targetCurve: buildLayerTargetCurve(
        voicingRef.current,
        driverRef.current,
        undefined,
        headphoneRef.current,
        bypassedRef.current,
      ),
    });
    if (Object.keys(solved).length === 0) {
      // No answer this time. The tilt fit needs a wide trusted span and a range
      // that was cleared a moment ago carries none, so a solve taken while the
      // midrange is refilling declines rather than fitting a slope through a
      // hole. A cycle skipped, not a wrong correction.
      return [];
    }

    // Only the ranges that have been heard. A band outside them has no entry
    // here at all, and `stepSmartEqGains` leaves a band it is told nothing
    // about exactly where it is.
    const scoped: Record<string, number> = {};
    bands.forEach((band) => {
      const isReady = ready.some(
        ({ region }) =>
          band.frequency >= region.lowFrequency &&
          band.frequency <= region.highFrequency,
      );
      if (isReady && Number.isFinite(solved[band.id])) {
        scoped[band.id] = solved[band.id];
      }
    });

    /*
     * How far each range is from where it is being steered, for the plot.
     *
     * The coverage bar answers "how much of this range have I heard", which is
     * only half of why a correction has not landed — and alone it is the
     * misleading half, because a range can be completely heard and still sit
     * there having nothing to say. Published beside it so both halves are
     * visible: the largest gap in the range between a band and where this solve
     * wanted it.
     *
     * Taken from `scoped` rather than `solved`, so it describes what would
     * actually be written. A range still gathering evidence contributes no
     * entry at all, which is the truthful answer rather than a zero.
     */
    const gapsByRange = Object.fromEntries(
      report.regions.map((region) => {
        const gaps = bands
          .filter(
            (band) =>
              band.frequency >= region.lowFrequency &&
              band.frequency <= region.highFrequency &&
              scoped[band.id] !== undefined,
          )
          .map((band) => Math.abs(scoped[band.id] - band.gain));
        return [region.label, gaps.length > 0 ? Math.max(...gaps) : 0];
      }),
    );
    setSmartEqDisagreement(gapsByRange);
    // The biggest thing waiting to be written, which is what sizes the wait
    // before the next write. See `quietWindowFor`.
    const largestPendingDb = Math.max(
      0,
      ...(Object.values(gapsByRange) as number[]),
    );

    // Toward where every window so far agrees the band belongs, not toward
    // what this one said.
    //
    // Clearing a range after correcting it is necessary — its old average
    // describes a chain that no longer exists — but it also threw away the
    // long-run memory, so every decision rested on the music of the last minute
    // or two. That is enough for a bass-heavy album and a thin one to be
    // measured separately, agreed to separately, and corrected in opposite
    // directions one after the other, forever. The destinations are absolute
    // gains and so are comparable across corrections, which is what makes an
    // average of them meaningful where an average of raw measurements would
    // not be.
    // Two rates. Small disagreements are averaged away so it settles and stops;
    // a large one that survives three windows running is a different situation
    // rather than a different track, and is taken whole.
    const blended = blendSmartEqTarget(longRunTargetRef.current, scoped, {
      drift: longRunDriftRef.current,
    });
    const { target, drift } = blended;
    longRunTargetRef.current = target;
    longRunDriftRef.current = drift;
    const steppedRaw = stepSmartEqGains(bands, longRunTargetRef.current, {
      moving: movingBandsRef.current,
      // Symmetric, and whatever the listener chose. See `correctionLimit`.
      maxBoost: getCorrectionLimit(),
      maxCut: getCorrectionLimit(),
    });
    // The limit line bounds the CURVE, and bells sum: two lawful bands can
    // stack past it, and a layer inherited from a wider limit starts outside
    // it. Out of bounds is scaled home in one move rather than stepped -- see
    // confineSmartEqResponse.
    const stepped = confineSmartEqResponse(
      steppedRaw,
      bands,
      getCorrectionLimit(),
    );
    // Which bands are still travelling, for the next pass. Derived rather than
    // tracked: a band moved exactly when its gain changed, so this cannot drift
    // out of step with what was actually written.
    movingBandsRef.current = new Set(
      bands
        .filter((band) => stepped[band.id] !== band.gain)
        .map((band) => band.id),
    );
    const measured = buildSmartEqSettings(
      bands,
      stepped,
      { status: report.status === 'ready' ? 'ready' : 'partial' },
      getCorrectionLimit(),
    );
    if (describeSmartEqLayer(measured) === describeSmartEqLayer(layer)) {
      // Every ready range was inside its threshold, so nothing was written and
      // nothing has gone stale — those ranges keep accumulating, which only
      // sharpens them. A band that had been travelling and has now arrived drops
      // out of the moving set above, so it goes back to needing a full
      // `CONTINUOUS_TRIGGER_DB` before it will start again.
      return [];
    }

    // Exactly the ranges that moved, and only those. A range whose bands all
    // sat inside the deadband is not stale — the chain under it did not change
    // — and clearing it would throw away good evidence for nothing.
    const moved = ready.filter(({ region }) =>
      bands.some(
        (band) =>
          band.frequency >= region.lowFrequency &&
          band.frequency <= region.highFrequency &&
          stepped[band.id] !== band.gain,
      ),
    );

    // Shut before the write, not after it. `setSmartEqApi` returns a promise
    // and the checkpoint that could collide with it is a whole second away, but
    // the flag has to be set on this side of the call all the same: setting it
    // in the promise body would leave a gap between deciding to write and being
    // marked as writing, which is precisely the gap a race lives in.
    isApplyingRef.current = true;
    applyStartedAtRef.current = Date.now();
    setSmartEq(measured);
    setSmartEqApi(measured)
      .catch(() => {
        // Reported nowhere on purpose: a write that fails from a loop nobody
        // started should not raise the banner over the whole workspace. The
        // next pass writes again.
      })
      .finally(() => {
        isApplyingRef.current = false;
        applySettledAtRef.current = Date.now() + CONTINUOUS_SETTLE_MS;
        // The two windows do different jobs and both start now: the short one
        // is the analyser being lied to while APO reloads, the long one is how
        // often anybody should have to notice this mode at all.
        // Sized by what was actually pending, so a big correction is not made
        // to wait as long as a marginal one. See `quietWindowFor`.
        quietUntilRef.current = Date.now() + quietWindowFor(largestPendingDb);
        // Published so the plot can say how long is left. One number, because
        // one config write serves every range at once.
        setSmartEqQuietUntil(quietUntilRef.current);
        pendingResetRef.current = moved.map(({ index }) => index);
        // Marked here and nowhere earlier: this is the moment the chain on disk
        // actually changed, so it is the moment the sound did. Announcing it at
        // the decision instead would light the graph up over a write that had
        // not happened yet and might still fail.
        flashCorrection(moved.map(({ region }) => region));
      });

    // What just moved, not what the correction adds up to.
    //
    // It reported the accumulated shape for a while, and the shape is often
    // quiet even when the mode plainly is not: a range's bands can each shift
    // by a decibel or two in a write while the range's own average stays inside
    // the threshold worth naming. The curve on the graph visibly moved and the
    // bubble said nothing, which is the app looking broken while working
    // correctly.
    //
    // Phrased as a need — "Needs more deep bass" — so it is the same voice the
    // measurement underneath it speaks in, and it sits over a bubble that has
    // just turned green, which is what says the need was met rather than merely
    // noticed.
    setSmartEqStatus(
      describeCorrectionNeed(
        bands,
        stepped,
        tRef.current,
        moved.map(({ region }) => region),
      ),
    );
    return moved.map(({ index }) => index);
  };

  // Held on a ref so the capture is not torn down and restarted on every
  // render. Restarting is the one thing this must not do casually: it would
  // take every region's accumulated evidence with it.
  const applyReadyRegionsRef = useRef(applyReadyRegions);
  applyReadyRegionsRef.current = applyReadyRegions;

  /**
   * What the chain is doing at each analysis frequency, so the capture measures
   * the record rather than the output — see `buildChainGainDb`.
   *
   * EVERY LAYER EXCEPT SMART EQ'S OWN, and that exception is the whole of the
   * design rather than a special case in it.
   *
   * Everything else comes out because none of it is the record: a voicing, a
   * headphone correction and a slider somebody dragged are all things done to
   * the sound afterwards, and leaving them in is what made the measurement blind
   * to a range that had been cut — the cut removed the evidence against itself,
   * so the correction waited forever on a range it had already destroyed.
   *
   * Smart EQ's own layer stays in, because taking it out would open the loop.
   * A correction that cannot hear its own result cannot verify it: every error
   * in the filter model, in this subtraction, in the analyser's own response
   * would land in the output and stay there, uncontested, because nothing
   * downstream ever measures the consequence. Leaving it in makes what arrives a
   * residual — how far the sound still is from where it should be, given
   * everything already done about it — so a second look corrects the first
   * instead of repeating it.
   *
   * So the record is measured as it was written, through the one layer whose job
   * is to fix it, and the user's own chain sits on top untouched.
   *
   * Bypassed layers are left out for a different reason: their `Include:` is not
   * in the config, so nothing of theirs is in what the analyser hears and there
   * is nothing to remove.
   */
  const chainGainDb = (axis: number[]) =>
    buildChainGainDb(
      [
        ...(bypassedRef.current.includes('eq')
          ? []
          : Object.values(filtersRef.current)),
        ...(bypassedRef.current.includes('driver')
          ? []
          : getDriverFilters(driverRef.current)),
        // Named in the paragraph above since that paragraph was written, and
        // not actually taken out until now. The layer was in the target curve —
        // "do not undo this" — but not in the subtraction, so the reconstructed
        // record still carried it: the gate then judged how much programme was
        // in a range using levels the correction had already lifted or dropped
        // by several decibels, and trusted or skipped ranges on that basis. The
        // driver is in both lists for exactly the same reason; this was the one
        // layer in one list and not the other.
        ...(bypassedRef.current.includes('headphone')
          ? []
          : getHeadphoneFilters(headphoneRef.current)),
        ...(bypassedRef.current.includes('voicing')
          ? []
          : getVoicingFilters(voicingRef.current)),
      ],
      axis,
    );
  const chainGainDbRef = useRef(chainGainDb);
  chainGainDbRef.current = chainGainDb;

  useEffect(() => {
    // Switching the Smart EQ layer off stops it. Its `Include:` is not in the
    // config while it is bypassed, so every correction this loop worked out
    // would be measured against a chain that does not contain the last one —
    // it would hear its own correction missing, decide the room had changed,
    // and walk the layer somewhere arbitrary for as long as the switch was off.
    // The chip is the switch, and it is one press away.
    if (
      !isContinuousOn ||
      !isLiveOutputActive ||
      isRunning ||
      isSmartBypassed
    ) {
      return undefined;
    }

    const controller = new AbortController();
    continuousAbortRef.current = controller;
    // Nothing carried over from the last time the mode ran: a settle window
    // that outlived its write, or a list of regions to clear in a capture that
    // no longer exists, would both be applied to the wrong session.
    isApplyingRef.current = false;
    applySettledAtRef.current = 0;
    quietUntilRef.current = 0;
    pendingResetRef.current = [];
    // A fresh session has heard nothing yet, and saying otherwise would leave
    // the bubble asserting a condition from the last one.
    listeningForRef.current = tRef.current('eq.smart.status.listening');
    setSmartEqListening(listeningForRef.current);
    // A fresh session starts with no opinion. The last one may have been
    // measuring a different output, a different headphone, or a chain the
    // manual button has since rebuilt from flat.
    longRunTargetRef.current = {};
    longRunDriftRef.current = {};
    movingBandsRef.current = new Set();

    captureBalanceProfile({
      signal: controller.signal,
      isContinuous: true,
      getChainGainDb: (axis) => chainGainDbRef.current(axis),
      // The same shape of sentence the button's own measurement writes, in the
      // plural, because this measurement is in the plural — see
      // `describeContinuousProgress`. It was cut back to a bare "Listening" for
      // a while on the theory that a running commentary buried the sentence that
      // mattered; it did the opposite, because with the percentage gone nothing
      // on screen moved and a mode working quietly looked like one that had
      // hung.
      //
      // Written only when the wording changes. That is a re-render of the whole
      // editor about once a second while music is playing, which is what the
      // one-shot measurement has always cost — the difference is that this one
      // does not stop, so the guard is worth having even though the percentage
      // usually changes anyway.
      onProgress: (progress) => {
        const next = describeContinuousProgress(progress, tRef.current);
        if (next !== listeningForRef.current) {
          listeningForRef.current = next;
          setSmartEqListening(next);
        }
      },
      onReport: (report) => applyReadyRegionsRef.current(report),
    }).catch(() => {
      // Aborting is how this ends, and an abort rejects. Nothing here is a
      // failure worth reporting.
    });
    return () => {
      controller.abort();
      if (continuousAbortRef.current === controller) {
        continuousAbortRef.current = undefined;
      }
    };
    // The mode restarts the capture, which is the point of it being here rather
    // than only on the ref the callback reads. Everything a region has heard was
    // heard through the correction the old mode had applied, and that correction
    // has just been cleared — so the evidence describes a chain that no longer
    // exists, exactly as it does after a single region is corrected. Starting
    // over is the same answer at a larger scale, and it takes the long-run
    // destinations with it.
  }, [
    captureBalanceProfile,
    isRunning,
    isContinuousOn,
    isLiveOutputActive,
    isSmartBypassed,
    smartEqMode,
  ]);

  return null;
};

export default SmartEqEngine;
