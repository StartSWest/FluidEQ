/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { FilterTypeEnum } from '../../common/constants';
import { IDimensionSettings } from '../../common/dsp/chain';
import { useTranslation } from '../utils/I18nContext';
import { biquadCoefficients, biquadMagnitudeDb } from './biquad';
import {
  readDspCorrelation,
  readDspDimensionGuard,
  readDspScatter,
} from './store';
import { IGraphLoopFrame, startGraphLoop } from './graphLoop';

/**
 * The stereo field itself, beside the shape the dials are asking for.
 *
 * Two panes, because this stage needs two different answers and neither one
 * substitutes for the other.
 *
 * THE FIELD, on the left, is the effect. Every pair of samples is plotted with
 * the SIDE on the horizontal axis and the MID on the vertical, which is the
 * arrangement every goniometer in every mastering room uses: a mono record
 * draws a vertical line, a wide one opens into a cloud, and one whose channels
 * are cancelling lies down flat. Turning a width dial visibly opens or closes
 * that cloud, which is the whole point — the picture IS the effect rather than
 * a diagram of it. It is drawn from the pairs the engine publishes, so it shows
 * the processed signal and not the settings' opinion of it.
 *
 * THE CURVE, on the right, is what the six dials add up to across the
 * spectrum. The field cannot show that: a cloud that is wider than it was does
 * not say WHERE it got wider, and this stage is three bands and two corners.
 *
 * The curve is the crossover's own magnitudes rather than three drawn steps.
 * `feq_crossover_split` builds its bands by subtraction — low is a
 * Linkwitz-Riley lowpass, mid is a second lowpass minus the first, high is
 * everything minus the second — so the effective width at a frequency is
 *
 *   w(f) = wLow·L(f) + wMid·(M(f) - L(f)) + wHigh·(1 - M(f))
 *
 * with L and M those two lowpasses. Straight-edged plateaus would be a picture
 * of the settings; this is a picture of the filter.
 *
 * THE GUARD IS DRAWN, not merely metered: it scales every part of the curve
 * above unity, so on material whose channels already cancel the shape sinks
 * toward the middle line while the dials stay where they are. That is the one
 * thing about this stage a user would otherwise have to be told — it is allowed
 * to decline, and here it is declining.
 *
 * Everything is read inside the frame loop from plain module values rather than
 * through React state. The field changes every audio block; a render per block
 * is a repaint no display can show and the reconciler cannot afford.
 */

/** The curve's vertical range. Zero is mono, one unchanged, two the top. */
const MAX_WIDTH = 2;

const MIN_HZ = 20;
const MAX_HZ = 20_000;

/** Enough columns that the corners read as curves rather than stairs. */
const COLUMNS = 280;

const GRID_HZ = [50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000];

/**
 * How much of the previous frame survives into this one.
 *
 * A goniometer drawn without persistence is a spray of unrelated dots that
 * flickers at the frame rate. Fading the last frame instead leaves a trail
 * behind the moving signal, which is what makes the shape readable — and it is
 * how every hardware vectorscope behaves, because the phosphor did it for free.
 */
const FIELD_FADE = 0.72;

/**
 * How much of the recent past the history strip holds.
 *
 * Long enough to watch a chorus arrive and the guard answer it. The guard's own
 * follower takes 400 ms to see the programme change, so a window much shorter
 * than this would show the cause and scroll away before the effect.
 */
const HISTORY_MS = 8_000;

/**
 * One column per this many milliseconds, so the strip scrolls at the same speed
 * on a 60 Hz panel and a 144 Hz one. Between columns the loop keeps the PEAK of
 * what it saw rather than the mean: the side content this stage works on is
 * transient, and averaging it away would draw a flat line under a busy mix.
 */
const HISTORY_SAMPLE_MS = 40;

const HISTORY_COLUMNS = Math.ceil(HISTORY_MS / HISTORY_SAMPLE_MS) + 1;

/** Linkwitz-Riley is two cascaded Butterworths, so the magnitude is squared. */
const lowpassGain = (hz: number, cornerHz: number, rate: number): number => {
  const coefficients = biquadCoefficients(
    {
      type: FilterTypeEnum.LPQ,
      frequency: cornerHz,
      gainDb: 0,
      quality: Math.SQRT1_2,
    },
    rate,
  );
  const linear = 10 ** (biquadMagnitudeDb(coefficients, hz, rate) / 20);
  return linear * linear;
};

interface IDspDimensionGraphProps {
  dimension: IDimensionSettings;
  sampleRate: number;
}

const DspDimensionGraph = ({
  dimension,
  sampleRate,
}: IDspDimensionGraphProps) => {
  const { t } = useTranslation();
  const fieldRef = useRef<HTMLCanvasElement | null>(null);
  const curveRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<HTMLCanvasElement | null>(null);
  /** Newest last. Three tracks over one time axis, so they can be compared. */
  const midHistory = useRef(new Float32Array(HISTORY_COLUMNS));
  const sideHistory = useRef(new Float32Array(HISTORY_COLUMNS));
  const correlationHistory = useRef(new Float32Array(HISTORY_COLUMNS).fill(1));
  const pendingMid = useRef(0);
  const pendingSide = useRef(0);
  const lastSampleAt = useRef(0);
  const settingsRef = useRef(dimension);
  settingsRef.current = dimension;
  const rateRef = useRef(sampleRate);
  rateRef.current = sampleRate;
  /** The running loop's way in, for a render that has to reach the canvas. */
  const redraw = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    const fit = (
      canvas: HTMLCanvasElement,
    ): CanvasRenderingContext2D | null => {
      const context = canvas.getContext('2d');
      if (!context) {
        return null;
      }
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) {
        return null;
      }
      if (canvas.width !== Math.round(width * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      return context;
    };

    const paintField = (enabled: boolean) => {
      const canvas = fieldRef.current;
      const context = canvas && fit(canvas);
      if (!canvas || !context) {
        return;
      }
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      // Fade rather than clear, which is what leaves the trail.
      context.globalCompositeOperation = 'source-over';
      context.fillStyle = `rgba(9, 12, 18, ${1 - FIELD_FADE})`;
      context.fillRect(0, 0, width, height);

      const centreX = width / 2;
      const centreY = height / 2;
      const radius = Math.min(width, height) / 2 - 8;

      context.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      context.lineWidth = 1;
      context.beginPath();
      context.arc(centreX, centreY, radius, 0, Math.PI * 2);
      context.stroke();
      // Vertical is mono, horizontal is pure side: the two readings that matter.
      context.beginPath();
      context.moveTo(centreX, centreY - radius);
      context.lineTo(centreX, centreY + radius);
      context.moveTo(centreX - radius, centreY);
      context.lineTo(centreX + radius, centreY);
      context.stroke();

      const pairs = readDspScatter();
      if (!enabled || pairs.length < 2) {
        return;
      }
      context.fillStyle = 'rgba(150, 205, 255, 0.55)';
      for (let at = 0; at + 1 < pairs.length; at += 2) {
        const left = pairs[at];
        const right = pairs[at + 1];
        // Side across, mid up: mono collapses to the vertical axis.
        const x = centreX + ((left - right) / 2) * radius;
        const y = centreY - ((left + right) / 2) * radius;
        context.fillRect(x, y, 1.6, 1.6);
      }
    };

    /**
     * Side against mid over time, with the correlation that governs the guard.
     *
     * The field says how wide the picture is right now and the curve says where
     * the dials put it; neither says what the RECORD is doing, and this stage
     * is the one whose behaviour depends on that. The side track is the effect
     * — it grows the moment a width dial moves — the mid track is the reference
     * it should be read against, and the correlation is why the guard is where
     * it is. Three tracks on one time axis, because comparing them is the whole
     * reason to draw any of them.
     */
    const paintHistory = (enabled: boolean) => {
      const canvas = historyRef.current;
      const context = canvas && fit(canvas);
      if (!canvas || !context) {
        return;
      }
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      context.clearRect(0, 0, width, height);

      const columns = HISTORY_COLUMNS;
      const xOf = (index: number) => (index / (columns - 1)) * width;

      // Zero correlation, which is where the guard begins to matter.
      context.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, height / 2 + 0.5);
      context.lineTo(width, height / 2 + 0.5);
      context.stroke();

      if (!enabled) {
        return;
      }

      // Side first and filled: it is the quantity this stage exists to move.
      context.beginPath();
      context.moveTo(0, height);
      for (let index = 0; index < columns; index += 1) {
        context.lineTo(
          xOf(index),
          height - sideHistory.current[index] * height,
        );
      }
      context.lineTo(width, height);
      context.closePath();
      context.fillStyle = 'rgba(150, 205, 255, 0.30)';
      context.fill();

      // Mid as a line above it, so the two are read as a ratio rather than as
      // two unrelated heights.
      context.beginPath();
      for (let index = 0; index < columns; index += 1) {
        const y = height - midHistory.current[index] * height;
        if (index === 0) {
          context.moveTo(xOf(index), y);
        } else {
          context.lineTo(xOf(index), y);
        }
      }
      context.strokeStyle = 'rgba(255, 255, 255, 0.34)';
      context.lineWidth = 1;
      context.stroke();

      // Correlation last, on its own scale: +1 at the top, -1 at the bottom.
      context.beginPath();
      for (let index = 0; index < columns; index += 1) {
        const y = height / 2 - (correlationHistory.current[index] * height) / 2;
        if (index === 0) {
          context.moveTo(xOf(index), y);
        } else {
          context.lineTo(xOf(index), y);
        }
      }
      context.strokeStyle = 'rgba(255, 176, 89, 0.85)';
      context.lineWidth = 1.5;
      context.stroke();
    };

    const paintCurve = (enabled: boolean, guard: number) => {
      const canvas = curveRef.current;
      const context = canvas && fit(canvas);
      if (!canvas || !context) {
        return;
      }
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      context.clearRect(0, 0, width, height);

      const settings = settingsRef.current;
      const rate = rateRef.current > 0 ? rateRef.current : 48_000;
      const xOf = (hz: number) =>
        (Math.log(hz / MIN_HZ) / Math.log(MAX_HZ / MIN_HZ)) * width;
      const yOf = (value: number) => height - (value / MAX_WIDTH) * height;
      const unityY = yOf(1);

      context.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      context.lineWidth = 1;
      GRID_HZ.forEach((hz) => {
        const x = Math.round(xOf(hz)) + 0.5;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      });

      // The unity line is the reading of this plot: above it the picture is
      // wider than the record already was, below it narrower.
      context.strokeStyle = 'rgba(255, 255, 255, 0.26)';
      context.setLineDash([4, 4]);
      context.beginPath();
      context.moveTo(0, unityY + 0.5);
      context.lineTo(width, unityY + 0.5);
      context.stroke();
      context.setLineDash([]);

      const guarded = (value: number) =>
        value > 1 ? 1 + (value - 1) * guard : value;
      const points: { x: number; y: number }[] = [];
      for (let column = 0; column <= COLUMNS; column += 1) {
        const hz = MIN_HZ * (MAX_HZ / MIN_HZ) ** (column / COLUMNS);
        const low = lowpassGain(hz, settings.lowHz, rate);
        const mid = lowpassGain(hz, settings.highHz, rate);
        const value = enabled
          ? guarded(settings.lowWidth) * low +
            guarded(settings.midWidth) * Math.max(0, mid - low) +
            guarded(settings.highWidth) * Math.max(0, 1 - mid)
          : 1;
        points.push({ x: xOf(hz), y: yOf(Math.min(MAX_WIDTH, value)) });
      }

      // Filled against unity, so the eye reads "wider here, narrower there"
      // without having to compare two heights.
      context.beginPath();
      context.moveTo(points[0].x, unityY);
      points.forEach((point) => context.lineTo(point.x, point.y));
      context.lineTo(points[points.length - 1].x, unityY);
      context.closePath();
      context.fillStyle = enabled
        ? 'rgba(120, 190, 255, 0.16)'
        : 'rgba(255, 255, 255, 0.05)';
      context.fill();

      context.beginPath();
      points.forEach((point, index) =>
        index === 0
          ? context.moveTo(point.x, point.y)
          : context.lineTo(point.x, point.y),
      );
      context.strokeStyle = enabled
        ? 'rgba(150, 205, 255, 0.92)'
        : 'rgba(255, 255, 255, 0.24)';
      context.lineWidth = 2;
      context.stroke();

      if (!enabled) {
        return;
      }
      // The corners, drawn where the filters actually cross. The same number as
      // the dial, but a marker placed from the setting would keep claiming to
      // be the corner if the crossover were ever retuned.
      context.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      context.lineWidth = 1;
      [settings.lowHz, settings.highHz].forEach((hz) => {
        const x = Math.round(xOf(hz)) + 0.5;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      });
    };

    const paint = ({ schedule }: IGraphLoopFrame) => {
      /**
       * Nothing is drawn until all three panes have a size.
       *
       * `fit` answers null for a canvas the document has not laid out yet and
       * each painter quietly returns, so without this the loop could stop
       * having drawn nothing at all — the card would come up blank and stay
       * blank until the engine started. Waiting on the document, so asked for
       * again whether or not anything is playing.
       */
      const panes = [fieldRef.current, curveRef.current, historyRef.current];
      if (panes.some((pane) => !pane?.clientWidth || !pane.clientHeight)) {
        schedule();
        return;
      }
      const { enabled } = settingsRef.current;
      const guard = enabled
        ? Math.max(0, Math.min(1, readDspDimensionGuard()))
        : 1;
      /**
       * Peaks accumulated every frame, committed on the sample clock.
       *
       * The strip has to scroll at a fixed rate or it tells a different story
       * on a 144 Hz panel than on a 60 Hz one — but the peaks between columns
       * still have to be seen, or a transient that fell between two commits is
       * simply missing from the picture.
       */
      const pairs = readDspScatter();
      for (let at = 0; at + 1 < pairs.length; at += 2) {
        const mid = Math.abs((pairs[at] + pairs[at + 1]) / 2);
        const side = Math.abs((pairs[at] - pairs[at + 1]) / 2);
        if (mid > pendingMid.current) {
          pendingMid.current = mid;
        }
        if (side > pendingSide.current) {
          pendingSide.current = side;
        }
      }
      const now = performance.now();
      if (now - lastSampleAt.current >= HISTORY_SAMPLE_MS) {
        lastSampleAt.current = now;
        midHistory.current.copyWithin(0, 1);
        sideHistory.current.copyWithin(0, 1);
        correlationHistory.current.copyWithin(0, 1);
        const last = HISTORY_COLUMNS - 1;
        midHistory.current[last] = Math.min(1, pendingMid.current);
        sideHistory.current[last] = Math.min(1, pendingSide.current);
        correlationHistory.current[last] = Math.max(
          -1,
          Math.min(1, readDspCorrelation()),
        );
        pendingMid.current = 0;
        pendingSide.current = 0;
      }

      paintField(enabled);
      paintCurve(enabled, guard);
      paintHistory(enabled);
    };

    const loop = startGraphLoop(paint, {
      /**
       * The strip empties when the engine lets go.
       *
       * A column is committed on the sample clock, so a loop that stops and
       * resumes later would splice two moments and draw eight unbroken
       * seconds across the join. Correlation goes back to 1 rather than 0 for
       * the reason the ring is built that way: silence has no correlation to
       * report, and a zero there reads as a warning about nothing.
       */
      onEngineGone: () => {
        midHistory.current.fill(0);
        sideHistory.current.fill(0);
        correlationHistory.current.fill(1);
        pendingMid.current = 0;
        pendingSide.current = 0;
        // Restarted, not zeroed. A zero here is a sample clock that elapsed
        // long ago, so the very next frame — the one drawing the emptied strip
        // — would commit a column from the readings that were current when the
        // engine stopped, and the strip would clear to a single stale mark.
        lastSampleAt.current = performance.now();
      },
    });
    redraw.current = loop.schedule;
    return () => {
      redraw.current = undefined;
      loop.stop();
    };
  }, []);

  // Repaint when anything drawn changes. The loop only turns while the engine
  // is publishing, so the width curve and the crossover reach the canvas
  // through here while nothing is playing.
  useEffect(() => {
    redraw.current?.();
  });

  return (
    <div className="dsp-dimension-graph">
      <canvas
        className="dsp-dimension-field"
        ref={fieldRef}
        aria-label={t('dsp.dimension.fieldLabel')}
      />
      <div className="dsp-dimension-curve">
        <canvas
          className="dsp-eq-graph dsp-dimension-canvas"
          ref={curveRef}
          aria-label={t('dsp.dimension.graphLabel')}
        />
        <canvas
          className="dsp-dimension-history"
          ref={historyRef}
          aria-label={t('dsp.dimension.historyLabel')}
        />
        <ul className="dsp-eq-legend dsp-dimension-legend">
          <li className="dsp-eq-legend-item">
            <span className="dsp-eq-legend-mark is-dashed" aria-hidden="true" />
            <span>{t('dsp.dimension.legendUnity')}</span>
          </li>
          <li className="dsp-eq-legend-item">
            <span className="dsp-eq-legend-mark is-filled" aria-hidden="true" />
            <span>{t('dsp.dimension.legendWidth')}</span>
          </li>
          <li className="dsp-eq-legend-item">
            <span
              className="dsp-eq-legend-mark is-correlation"
              aria-hidden="true"
            />
            <span>{t('dsp.dimension.legendCorrelation')}</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default DspDimensionGraph;
