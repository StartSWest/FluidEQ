/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import { IMasterSettings } from '../../common/dsp/chain';
import { useTranslation } from '../utils/I18nContext';
import {
  IMasterLoudnessPlot,
  LOUDNESS_HISTORY,
  LOUDNESS_SAMPLE_MS,
  paintMasterLoudness,
} from './masterLoudnessPlot';
import { readDspLoudness, readDspPeak, useDspOutputSafetyMeter } from './store';
import { IGraphLoopFrame, startGraphLoop } from './graphLoop';
import { BASE_CURVE_CSS } from './dspInks';

/** Below this, the slow DC estimate is beneath a useful reporting floor. */
const DC_REPORT_THRESHOLD_DB = -60;
/**
 * How long a status chip keeps reporting an event after the last frame that
 * showed it — long enough to be read, since a limiter catching one transient
 * is over within a few milliseconds.
 */
const PEAK_EVENT_HOLD_MS = 2_500;
const DC_EVENT_HOLD_MS = 2_500;
/** The floor every reading in this display treats as "nothing measured yet". */
const SILENCE_LUFS = -120;

interface IPeakEvent {
  kind: 'fixed' | 'warning';
  amount: number;
}

const amplitudeDb = (value: number): number =>
  value > 1e-6 ? 20 * Math.log10(value) : -120;

const displayDbfs = (value: number): string =>
  value <= -119.5 ? '≤−120 dBFS' : `${value.toFixed(1)} dBFS`;

/** A loudness that has not been measured yet is absent, not quiet. */
const displayLufs = (value: number): string =>
  value <= -70 ? '—' : `${value.toFixed(1)}`;

/**
 * The makeup carries its own sign, because this stage attenuates more often
 * than it boosts.
 *
 * The plus used to be written into the sentence in all ten locales, from back
 * when the makeup was capped at the track's remaining peak room and could only
 * ever be zero or positive. It is a LUFS target now: against the -14 default,
 * every commercially mastered record asks for attenuation, and the line read
 * "+-10.2 dB toward -14.0 LUFS" on the most ordinary case there is.
 */
const signedDb = (value: number): string =>
  `${value > 0 ? '+' : ''}${value.toFixed(1)}`;

interface IDspMasterGraphProps {
  master: IMasterSettings;
  safetyEnabled: boolean;
  loudnessGainDb: number;
}

/**
 * What the Master stage is doing to the loudness of the record.
 *
 * The card offers a loudness target. Until this display existed there was
 * nothing anywhere in the app that measured loudness while the music played,
 * so the only LUFS on the page was the number the user had dialled — and the
 * makeup underneath it was applying exactly 0.0 dB to every commercially
 * mastered track, which nobody could see. A target with no meter beside it is
 * a setting that cannot be checked.
 */
const DspMasterGraph = ({
  master,
  safetyEnabled,
  loudnessGainDb,
}: IDspMasterGraphProps) => {
  const { t } = useTranslation();
  // Read here, where the status line that shows it lives. Handed down from the
  // card, every host frame re-rendered the card's five dials and three
  // switches along with it.
  const meter = useDspOutputSafetyMeter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  /** The running loop's way in, for a render that has to reach the canvas. */
  const redraw = useRef<(() => void) | undefined>(undefined);
  /**
   * When each chip's event was last seen, on the `performance.now()` clock.
   *
   * The chips hold their event for a while after it ends, and that hold is
   * measured, not scheduled: every host frame re-renders this component and
   * stamps the time if the event is still in it, and the frame loop below
   * releases a hold once that stamp is old enough. It was a `setTimeout`
   * restarted on each change, which this project does not allow — a callback
   * guessing when to look again, left to fire on a component that may have
   * moved on — and which restarted only when a reading CHANGED, so an event
   * holding one steady value was released while it was still happening.
   */
  const peakSeenAtRef = useRef(0);
  const dcSeenAtRef = useRef(0);
  /**
   * The history rings, owned outside React on purpose.
   *
   * A sample lands every hundred milliseconds and the strip repaints every
   * animation frame. Holding three hundred columns in state would be a
   * reconcile ten times a second for numbers that are painted onto a canvas
   * either way.
   */
  const momentaryRef = useRef(new Float32Array(LOUDNESS_HISTORY).fill(-120));
  const shortTermRef = useRef(new Float32Array(LOUDNESS_HISTORY).fill(-120));
  const reductionRef = useRef(new Float32Array(LOUDNESS_HISTORY));
  const headRef = useRef(0);
  const filledRef = useRef(0);
  const sampledAtRef = useRef(0);
  /** The deepest reduction seen between two samples, never the last one. */
  const pendingReductionRef = useRef(0);
  /**
   * The meter, read inside the frame loop rather than depended on.
   *
   * It is a fresh object about twenty-three times a second, so naming it in
   * the effect's dependencies would tear down and rebuild the animation loop
   * at that rate — cancelling a frame request and issuing another instead of
   * drawing.
   */
  const meterRef = useRef(meter);
  meterRef.current = meter;
  const [heldPeakEvent, setHeldPeakEvent] = useState<IPeakEvent | undefined>();
  const [heldDcCorrectionDb, setHeldDcCorrectionDb] = useState(-120);
  /**
   * The readouts, which DO go through React.
   *
   * Five numbers a fifth of a second apart, in the DOM rather than on the
   * canvas: a person reads an exact LUFS value off a label and watches a shape
   * on a plot, and a screen reader can only reach one of the two.
   */
  const [readout, setReadout] = useState({
    momentaryLufs: SILENCE_LUFS,
    shortTermLufs: SILENCE_LUFS,
    integratedLufs: SILENCE_LUFS,
    rangeLu: 0,
    truePeakDb: -120,
  });

  const maximizeActive = master.enabled && master.loudnessMaximize;
  const effectiveCeiling = maximizeActive ? master.ceilingDb : 0;
  const autoGainReductionDb = meter.postFilterNormalizer.gainReductionDb;
  const safetyGainReductionDb = safetyEnabled ? meter.gainReductionDb : 0;
  const observedPeakDb = Math.max(
    amplitudeDb(readDspPeak()),
    safetyEnabled ? meter.inputTruePeakDb : -120,
  );
  const overCeiling = observedPeakDb > effectiveCeiling + 0.05;
  const autoReducing = autoGainReductionDb < -0.05;
  const safetyReducing = safetyGainReductionDb < -0.05;
  const reducing = autoReducing || safetyReducing;
  const dcFixed = heldDcCorrectionDb > DC_REPORT_THRESHOLD_DB;
  const faults = meter.repairedSamples;
  let currentPeakEvent: IPeakEvent | undefined;
  if (autoReducing) {
    currentPeakEvent = {
      kind: 'fixed',
      amount: Math.abs(autoGainReductionDb),
    };
  } else if (overCeiling && !safetyReducing) {
    currentPeakEvent = { kind: 'warning', amount: observedPeakDb };
  }
  const dcActive = meter.dcCorrectionDb > DC_REPORT_THRESHOLD_DB;
  /**
   * What the frame loop needs to decide a release, read there rather than
   * closed over: the loop outlives many renders, and rebuilding it for every
   * change to these would cancel frames instead of drawing them.
   */
  const holdRef = useRef({
    peakActive: false,
    peakHeld: false,
    dcActive: false,
    dcHeld: false,
  });
  holdRef.current = {
    peakActive: currentPeakEvent !== undefined,
    peakHeld: heldPeakEvent !== undefined,
    dcActive,
    dcHeld: dcFixed,
  };

  useEffect(() => {
    if (!autoReducing && (!overCeiling || safetyReducing)) {
      return;
    }
    const nextPeakEvent: IPeakEvent = autoReducing
      ? { kind: 'fixed', amount: Math.abs(autoGainReductionDb) }
      : { kind: 'warning', amount: observedPeakDb };
    setHeldPeakEvent((previous) => {
      if (!previous || previous.kind !== nextPeakEvent.kind) {
        return nextPeakEvent;
      }
      if (nextPeakEvent.kind === 'warning') {
        return nextPeakEvent.amount > previous.amount
          ? nextPeakEvent
          : previous;
      }
      // Reduction may move in both directions, but half-decibel UI steps keep
      // the chip calm while the plot shows the exact continuous movement.
      return Math.abs(nextPeakEvent.amount - previous.amount) >= 0.5
        ? nextPeakEvent
        : previous;
    });
  }, [
    autoGainReductionDb,
    autoReducing,
    observedPeakDb,
    overCeiling,
    safetyReducing,
  ]);

  useEffect(() => {
    if (meter.dcCorrectionDb <= DC_REPORT_THRESHOLD_DB) {
      return;
    }
    setHeldDcCorrectionDb((previous) =>
      Math.max(previous, meter.dcCorrectionDb),
    );
  }, [meter.dcCorrectionDb]);

  const displayedPeakEvent = heldPeakEvent ?? currentPeakEvent;
  let peakStatusClass = 'is-safe';
  let peakStatus = t('dsp.master.graph.peakSafe');
  if (displayedPeakEvent?.kind === 'warning') {
    peakStatusClass = 'is-warning';
    peakStatus = t('dsp.master.graph.peakWarning', {
      peak: displayedPeakEvent.amount.toFixed(1),
    });
  } else if (displayedPeakEvent?.kind === 'fixed') {
    peakStatusClass = 'is-fixed';
    peakStatus = t('dsp.master.graph.peakFixed', {
      gain: displayedPeakEvent.amount.toFixed(1),
    });
  }
  let safetyStatusClass = safetyEnabled ? 'is-safe' : 'is-warning';
  let safetyStatus = safetyEnabled
    ? t('dsp.master.graph.safetyActive')
    : t('dsp.master.graph.safetyBypassed');
  if (safetyReducing) {
    safetyStatusClass = 'is-fixed';
    safetyStatus = `${t('dsp.master.graph.safetyActive')} · ${safetyGainReductionDb.toFixed(1)} dB`;
  }

  const targetLabel = t('dsp.master.graph.targetLine', {
    target: master.loudnessTargetLufs.toFixed(1),
  });
  const reductionLabel = t('dsp.master.graph.reductionShort');

  useEffect(() => {
    /**
     * Releases a chip whose event has not been seen for its hold.
     *
     * Checked on animation frames rather than on host frames, because an
     * engine that stops takes its host frames with it and the chip still has
     * to clear. While a hold is counting down this asks for the next frame
     * itself, the same as waiting on a canvas to be laid out, so the release
     * lands on time whether or not the engine is still publishing — and the
     * loop goes quiet again once nothing is held.
     */
    const releaseHolds = (schedule: () => void) => {
      const hold = holdRef.current;
      const now = performance.now();
      if (hold.peakHeld && !hold.peakActive) {
        if (now - peakSeenAtRef.current >= PEAK_EVENT_HOLD_MS) {
          setHeldPeakEvent(undefined);
        } else {
          schedule();
        }
      }
      if (hold.dcHeld && !hold.dcActive) {
        if (now - dcSeenAtRef.current >= DC_EVENT_HOLD_MS) {
          setHeldDcCorrectionDb(-120);
        } else {
          schedule();
        }
      }
    };

    const paint = ({ schedule }: IGraphLoopFrame) => {
      releaseHolds(schedule);
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) {
        // Waiting on the document rather than on the engine, so asked for
        // again whether or not anything is playing.
        schedule();
        return;
      }
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      const pixelWidth = Math.round(width * ratio);
      const pixelHeight = Math.round(height * ratio);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const live = readDspLoudness();
      const nowReduction =
        meterRef.current.postFilterNormalizer.gainReductionDb;
      if (nowReduction < pendingReductionRef.current) {
        pendingReductionRef.current = nowReduction;
      }

      const now = performance.now();
      if (now - sampledAtRef.current >= LOUDNESS_SAMPLE_MS) {
        sampledAtRef.current = now;
        const at = headRef.current;
        momentaryRef.current[at] = live.momentaryLufs;
        shortTermRef.current[at] = live.shortTermLufs;
        // The DEEPEST reduction since the last column, not the one that
        // happened to be current when the clock came round. A limiter display
        // that samples instead of holding is a display that misses the
        // transient the limiter exists for.
        reductionRef.current[at] = pendingReductionRef.current;
        pendingReductionRef.current = 0;
        headRef.current = (at + 1) % LOUDNESS_HISTORY;
        filledRef.current = Math.min(LOUDNESS_HISTORY, filledRef.current + 1);
        setReadout({
          momentaryLufs: live.momentaryLufs,
          shortTermLufs: live.shortTermLufs,
          integratedLufs: live.integratedLufs,
          rangeLu: live.rangeLu,
          truePeakDb: meterRef.current.inputTruePeakDb,
        });
      }

      const plot: IMasterLoudnessPlot = {
        momentary: momentaryRef.current,
        shortTerm: shortTermRef.current,
        reduction: reductionRef.current,
        head: headRef.current,
        filled: filledRef.current,
        integratedLufs: live.integratedLufs,
        targetLufs: master.loudnessTargetLufs,
        liveReductionDb: nowReduction,
        targetActive: maximizeActive,
        overCeiling: overCeiling && !reducing,
        targetLabel,
        integratedLabel: t('dsp.master.graph.integratedLine', {
          value: displayLufs(live.integratedLufs),
        }),
        reductionLabel,
      };
      paintMasterLoudness(context, width, height, plot);
    };

    const loop = startGraphLoop(paint, {
      /**
       * The strip empties when the engine lets go.
       *
       * A column lands every hundred milliseconds, so a loop that stops and
       * starts again later would butt two different moments together and draw
       * the join as continuous. `filled` back to zero is the honest picture:
       * nothing has been measured yet.
       */
      onEngineGone: () => {
        momentaryRef.current.fill(-120);
        shortTermRef.current.fill(-120);
        reductionRef.current.fill(0);
        headRef.current = 0;
        filledRef.current = 0;
        // Restarted, not zeroed. A zero here is a sample clock that elapsed
        // long ago, so the very next frame — the one drawing the emptied strip
        // — would commit a column of the readings that were current when the
        // engine stopped, and the strip would clear to a single stale mark.
        sampledAtRef.current = performance.now();
        pendingReductionRef.current = 0;
      },
    });
    redraw.current = loop.schedule;
    return () => {
      redraw.current = undefined;
      loop.stop();
    };
  }, [
    maximizeActive,
    master.loudnessTargetLufs,
    overCeiling,
    reducing,
    reductionLabel,
    t,
    targetLabel,
  ]);

  // Repaint when anything drawn changes. The loop only turns while the engine
  // is publishing, so the target line and the ceiling reach the canvas through
  // here while nothing is playing.
  //
  // Every render is a host frame or a settings change, so this is also where
  // an event still in the readings is stamped as seen: the last frame that
  // carried it is the evidence the hold counts from.
  useEffect(() => {
    const now = performance.now();
    if (holdRef.current.peakActive) {
      peakSeenAtRef.current = now;
    }
    if (holdRef.current.dcActive) {
      dcSeenAtRef.current = now;
    }
    redraw.current?.();
  });

  return (
    <div className="dsp-eq-plot dsp-master-display">
      <canvas
        ref={canvasRef}
        className="dsp-eq-graph dsp-master-canvas"
        aria-hidden="true"
      />
      <div className="dsp-master-status" aria-live="polite">
        <span className={peakStatusClass}>{peakStatus}</span>
        <span className={dcFixed ? 'is-fixed' : 'is-safe'}>
          {dcFixed
            ? t('dsp.master.graph.dcFixed', {
                amount: displayDbfs(heldDcCorrectionDb),
              })
            : t('dsp.master.graph.dcClean')}
        </span>
        <span className={faults > 0 ? 'is-fixed' : 'is-safe'}>
          {faults > 0
            ? t('dsp.master.graph.faultFixed', { count: faults })
            : t('dsp.master.graph.faultClean')}
        </span>
        <span className={safetyStatusClass}>{safetyStatus}</span>
        {maximizeActive ? (
          <span className="is-safe">
            {t('dsp.master.graph.loudnessActive', {
              gain: signedDb(loudnessGainDb),
              target: master.loudnessTargetLufs.toFixed(1),
            })}
          </span>
        ) : undefined}
        {/*
          Said out loud, because otherwise the only evidence of it is that the
          music got quieter — which from the listener's side is
          indistinguishable from a fault. A listening aid that lowers the
          output silently is most of why this control was confusing.
        */}
        {maximizeActive && master.matchedBypass ? (
          <span className="is-fixed">
            {t('dsp.master.graph.matchedActive', {
              gain: signedDb(loudnessGainDb),
            })}
          </span>
        ) : undefined}
      </div>
      <ul className="dsp-eq-legend dsp-master-legend">
        <li className="dsp-eq-legend-item">
          <span
            className="dsp-eq-legend-mark is-filled"
            style={{
              color: 'color-mix(in srgb, var(--accent) 50%, transparent)',
            }}
          />
          {t('dsp.master.graph.momentary')}
        </li>
        <li className="dsp-eq-legend-item">
          <span
            className="dsp-eq-legend-mark"
            style={{ color: BASE_CURVE_CSS }}
          />
          {t('dsp.master.graph.shortTerm')}
        </li>
        <li className="dsp-eq-legend-item">
          <span
            className="dsp-eq-legend-mark is-dashed"
            style={{ color: 'rgb(255,176,89)' }}
          />
          {t('dsp.master.graph.target')}
        </li>
        <li className="dsp-eq-legend-item">
          <span
            className="dsp-eq-legend-mark is-dashed"
            style={{ color: 'rgba(226,236,255,0.8)' }}
          />
          {t('dsp.master.graph.integrated')}
        </li>
      </ul>
      <div className="dsp-master-loudness" aria-live="polite">
        <span>
          <em>{t('dsp.master.loudness.momentary')}</em>
          {displayLufs(readout.momentaryLufs)}
        </span>
        <span>
          <em>{t('dsp.master.loudness.shortTerm')}</em>
          {displayLufs(readout.shortTermLufs)}
        </span>
        <span className="is-primary">
          <em>{t('dsp.master.loudness.integrated')}</em>
          {displayLufs(readout.integratedLufs)}
        </span>
        <span>
          <em>{t('dsp.master.loudness.range')}</em>
          {readout.rangeLu > 0 ? `${readout.rangeLu.toFixed(1)} LU` : '—'}
        </span>
        <span className={overCeiling ? 'is-warning' : undefined}>
          <em>{t('dsp.master.loudness.truePeak')}</em>
          {readout.truePeakDb <= -119.5
            ? '—'
            : `${readout.truePeakDb.toFixed(1)} dBTP`}
        </span>
      </div>
    </div>
  );
};

export default DspMasterGraph;
