/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { PointerEvent, useEffect, useRef } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { FilterTypeEnum } from '../../common/constants';
import { IEqBandSettings, IEqSettings } from '../../common/dsp/chain';
import { biquadCoefficients, biquadMagnitudeDb } from './biquad';
import {
  readDspAnalyser,
  readDspBandAmounts,
  readDspBandLevels,
  readDspHeadroomGiveBack,
  readDspPeak,
} from './store';

const MIN_HZ = 20;
const MAX_HZ = 20_000;

/**
 * Vertical half-range.
 *
 * Wider than one band can reach, so a stack that adds up still lands inside
 * the box rather than against its edge — which would read as the EQ refusing
 * to go further.
 */
const RANGE_DB = 18;

const HEIGHT = 300;
/** Insets: room for the dB scale on the left and the frequencies underneath. */
const PAD_L = 46;
/**
 * Wide enough for "-90" on the right.
 *
 * This plot carries two scales, and only labelling one of them was a trap:
 * the curve is in dB of GAIN and the spectrum behind it is in dBFS of LEVEL,
 * so a threshold drawn at -60 dBFS lands where about -4 dB of gain would be
 * and gets read as -4. Two quantities cannot share one axis — they are not
 * the same kind of number — so the answer is the second axis, not a
 * compromise between them.
 */
const PAD_R = 40;
const PAD_T = 14;
const PAD_B = 26;

const GRID_HZ: [number, string][] = [
  [30, '30'],
  [100, '100'],
  [300, '300'],
  [1_000, '1k'],
  [3_000, '3k'],
  [10_000, '10k'],
];
const GRID_DB = [12, 6, 0, -6, -12];

/** One response point per 2px is smooth without computing what cannot be seen. */
const POINT_STEP_PX = 2;
/** How close a click has to land to grab a handle, in CSS pixels. */
const GRAB_RADIUS = 16;
const HANDLE_R = 8;

/**
 * The spectrum's vertical range, in dBFS.
 *
 * -96 is below anything audible in a 16-bit source. The top was -6 for a
 * while, to keep a mastered track from pinning flat against the ceiling —
 * which was the right call while the scale was unlabelled scenery and the
 * wrong one the moment it became an axis somebody reads a threshold against.
 * Full scale is the number that matters on a level scale, so full scale is
 * where the top is, and a track that reaches it is telling the truth.
 */
const SPECTRUM_FLOOR_DB = -96;
const SPECTRUM_TOP_DB = 0;

/** Where the level scale is marked, in dBFS. Evenly spaced across the range
 * and few enough not to compete with the gain grid beside them. */
const GRID_DBFS = [0, -24, -48, -72];

/**
 * The plot's coordinate maths, at module scope.
 *
 * Outside the component because the paint effect is armed once and must not
 * list them as dependencies: functions recreated per render would tear the
 * ResizeObserver down and rebuild it on every pixel of a drag.
 */
const plotW = (width: number) => Math.max(1, width - PAD_L - PAD_R);
const plotH = (height: number) => Math.max(1, height - PAD_T - PAD_B);

const hzToX = (hz: number, width: number) =>
  PAD_L +
  (Math.log10(hz / MIN_HZ) / Math.log10(MAX_HZ / MIN_HZ)) * plotW(width);

const xToHz = (x: number, width: number) => {
  const across = Math.min(plotW(width), Math.max(0, x - PAD_L));
  return MIN_HZ * (MAX_HZ / MIN_HZ) ** (across / plotW(width));
};

/**
 * The level scale, both ways, beside the gain scale rather than inside the
 * paint loop — the threshold is dragged as well as drawn, and a pointer
 * working from a second copy of this arithmetic would land somewhere the
 * line is not.
 */
const dbfsToY = (dbfs: number, height: number) =>
  PAD_T +
  plotH(height) -
  ((Math.max(SPECTRUM_FLOOR_DB, Math.min(SPECTRUM_TOP_DB, dbfs)) -
    SPECTRUM_FLOOR_DB) /
    (SPECTRUM_TOP_DB - SPECTRUM_FLOOR_DB)) *
    plotH(height);

const yToDbfs = (y: number, height: number) => {
  const span = plotH(height);
  const from = Math.min(PAD_T + span, Math.max(PAD_T, y)) - PAD_T;
  return (
    SPECTRUM_TOP_DB - (from / span) * (SPECTRUM_TOP_DB - SPECTRUM_FLOOR_DB)
  );
};

const dbToY = (db: number, height: number) =>
  PAD_T + plotH(height) / 2 - (db / RANGE_DB) * (plotH(height) / 2);

const yToDb = (y: number, height: number) => {
  const span = plotH(height);
  const from = Math.min(PAD_T + span, Math.max(PAD_T, y)) - PAD_T;
  return ((span / 2 - from) / (span / 2)) * RANGE_DB;
};

const toSpec = (band: IEqBandSettings) => ({
  type: band.type as FilterTypeEnum,
  frequency: band.frequency,
  gainDb: band.gainDb,
  quality: band.quality,
});

interface IDspEqGraphProps {
  eq: IEqSettings;
  sampleRate: number;
  selected: number;
  onSelect: (index: number) => void;
  /** Live, while a handle is dragged. */
  onChange: (index: number, next: Partial<IEqBandSettings>) => void;
  /** Once the drag ends. */
  onCommit: () => void;
}

/**
 * The EQ, as the thing you actually work on.
 *
 * Canvas rather than SVG, for two reasons that both bit:
 *
 *  - **One DOM node instead of twenty-odd.** The SVG version rebuilt six band
 *    paths, six handles, eleven grid lines and their labels as elements on
 *    every render — and a render happens on every pixel of a drag. That is a
 *    lot of nodes created and dropped for something the compositor redraws
 *    anyway, and it is exactly the churn the rest of this app already uses
 *    canvas to avoid.
 *  - **Nothing gets stretched.** The SVG stretched a fixed viewBox to the
 *    panel with `preserveAspectRatio="none"`, which scales EVERYTHING: at a
 *    panel around 1800px wide, every circle came out an ellipse and every
 *    label came out horizontally squashed. A canvas is sized in real pixels,
 *    so a circle is a circle.
 *
 * The response is computed from the COEFFICIENTS, so the drift near Nyquist
 * that `dspBiquad.test.ts` measures is on screen rather than hidden behind an
 * idealised shape. A display that draws the request flatters the filter
 * exactly where it is least accurate.
 */
const DspEqGraph = ({
  eq,
  sampleRate,
  selected,
  onSelect,
  onChange,
  onCommit,
}: IDspEqGraphProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef<number | null>(null);
  /** A threshold drag, which is a different gesture from moving a band. */
  const draggingThreshold = useRef(false);
  /**
   * The live props, for the draw loop.
   *
   * The effect that paints must not re-subscribe on every prop change — it
   * would tear down and rebuild the ResizeObserver on every pixel of a drag.
   * It reads through this instead and is armed once.
   */
  const view = useRef<{
    eq: IEqSettings;
    sampleRate: number;
    selected: number;
    /** The one string the canvas draws. Through the ref like everything else,
     * so switching language repaints without rebuilding the observer. */
    t: (
      key: 'dsp.eq.overUnity' | 'dsp.eq.thresholdMark' | 'dsp.eq.inputMark',
      values: Record<string, string>,
    ) => string;
    redraw?: () => void;
  }>({ eq, sampleRate, selected, t });
  // Assigned field by field: replacing the object would drop `redraw`, which
  // the paint effect installs once and every later render depends on.
  view.current.eq = eq;
  view.current.sampleRate = sampleRate;
  view.current.selected = selected;
  view.current.t = t;

  /** CSS pixels of the drawing area, read from the element each paint. */
  const boxRef = useRef({ width: 0, height: HEIGHT });
  /** Reused across frames: a new array per paint would be 60 a second. */
  const binsRef = useRef(new Float32Array(0));

  const toX = (hz: number) => hzToX(hz, boxRef.current.width);
  const toHz = (x: number) => xToHz(x, boxRef.current.width);
  const toY = (db: number) => dbToY(db, boxRef.current.height);
  const toDb = (y: number) => yToDb(y, boxRef.current.height);

  useEffect(() => {
    /**
     * The drawn engagement of each band, eased toward what was reported.
     *
     * The worklet reports the PEAK engagement over its block, which is the
     * right number for deciding anything and the wrong one for drawing: it
     * slams between nothing and everything twenty times a second, and the
     * curve strobed. Eased here rather than in the worklet because the audio
     * thread must act on the peak, and only the picture wants the average.
     *
     * Lives in the effect, which is armed once, so it survives every frame
     * without a ref and without allocating.
     */
    const drawnAmounts: number[] = [];
    /**
     * The drawn input gain, eased toward what is actually applied.
     *
     * The adaptive stage gives headroom back slowly and takes it at once,
     * which is right for the audio and unwatchable on a line: every loud
     * passage snapped it down and the climb walked it back up, so it flickered
     * across the plot. The gain still moves the instant it needs to; only the
     * picture of it is smoothed.
     *
     * NaN until the first frame, so the line starts where it belongs rather
     * than sliding down from unity every time the page is opened.
     */
    let drawnInput = Number.NaN;
    /** The drawn level of each band, eased the same way its engagement is. */
    const drawnLevels: number[] = [];
    /** How present the band's live level line is, 0 to 1. */
    let drawnLit = 0;
    /**
     * How lit the clip stripe is, 0 to 1.
     *
     * The measurement behind it is a yes or no taken twenty-three times a
     * second, so drawing it directly made a stripe that strobed — which reads
     * as a rendering fault rather than as a warning, and a warning nobody
     * believes is worse than none. It lights at once and fades over about a
     * second, so a single clipped block is still visible and a run of them
     * holds steady.
     */
    let clipGlow = 0;
    /** How far past full scale it went, in dB, eased for the same reason. */
    let clipOver = 0;
    /**
     * The response at each plotted point, worked out once a frame.
     *
     * The curve, the at-rest twin, the headroom shading and the fuzz grain
     * all walk the same points, and each of them used to re-evaluate every
     * band there: fifteen filters across four hundred points, four times over,
     * sixty times a second. Now the whole rack is measured once per point and
     * the four passes read the answer.
     *
     * Kept out here and grown in place, because a pair of fresh arrays per
     * frame is garbage collected sixty times a second for nothing.
     */
    let plotHz = new Float64Array(0);
    let plotTotal = new Float64Array(0);
    let plotRest = new Float64Array(0);
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return undefined;
    }

    let frame = 0;
    const paint = () => {
      frame = 0;
      const box = canvas.getBoundingClientRect();
      if (box.width < 1) {
        return;
      }
      boxRef.current = { width: box.width, height: box.height };

      // Sized here rather than in an effect: the ratio is not only a property
      // of the element, and dragging the window onto a display with another
      // scale changes it with nothing to observe. Assigning either dimension
      // clears the canvas, so the transform is set every paint.
      const ratio = window.devicePixelRatio || 1;
      const backingW = Math.max(1, Math.round(box.width * ratio));
      const backingH = Math.max(1, Math.round(box.height * ratio));
      if (canvas.width !== backingW || canvas.height !== backingH) {
        canvas.width = backingW;
        canvas.height = backingH;
      }
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const {
        eq: liveEq,
        sampleRate: rate,
        selected: pick,
        t: translate,
      } = view.current;
      // Local to the paint, from the box just measured: the module-scope maths
      // takes the size rather than closing over it.
      const W = boxRef.current.width;
      const H = boxRef.current.height;
      const X = (hz: number) => hzToX(hz, W);
      const Y = (db: number) => dbToY(db, H);

      context.font =
        '12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      context.textBaseline = 'middle';

      GRID_DB.forEach((db) => {
        const y = Math.round(Y(db)) + 0.5;
        context.strokeStyle =
          db === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(PAD_L, y);
        context.lineTo(boxRef.current.width - PAD_R, y);
        context.stroke();
        context.fillStyle = 'rgba(255,255,255,0.38)';
        context.textAlign = 'right';
        context.fillText(db > 0 ? `+${db}` : `${db}`, PAD_L - 8, y);
      });

      // The level scale, on the right and deliberately dimmer than the gain
      // scale: the curve is what this page is for, and the spectrum is the
      // backdrop it is being read against.
      context.textAlign = 'left';
      context.fillStyle = 'rgba(255,255,255,0.26)';
      GRID_DBFS.forEach((dbfs) => {
        const level =
          (dbfs - SPECTRUM_FLOOR_DB) / (SPECTRUM_TOP_DB - SPECTRUM_FLOOR_DB);
        const y = Math.round(PAD_T + plotH(H) - level * plotH(H)) + 0.5;
        context.fillText(`${dbfs}`, PAD_L + plotW(W) + 7, y);
      });

      context.textAlign = 'center';
      GRID_HZ.forEach(([hz, label]) => {
        const x = Math.round(X(hz)) + 0.5;
        context.strokeStyle = 'rgba(255,255,255,0.07)';
        context.beginPath();
        context.moveTo(x, PAD_T);
        context.lineTo(x, PAD_T + plotH(H));
        context.stroke();
        context.fillStyle = 'rgba(255,255,255,0.38)';
        context.fillText(label, x, boxRef.current.height - PAD_B / 2);
      });

      /**
       * The live spectrum, behind everything else.
       *
       * Tapped after the chain, so what is drawn is what is heard: cut a band
       * and the shape under the curve drops with it. That is the whole reason
       * an EQ shows a spectrum at all — otherwise you are aiming at a guess.
       *
       * Mapped from bin to log-frequency by picking the loudest bin that falls
       * in each pixel column. Averaging would smear the peaks that matter; the
       * bottom octaves have fewer bins than columns and repeat, which is
       * honest — the resolution genuinely is not there.
       */
      const live = readDspAnalyser();
      if (live) {
        if (binsRef.current.length !== live.frequencyBinCount) {
          binsRef.current = new Float32Array(live.frequencyBinCount);
        }
        const bins = binsRef.current;
        live.getFloatFrequencyData(bins);
        const nyquist = rate / 2;
        const floorY = PAD_T + plotH(H);

        context.beginPath();
        context.moveTo(PAD_L, floorY);
        let started = false;
        for (let x = 0; x <= plotW(W); x += 1) {
          const hzFrom = xToHz(PAD_L + x, W);
          const hzTo = xToHz(PAD_L + x + 1, W);
          const first = Math.floor((hzFrom / nyquist) * bins.length);
          const last = Math.max(
            first,
            Math.min(
              bins.length - 1,
              Math.ceil((hzTo / nyquist) * bins.length),
            ),
          );
          let peak = -Infinity;
          for (let bin = first; bin <= last; bin += 1) {
            if (bins[bin] > peak) {
              peak = bins[bin];
            }
          }
          if (!Number.isFinite(peak)) {
            peak = SPECTRUM_FLOOR_DB;
          }
          const level =
            (Math.max(SPECTRUM_FLOOR_DB, peak) - SPECTRUM_FLOOR_DB) /
            (SPECTRUM_TOP_DB - SPECTRUM_FLOOR_DB);
          const y = floorY - level * plotH(H);
          if (started) {
            context.lineTo(PAD_L + x, y);
          } else {
            context.lineTo(PAD_L + x, y);
            started = true;
          }
        }
        context.lineTo(PAD_L + plotW(W), floorY);
        context.closePath();
        context.fillStyle = 'rgba(0,229,207,0.10)';
        context.fill();
        context.strokeStyle = 'rgba(0,229,207,0.22)';
        context.lineWidth = 1;
        context.stroke();
      }

      /**
       * The rate the filters are actually BUILT at, not the session's.
       *
       * With oversampling on, the worklet designs every band for the doubled
       * or quadrupled rate. Drawing them at the session rate showed a curve
       * that was not the one being heard — the difference lives near Nyquist,
       * which is exactly where oversampling is meant to help, so the graph was
       * hiding the very thing the control does.
       */
      // Linear phase is designed at the base rate whatever the oversampling
      // control says, so the curve has to be drawn there too — otherwise the
      // graph shows a rack nobody is listening to.
      const designRate =
        liveEq.phase === 'linear'
          ? rate
          : rate * Math.max(1, liveEq.oversample);

      const active = liveEq.bands.map((one) =>
        one.enabled
          ? biquadCoefficients(
              toSpec(one),
              designRate,
              liveEq.model,
              liveEq.modelAmount,
            )
          : undefined,
      );

      // Audible and, until now, invisible: the subsonic high pass runs ahead of
      // the bands and shaped the sound without appearing on the curve at all.
      const subsonic =
        liveEq.subsonicHz > 0
          ? biquadCoefficients(
              {
                type: FilterTypeEnum.HPQ,
                frequency: liveEq.subsonicHz,
                gainDb: 0,
                quality: 0.707,
              },
              rate,
            )
          : undefined;
      const steps = Math.max(2, Math.round(plotW(W) / POINT_STEP_PX));

      // Each band's own contribution, faint. The sum alone cannot say which
      // band is responsible for a dip.
      active.forEach((coefficients, index) => {
        if (!coefficients) {
          return;
        }
        context.beginPath();
        for (let i = 0; i <= steps; i += 1) {
          const hz = MIN_HZ * (MAX_HZ / MIN_HZ) ** (i / steps);
          const y = Y(biquadMagnitudeDb(coefficients, hz, designRate));
          if (i === 0) {
            context.moveTo(X(hz), y);
          } else {
            context.lineTo(X(hz), y);
          }
        }
        const isPick = index === pick;
        context.strokeStyle = isPick
          ? 'rgba(156,255,244,0.55)'
          : 'rgba(255,255,255,0.15)';
        context.lineWidth = isPick ? 1.5 : 1;
        context.stroke();
      });

      // The cut drawn on its own, in a colder colour than the bands: it is not
      // a band and cannot be selected or dragged, so it should not look like
      // one.
      if (subsonic) {
        context.beginPath();
        for (let i = 0; i <= steps; i += 1) {
          const hz = MIN_HZ * (MAX_HZ / MIN_HZ) ** (i / steps);
          const y = Y(biquadMagnitudeDb(subsonic, hz, rate));
          if (i === 0) {
            context.moveTo(X(hz), y);
          } else {
            context.lineTo(X(hz), y);
          }
        }
        context.strokeStyle = 'rgba(120,170,255,0.45)';
        context.lineWidth = 1.25;
        context.setLineDash([4, 3]);
        context.stroke();
        context.setLineDash([]);
      }

      /**
       * What each band is applying right now, as the worklet measured it.
       *
       * A static band is always 1. A dynamic one is somewhere between 0 and 1
       * and moves with the material, which is the only way the threshold dial
       * has any visible effect: the full-strength curve and the at-rest curve
       * are both fixed, so drawing either of them alone made the control look
       * broken while it was working.
       */
      const amounts = readDspBandAmounts();
      liveEq.bands.forEach((one, index) => {
        const target = one.dynamic ? (amounts[index] ?? 0) : 1;
        const shown = drawnAmounts[index] ?? target;
        /**
         * Slow on purpose, and slower than the band it is drawing.
         *
         * The audio follows the material in milliseconds because that is what
         * a de-esser is for. The PICTURE of it at that speed is a curve that
         * darts, which is unreadable and tiring — so the drawn engagement
         * lags well behind the applied one. Nothing here reaches a sample:
         * this is the resolution of the animation, not of the filter.
         *
         * Still asymmetric, because a curve that rises with the music and
         * settles back afterwards reads as cause and effect, while one that
         * moves at the same rate both ways reads as drift.
         */
        // Slower again. At a tenth and a twenty-fifth the curve still chased
        // the music closely enough to read as motion rather than as shape;
        // these are about a quarter of a second to open and most of a second
        // to settle, which is the pace an eye follows without being pulled.
        const ease = target > shown ? 0.05 : 0.02;
        drawnAmounts[index] = shown + (target - shown) * ease;
      });
      const amountOf = (index: number): number => drawnAmounts[index] ?? 1;

      const totalAt = (hz: number): number => {
        let total = subsonic ? biquadMagnitudeDb(subsonic, hz, rate) : 0;
        active.forEach((coefficients, index) => {
          if (coefficients) {
            total +=
              biquadMagnitudeDb(coefficients, hz, designRate) * amountOf(index);
          }
        });
        return total;
      };

      /**
       * The curve with the dynamic bands doing nothing.
       *
       * A dynamic band is drawn at full strength like any other, which is a lie
       * for most of the record: it only reaches that shape while its own
       * passband is over the threshold. Drawing where the curve sits at rest as
       * well turns one misleading line into a pair the response travels
       * between, which is the honest picture and the only way the feature is
       * visible at all when nothing is playing.
       */
      const hasDynamic = liveEq.bands.some(
        (one) => one.enabled && one.dynamic && one.gainDb !== 0,
      );
      const restAt = (hz: number): number => {
        let total = subsonic ? biquadMagnitudeDb(subsonic, hz, rate) : 0;
        active.forEach((coefficients, index) => {
          if (coefficients && !liveEq.bands[index]?.dynamic) {
            total += biquadMagnitudeDb(coefficients, hz, designRate);
          }
        });
        return total;
      };

      if (plotHz.length !== steps + 1) {
        plotHz = new Float64Array(steps + 1);
        plotTotal = new Float64Array(steps + 1);
        plotRest = new Float64Array(steps + 1);
      }
      for (let i = 0; i <= steps; i += 1) {
        const hz = MIN_HZ * (MAX_HZ / MIN_HZ) ** (i / steps);
        plotHz[i] = hz;
        plotTotal[i] = totalAt(hz);
        plotRest[i] = hasDynamic ? restAt(hz) : plotTotal[i];
      }

      if (hasDynamic) {
        context.beginPath();
        for (let i = 0; i <= steps; i += 1) {
          const hz = plotHz[i];
          const y = Y(plotRest[i]);
          if (i === 0) {
            context.moveTo(X(hz), y);
          } else {
            context.lineTo(X(hz), y);
          }
        }
        // The curve's own colour at a third of its weight, so it reads as the
        // same line somewhere else rather than as a second, unrelated trace.
        context.strokeStyle = 'rgba(0,229,207,0.32)';
        context.lineWidth = 1.5;
        context.setLineDash([6, 4]);
        context.stroke();
        context.setLineDash([]);
      }

      context.beginPath();
      for (let i = 0; i <= steps; i += 1) {
        const hz = plotHz[i];
        const y = Y(plotTotal[i]);
        if (i === 0) {
          context.moveTo(X(hz), y);
        } else {
          context.lineTo(X(hz), y);
        }
      }
      context.strokeStyle = '#00e5cf';
      context.lineWidth = 2.5;
      context.lineJoin = 'round';
      context.stroke();

      /**
       * Where the curve is spending headroom it may not have.
       *
       * The one kind of distortion an equaliser causes by itself is running the
       * output past full scale, and the magnitude plot hides it completely: a
       * +9 dB boost is drawn exactly as happily as a -9 dB cut. Anywhere the
       * summed curve plus the preamp comes out above unity, the material only
       * survives because it was not already loud there — which is luck rather
       * than headroom.
       *
       * Shaded rather than flagged, so it says WHERE as well as whether. The
       * preamp is included because that is the control that buys the room back,
       * and the mask retreating as it is turned down is the clearest way to
       * show what it is for.
       */
      context.beginPath();
      let worst = 0;
      for (let i = 0; i <= steps; i += 1) {
        const hz = plotHz[i];
        // Both gains, because both are in front of the bands by the time a
        // sample arrives: what the regulator took out and what the user put
        // back. Showing only one of them would shade an area that is not there.
        const over = plotTotal[i] + liveEq.preampDb + liveEq.trimDb;
        const y = over > 0 ? Y(over) : Y(0);
        worst = Math.max(worst, over);
        if (i === 0) {
          context.moveTo(X(hz), y);
        } else {
          context.lineTo(X(hz), y);
        }
      }
      // Half of the tenth the readout is written to. Below that the figure
      // rounds to "0.0 dB over", which says a thing and its opposite in one
      // line — and there is nothing there to warn about anyway.
      if (worst >= 0.05) {
        context.lineTo(X(MAX_HZ), Y(0));
        context.lineTo(X(MIN_HZ), Y(0));
        context.closePath();
        // Nearly twice the alpha it shipped at, and it needed to be. The shade
        // sits ON TOP of the spectrum's own fill, so at 0.16 a boost of twelve
        // decibels was a pink tint over a bright green area and read as part of
        // the spectrum — the mask was drawing correctly and could not be seen,
        // which is worse than not drawing at all.
        context.fillStyle = 'rgba(255,100,124,0.3)';
        context.fill();
        context.strokeStyle = 'rgba(255,140,158,0.85)';
        context.lineWidth = 1.25;
        context.stroke();

        // The ceiling itself, drawn across the whole plot. The shaded area says
        // how far past unity the curve goes; without a line at unity there is
        // nothing to read that distance against.
        context.beginPath();
        context.moveTo(PAD_L, Y(0));
        context.lineTo(PAD_L + plotW(W), Y(0));
        context.strokeStyle = 'rgba(255,140,158,0.55)';
        context.setLineDash([5, 4]);
        context.stroke();
        context.setLineDash([]);

        // And the number, because "some pink" is not a measurement. This is the
        // figure the automatic trim would remove.
        context.font =
          '600 12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
        context.textBaseline = 'top';
        context.fillStyle = 'rgba(255,140,158,0.95)';
        context.fillText(
          translate('dsp.eq.overUnity', { gain: worst.toFixed(1) }),
          PAD_L + 8,
          PAD_T + 6,
        );
      }

      /**
       * The selected band’s threshold, on the spectrum’s own scale.
       *
       * The dial sets a level in dBFS and the curve is drawn in dB of gain,
       * so there was nowhere on this plot for the number to appear and
       * turning it moved nothing. The spectrum behind the curve IS in dBFS,
       * though, and it is exactly what the detector measures — so the line
       * belongs on that scale, against the material it is being compared to.
       *
       * Only as wide as the band it belongs to. Drawn across the whole plot
       * it would claim to be a threshold for everything, and it is not: each
       * dynamic band listens to its own passband and nothing else.
       */
      const picked = liveEq.bands[pick];
      if (picked?.dynamic && picked.enabled) {
        /**
         * Both of these are true dBFS, and the spectrum behind them is not.
         *
         * The threshold and the detector both measure the signal itself,
         * where 1.0 is full scale. The spectrum measures one FFT bin out of a
         * thousand, and broadband music spread across all of them leaves every
         * bin twenty to thirty decibels under the level of the whole — which
         * is why the output meters can sit at 0 while nothing on this display
         * comes near it. So the threshold is drawn with the band’s OWN level
         * beside it and the two are read against each other; the spectrum is
         * the shape behind them, not the thing they are compared to.
         */
        const toY = (dbfs: number) => dbfsToY(dbfs, H);
        const y = toY(picked.thresholdDb);
        // The half-power edges: the octave span either side of centre that a
        // bell of this Q actually hears.
        const spread = 2 ** (1 / (2 * Math.max(0.1, picked.quality)));
        const from = X(Math.max(MIN_HZ, picked.frequency / spread));
        const to = X(Math.min(MAX_HZ, picked.frequency * spread));
        context.beginPath();
        context.moveTo(from, y);
        context.lineTo(to, y);
        context.strokeStyle = 'rgba(255,196,92,0.85)';
        context.lineWidth = 1.75;
        context.setLineDash([5, 3]);
        context.stroke();
        context.setLineDash([]);

        // What the band is hearing right now, solid, against the dashed line
        // it is being compared to. Where the solid one rises above the dashed
        // one, the band is working — which is the whole of the feature, in
        // one picture, on a scale where both numbers mean the same thing.
        /**
         * Always drawn, and brightening rather than switching.
         *
         * Two things made this blink. It was only drawn above a floor, so it
         * vanished and returned between reports; and its colour flipped on a
         * hard comparison with the threshold, so a level sitting near the line
         * alternated bright and dim every frame. A line that appears and
         * disappears is read as a fault, not as a measurement.
         *
         * Now it is always there — resting on the floor when there is nothing
         * to hear — and its weight follows the same eased engagement the
         * curve uses, so crossing the threshold is a fade rather than a
         * switch.
         */
        /**
         * The line FADES when there is nothing to hear; it does not sink.
         *
         * Sliding it down to the floor was worse than hiding it: the floor is
         * a real position on the scale, so a band hearing nothing drew a line
         * that said "about -96 dB" — a measurement, and a wrong one. Holding
         * the last position and taking the ink away says "no reading", which
         * is what is true, and it does not travel across the plot to say it.
         */
        const heard = readDspBandLevels()[pick];
        const audible =
          typeof heard === 'number' && heard > SPECTRUM_FLOOR_DB + 6;
        if (audible) {
          const settled = drawnLevels[pick] ?? heard;
          drawnLevels[pick] = settled + (heard - settled) * 0.12;
        }
        const restingAt = drawnLevels[pick] ?? picked.thresholdDb;
        /**
         * Brightness from the line’s own position, not from the engagement.
         *
         * Keyed to how much of the band is being applied, it barely moved:
         * that figure is smoothed, arrives from another thread, and is zero
         * whenever the rack is not actually running — so the line stayed dim
         * while visibly sitting above its threshold, which is the one moment
         * it is supposed to announce.
         *
         * Measured against the dashed line right beside it instead. Over the
         * threshold it lights, and it goes on lighting for the twelve
         * decibels the band takes to reach full strength, so the brightness
         * says how hard rather than merely whether.
         */
        const over = drawnLevels[pick] - picked.thresholdDb;
        const past = Math.max(0, Math.min(1, over / 12));
        const lit = audible ? 0.3 + past * 0.68 : 0;
        drawnLit += (lit - drawnLit) * 0.08;
        if (drawnLit > 0.02) {
          const heardY = toY(restingAt);
          context.beginPath();
          context.moveTo(from, heardY);
          context.lineTo(to, heardY);
          context.strokeStyle = `rgba(255,196,92,${drawnLit.toFixed(3)})`;
          context.lineWidth = 2.5;
          context.stroke();
        }

        /**
         * Labelled, and it is not decoration.
         *
         * This line is on the SPECTRUM’s scale — dBFS, the thing the
         * detector measures — while the curve above it is on the gain axis.
         * Two scales share the plot, so an unlabelled line at -60 dBFS sits
         * where about -4 dB of gain would be and gets read as -4. That is
         * exactly how it was reported, and the number is the whole fix.
         */
        context.font =
          '600 11px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
        context.textBaseline = 'bottom';
        // Set explicitly rather than inherited: the grid labels leave this as
        // 'right' and the axis labels as 'left', so whichever ran last decided
        // where this landed.
        context.textAlign = 'left';
        context.fillStyle = 'rgba(255,196,92,0.95)';
        const caption = translate('dsp.eq.thresholdMark', {
          level: picked.thresholdDb.toFixed(0),
        });
        const captionWidth = context.measureText(caption).width;
        // Centred over the segment it belongs to, then held inside the plot:
        // a band near either edge has its line clipped, and a caption centred
        // on the part that was cut off ends up outside the box.
        const captionX = (from + to) / 2 - captionWidth / 2;
        context.fillText(
          caption,
          Math.min(PAD_L + plotW(W) - captionWidth, Math.max(PAD_L, captionX)),
          y - 3,
        );
      }

      /**
       * Where the input gain has put the whole rack, on the gain axis.
       *
       * Flat by nature — the regulator, the give-back and the preamp are one
       * multiply in front of everything, applied equally at every frequency —
       * so it is a line rather than a curve, and that is the honest shape for
       * it. Drawn because the adaptive half MOVES: without it the only sign
       * that the trim is working is a number in the corner, and the thing it
       * is trading against is the curve right here.
       */
      const appliedInput =
        liveEq.preampDb + liveEq.trimDb + readDspHeadroomGiveBack();
      drawnInput = Number.isNaN(drawnInput)
        ? appliedInput
        : drawnInput + (appliedInput - drawnInput) * 0.08;
      if (Math.abs(drawnInput) >= 0.05) {
        const y = Y(Math.max(-RANGE_DB, Math.min(RANGE_DB, drawnInput)));
        context.beginPath();
        context.moveTo(PAD_L, y);
        context.lineTo(PAD_L + plotW(W), y);
        context.strokeStyle = 'rgba(178,190,255,0.55)';
        context.lineWidth = 1.25;
        context.setLineDash([2, 4]);
        context.stroke();
        context.setLineDash([]);

        context.font =
          '600 11px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
        context.textBaseline = 'bottom';
        context.textAlign = 'left';
        context.fillStyle = 'rgba(178,190,255,0.85)';
        context.fillText(
          translate('dsp.eq.inputMark', {
            gain: drawnInput.toFixed(1),
          }),
          PAD_L + 8,
          y - 3,
        );
      }

      // And whether it is ACTUALLY clipping, which depends on the material as
      // much as on the curve: a stripe along the top while the measured output
      // is past full scale. The mask says where the risk is, this says it has
      // stopped being a risk.
      /**
       * How badly, not merely whether.
       *
       * A fixed bar said the same thing for a hundredth of a decibel over as
       * for six, which are not the same situation: one is a rounding on one
       * transient and the other is audible on everything. The band grows with
       * the overshoot and fades downward into the plot, so the eye reads the
       * depth without a number having to be found.
       *
       * Straight to full on a clipped block and a slow fade after, so one
       * clipped block is not missed and a run of them does not blink.
       */
      const peak = readDspPeak();
      const clipping = peak > 1;
      const overNow = clipping ? 20 * Math.log10(peak) : 0;
      clipGlow = clipping ? 1 : Math.max(0, clipGlow - 0.016);
      clipOver = Math.max(overNow, clipOver + (overNow - clipOver) * 0.05);
      if (clipGlow > 0.01) {
        // Six decibels of overshoot fills the band. Past that it is as loud a
        // warning as the plot can make without covering the curve it is
        // warning about.
        const depth = 3 + Math.min(1, clipOver / 6) * 21;
        const bleed = context.createLinearGradient(0, PAD_T, 0, PAD_T + depth);
        bleed.addColorStop(
          0,
          `rgba(255,100,124,${(clipGlow * 0.62).toFixed(3)})`,
        );
        bleed.addColorStop(1, 'rgba(255,100,124,0)');
        context.fillStyle = bleed;
        context.fillRect(PAD_L, PAD_T, plotW(W), depth);
      }

      /**
       * The fuzz, as grain along the curve.
       *
       * Harmonic colour has no magnitude response to plot — it adds frequencies
       * rather than shaping the ones present — so the honest picture is a
       * roughening of the line rather than a shape of its own.
       *
       * The offsets come from a fixed function of the position, NOT from
       * `Math.random`: this repaints on every animation frame while audio is
       * playing, and random grain would strobe rather than sit still.
       */
      if (liveEq.fuzzAmount > 0) {
        // Enough to read as texture on the line, and no more. A first attempt
        // at twice this was a separate scribble beside the curve rather than a
        // property of it. In the curve's own colours: an orange pass read as a
        // second, unrelated trace.
        const grain = 1 + liveEq.fuzzAmount * 2.5;
        [
          { phase: 0.6, colour: 'rgba(0,229,207,0.42)', width: 1.2 },
          { phase: -0.9, colour: 'rgba(156,255,244,0.28)', width: 1 },
        ].forEach(({ phase, colour, width }) => {
          context.beginPath();
          for (let i = 0; i <= steps; i += 1) {
            const hz = MIN_HZ * (MAX_HZ / MIN_HZ) ** (i / steps);
            const wobble =
              Math.sin(i * 1.9 + phase * 7) * Math.sin(i * 0.47 + phase);
            const y = Y(plotTotal[i]) + wobble * grain;
            if (i === 0) {
              context.moveTo(X(hz), y);
            } else {
              context.lineTo(X(hz), y);
            }
          }
          context.strokeStyle = colour;
          context.lineWidth = width;
          context.stroke();
        });
      }

      liveEq.bands.forEach((one, index) => {
        const x = X(one.frequency);
        const y = Y(one.gainDb);
        const isPick = index === pick;
        context.globalAlpha = one.enabled ? 1 : 0.32;

        /**
         * A ring outside the handle for a band that reacts.
         *
         * The picker below already marks them, but the picker is a row of
         * numbers and the graph is where the bands are actually looked at —
         * having to translate "band 12" into a position on the curve is the
         * kind of small tax that gets paid on every glance.
         *
         * Outside rather than a change of fill: the fill already carries
         * selection and the alpha carries enabled, and a third meaning loaded
         * onto the same pixels is a code rather than a picture. Dashed, like
         * the at-rest curve and the picker’s own ring, so all three say the
         * same thing the same way.
         */
        if (one.dynamic) {
          context.beginPath();
          context.arc(x, y, HANDLE_R + 4, 0, Math.PI * 2);
          context.strokeStyle = 'rgba(255,196,92,0.85)';
          context.lineWidth = 1.5;
          context.setLineDash([3, 3]);
          context.stroke();
          context.setLineDash([]);
        }

        context.beginPath();
        context.arc(x, y, HANDLE_R, 0, Math.PI * 2);
        context.fillStyle = isPick ? '#00e5cf' : 'rgba(7,5,18,0.85)';
        context.fill();
        context.strokeStyle = isPick ? '#ffffff' : 'rgba(0,229,207,0.7)';
        context.lineWidth = 2;
        context.stroke();
        context.globalAlpha = 1;
      });
    };

    /**
     * One frame at a time, and continuously while there is audio to show.
     *
     * Two things drive a repaint and they want different rates. A knob or a
     * drag changes the curve and needs exactly one frame; the spectrum changes
     * on its own and needs every frame. So the loop keeps running while an
     * analyser is published and stops when there is none — a DSP page with
     * nothing playing costs nothing, and one with audio is a normal 60fps
     * canvas rather than sixty React renders a second.
     */
    const schedule = () => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    function tick() {
      frame = 0;
      paint();
      if (readDspAnalyser()) {
        schedule();
      }
    }

    view.current.redraw = schedule;
    schedule();

    const observer =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(schedule)
        : undefined;
    observer?.observe(canvas);

    return () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
      observer?.disconnect();
    };
  }, []);

  // Repaint when anything drawn changes. The loop itself is armed once above.
  useEffect(() => {
    view.current.redraw?.();
  });

  const localPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    const box = canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  const onDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = localPoint(event);
    if (!point) {
      return;
    }
    /**
     * The threshold line first, when there is one and the pointer is on it.
     *
     * Before the band handles rather than after: the line is thin and the
     * handles are large, so a handle whose grab radius happens to overlap it
     * would win every contest and the line could never be taken. It is only
     * offered inside its own frequency span, which is where it is drawn — a
     * threshold grabbed from the far side of the plot would be a mystery.
     */
    const picked = eq.bands[selected];
    if (picked?.dynamic && picked.enabled) {
      const spread = 2 ** (1 / (2 * Math.max(0.1, picked.quality)));
      const withinBand =
        point.x >= toX(picked.frequency / spread) - GRAB_RADIUS &&
        point.x <= toX(picked.frequency * spread) + GRAB_RADIUS;
      const onLine =
        Math.abs(
          point.y - dbfsToY(picked.thresholdDb, boxRef.current.height),
        ) <= GRAB_RADIUS;
      if (withinBand && onLine) {
        draggingThreshold.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }
    }

    // Nearest handle within reach, so a click near two of them takes the one
    // actually aimed at rather than the first in the array.
    let best = -1;
    let bestDistance = GRAB_RADIUS;
    eq.bands.forEach((one, index) => {
      const distance = Math.hypot(
        point.x - toX(one.frequency),
        point.y - toY(one.gainDb),
      );
      if (distance <= bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    // Empty space deselects. A band stays picked for as long as it is being
    // worked on and lets go when the pointer says so, which is what every
    // other canvas of handles does — and it is the only way to put the
    // threshold line away without switching the band off.
    onSelect(best);
    if (best < 0) {
      return;
    }
    dragging.current = best;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (draggingThreshold.current) {
      const at = localPoint(event);
      if (at) {
        // Clamped to the dial’s own range, so dragging past the top of the
        // plot cannot set a value the knob beside it could not show.
        const dbfs = yToDbfs(at.y, boxRef.current.height);
        onChange(selected, {
          thresholdDb: Number(Math.min(0, Math.max(-60, dbfs)).toFixed(1)),
        });
      }
      return;
    }
    const index = dragging.current;
    const point = index === null ? undefined : localPoint(event);
    if (index === null || !point) {
      return;
    }
    onChange(index, {
      frequency: Math.round(toHz(point.x)),
      gainDb: Number(toDb(point.y).toFixed(1)),
    });
  };

  const endDrag = () => {
    if (draggingThreshold.current) {
      draggingThreshold.current = false;
      onCommit();
      return;
    }
    if (dragging.current === null) {
      return;
    }
    dragging.current = null;
    onCommit();
  };

  return (
    <canvas
      ref={canvasRef}
      className="dsp-eq-graph"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    />
  );
};

export default DspEqGraph;
