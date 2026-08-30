/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { IMaximizerSettings } from '../../common/dsp/chain';
import { useTranslation } from '../utils/I18nContext';
import { readDspMaximizerReduction, readDspPeak } from './store';

/**
 * What the Maximizer did to the last six seconds of the record.
 *
 * Deliberately NOT the frequency plot the EQ, Exciter and Master pages draw.
 * A limiter has no frequency axis to have an opinion about — it treats 40 Hz
 * and 12 kHz identically and acts on the level of the moment — so a spectrum
 * behind this stage would be the same picture the two pages either side of it
 * already draw, with nothing of this stage in it.
 *
 * The axis that means something here is TIME, and the shape that means
 * something is the envelope: a wave that grows until it meets the ceiling and
 * then goes flat along the top is exactly what maximizing looks like and what
 * it sounds like. The amber band above the ceiling is the part that was held
 * down — drawn from the same reading the meter reports, so the picture cannot
 * disagree with the number beside it.
 *
 * Everything here is read inside the frame loop from plain module values
 * rather than through React state. The reduction changes every audio block; a
 * state update per block is a repaint at a rate no display can show and the
 * reconciler cannot afford.
 */

/** How much history the strip holds. Long enough to see a release recover. */
const WINDOW_MS = 6_000;

/**
 * One column per this many milliseconds, so the strip scrolls at the same
 * speed on a 60 Hz panel and a 144 Hz one. Between columns the loop keeps the
 * PEAK of everything it saw: a limiter display that averages its samples is a
 * display that misses the transient the limiter exists for.
 */
const SAMPLE_MS = 33;

const HISTORY = Math.ceil(WINDOW_MS / SAMPLE_MS) + 1;

/** The envelope's floor. Below this the wave is a line at the axis. */
const FLOOR_DB = -30;

/**
 * Headroom above full scale, and the reason this display works at all.
 *
 * The scale used to stop at 0 dBFS, which is where a ceiling of −1 dB sits two
 * percent from the top of the plot — leaving the band between the ceiling and
 * the peak that was held down nowhere to be drawn. What the limiter caught is
 * ABOVE full scale by definition: it is the level the signal would have
 * reached, and it is the whole subject of this picture.
 */
const TOP_DB = 6;

/** Full deflection of the reduction meter, matching the old bar's scale. */
const GR_FULL_SCALE_DB = 12;

/** Decay toward rest, so a short reduction stays visible long enough to read. */
const RELEASE_PER_FRAME = 0.82;

/** The peak-hold tick falls this far per frame once it starts moving. */
const PEAK_HOLD_FALL_DB = 0.035;

const PAD_L = 38;
/** Room for the reduction meter and its scale, which live in this margin. */
const PAD_R = 62;
/**
 * The legend and the status chips own two fixed rows above the plot, at the
 * heights the stylesheet puts them. Drawing the wave under either one made the
 * readings look like they were labelling whatever passed behind them.
 */
const PAD_T = 64;
const PAD_B = 22;

const GRID_DB = [0, -6, -12, -24];
const GR_TICKS_DB = [0, 3, 6, 12];

const GRAPH_FONT =
  '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Ubuntu, Cantarell, "Noto Sans", "DejaVu Sans", sans-serif';

const OUTPUT_INK = '64, 214, 200';
const HELD_INK = '255, 176, 89';
const IDLE_INK = '255, 255, 255';

const amplitudeDb = (value: number): number =>
  value > 1e-6 ? 20 * Math.log10(value) : -120;

interface IDspMaximizerGraphProps {
  maximizer: IMaximizerSettings;
}

const DspMaximizerGraph = ({ maximizer }: IDspMaximizerGraphProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reductionRef = useRef<HTMLSpanElement | null>(null);
  const holdRef = useRef<HTMLSpanElement | null>(null);
  const outputRef = useRef<HTMLSpanElement | null>(null);
  /**
   * The strip, oldest first, written as a ring so scrolling costs one index.
   *
   * Two parallel arrays rather than one array of objects: this is rewritten
   * thirty times a second and read in full on every frame, and the pair are
   * always written together.
   */
  const levels = useRef(new Float32Array(HISTORY).fill(-120));
  const depths = useRef(new Float32Array(HISTORY));
  const writeAt = useRef(0);
  const pendingLevel = useRef(-120);
  const pendingDepth = useRef(0);
  const sampledAt = useRef(0);
  const heldDepth = useRef(0);
  const peakHold = useRef(0);

  const { ceilingDb, enabled } = maximizer;

  useEffect(() => {
    let frame = 0;
    const paint = () => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) {
        frame = requestAnimationFrame(paint);
        return;
      }

      const now = performance.now();
      const levelDb = amplitudeDb(readDspPeak());
      // The published figure is the deepest sample of its block and is never
      // positive; everything here works in the magnitude of it.
      const depthDb = enabled ? Math.abs(readDspMaximizerReduction()) : 0;
      pendingLevel.current = Math.max(pendingLevel.current, levelDb);
      pendingDepth.current = Math.max(pendingDepth.current, depthDb);
      if (now - sampledAt.current >= SAMPLE_MS) {
        levels.current[writeAt.current] = pendingLevel.current;
        depths.current[writeAt.current] = pendingDepth.current;
        writeAt.current = (writeAt.current + 1) % HISTORY;
        pendingLevel.current = levelDb;
        pendingDepth.current = depthDb;
        sampledAt.current = now;
      }

      heldDepth.current =
        depthDb > heldDepth.current
          ? depthDb
          : heldDepth.current * RELEASE_PER_FRAME +
            depthDb * (1 - RELEASE_PER_FRAME);
      peakHold.current =
        heldDepth.current > peakHold.current
          ? heldDepth.current
          : Math.max(heldDepth.current, peakHold.current - PEAK_HOLD_FALL_DB);

      if (reductionRef.current) {
        reductionRef.current.textContent =
          heldDepth.current < 0.05
            ? '0.0 dB'
            : `-${heldDepth.current.toFixed(1)} dB`;
      }
      if (holdRef.current) {
        holdRef.current.textContent =
          peakHold.current < 0.05
            ? '0.0 dB'
            : `-${peakHold.current.toFixed(1)} dB`;
      }
      if (outputRef.current) {
        outputRef.current.textContent =
          levelDb <= -119.5 ? '—' : `${levelDb.toFixed(1)} dBFS`;
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

      const plotWidth = Math.max(1, width - PAD_L - PAD_R);
      const plotHeight = Math.max(1, height - PAD_T - PAD_B);
      const centreY = PAD_T + plotHeight / 2;
      const halfHeight = plotHeight / 2 - 2;
      /** Level in dB to a half-height, which is what mirrors into a wave. */
      const reach = (db: number): number =>
        ((Math.max(FLOOR_DB, Math.min(TOP_DB, db)) - FLOOR_DB) /
          (TOP_DB - FLOOR_DB)) *
        halfHeight;
      const columnX = (index: number): number =>
        PAD_L + (index / (HISTORY - 1)) * plotWidth;

      context.font = GRAPH_FONT;
      context.textBaseline = 'middle';

      GRID_DB.forEach((db) => {
        const offset = reach(db);
        [centreY - offset, centreY + offset].forEach((y, half) => {
          const line = Math.round(y) + 0.5;
          context.strokeStyle =
            db === 0 ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)';
          context.beginPath();
          context.moveTo(PAD_L, line);
          context.lineTo(width - PAD_R, line);
          context.stroke();
          if (half === 0) {
            context.fillStyle = 'rgba(255,255,255,0.38)';
            context.textAlign = 'right';
            context.fillText(`${db}`, PAD_L - 6, line);
          }
        });
      });

      // Time runs left to right and the newest column is the right edge, so
      // "now" is where the eye already is when a peak arrives.
      context.textAlign = 'center';
      context.fillStyle = 'rgba(255,255,255,0.3)';
      for (let second = WINDOW_MS / 1_000; second >= 1; second -= 1) {
        const x = PAD_L + plotWidth * (1 - (second * 1_000) / WINDOW_MS);
        const line = Math.round(x) + 0.5;
        context.strokeStyle = 'rgba(255,255,255,0.05)';
        context.beginPath();
        context.moveTo(line, PAD_T);
        context.lineTo(line, height - PAD_B);
        context.stroke();
        context.fillText(`-${second}s`, x, height - PAD_B / 2);
      }
      context.fillText(
        t('dsp.maximizer.graph.now'),
        width - PAD_R,
        height - PAD_B / 2,
      );

      const ceilingReach = reach(ceilingDb);

      /**
       * What was held down, between the ceiling and where the peak would have
       * landed without the limiter.
       *
       * The would-be level is the output plus the reduction that was applied
       * to reach it, which is the one honest way to draw the input of a stage
       * whose input is never metered on its own.
       */
      if (enabled) {
        context.beginPath();
        for (let index = 0; index < HISTORY; index += 1) {
          const at = (writeAt.current + index) % HISTORY;
          const wouldBe = reach(levels.current[at] + depths.current[at]);
          context.lineTo(columnX(index), centreY - wouldBe);
        }
        for (let index = HISTORY - 1; index >= 0; index -= 1) {
          const at = (writeAt.current + index) % HISTORY;
          const wouldBe = reach(levels.current[at] + depths.current[at]);
          context.lineTo(
            columnX(index),
            centreY - Math.min(wouldBe, ceilingReach),
          );
        }
        context.closePath();
        context.fillStyle = `rgba(${HELD_INK},0.22)`;
        context.fill();
        context.strokeStyle = `rgba(${HELD_INK},0.5)`;
        context.lineWidth = 1;
        context.stroke();

        context.beginPath();
        for (let index = 0; index < HISTORY; index += 1) {
          const at = (writeAt.current + index) % HISTORY;
          const wouldBe = reach(levels.current[at] + depths.current[at]);
          context.lineTo(columnX(index), centreY + wouldBe);
        }
        for (let index = HISTORY - 1; index >= 0; index -= 1) {
          const at = (writeAt.current + index) % HISTORY;
          const wouldBe = reach(levels.current[at] + depths.current[at]);
          context.lineTo(
            columnX(index),
            centreY + Math.min(wouldBe, ceilingReach),
          );
        }
        context.closePath();
        context.fillStyle = `rgba(${HELD_INK},0.22)`;
        context.fill();
        context.strokeStyle = `rgba(${HELD_INK},0.5)`;
        context.stroke();
      }

      // The wave itself, mirrored about the axis. One path for both halves:
      // out along the top and back along the bottom.
      const ink = enabled ? OUTPUT_INK : IDLE_INK;
      context.beginPath();
      for (let index = 0; index < HISTORY; index += 1) {
        const at = (writeAt.current + index) % HISTORY;
        context.lineTo(columnX(index), centreY - reach(levels.current[at]));
      }
      for (let index = HISTORY - 1; index >= 0; index -= 1) {
        const at = (writeAt.current + index) % HISTORY;
        context.lineTo(columnX(index), centreY + reach(levels.current[at]));
      }
      context.closePath();
      const body = context.createLinearGradient(
        0,
        PAD_T,
        0,
        PAD_T + plotHeight,
      );
      body.addColorStop(0, `rgba(${ink},${enabled ? 0.3 : 0.14})`);
      body.addColorStop(0.5, `rgba(${ink},${enabled ? 0.16 : 0.08})`);
      body.addColorStop(1, `rgba(${ink},${enabled ? 0.3 : 0.14})`);
      context.fillStyle = body;
      context.fill();
      context.strokeStyle = `rgba(${ink},${enabled ? 0.9 : 0.34})`;
      context.lineWidth = 1.4;
      context.stroke();

      // The ceiling last of the plot layers, because it is the line every
      // other layer is drawn to be read against.
      context.save();
      context.setLineDash([4, 5]);
      context.strokeStyle = enabled
        ? `rgba(${HELD_INK},0.86)`
        : 'rgba(255,255,255,0.24)';
      context.lineWidth = 1.4;
      [centreY - ceilingReach, centreY + ceilingReach].forEach((y) => {
        context.beginPath();
        context.moveTo(PAD_L, y);
        context.lineTo(width - PAD_R, y);
        context.stroke();
      });
      context.restore();
      context.textAlign = 'left';
      context.fillStyle = enabled
        ? `rgba(${HELD_INK},0.9)`
        : 'rgba(255,255,255,0.32)';
      // Under its own line rather than over it: the ceiling sits high in the
      // plot by design, and a label above it would be printed on the status
      // chips or clipped away entirely.
      context.fillText(
        `${ceilingDb.toFixed(1)} dBTP`,
        PAD_L + 6,
        centreY - ceilingReach + 10,
      );

      /**
       * The reduction meter, in the margin and hanging from the top.
       *
       * A depth, not a level: it grows downward from zero because what it
       * measures is how far the limiter is pulling the signal down. Drawn as
       * part of the same canvas so it shares the plot's own vertical space and
       * cannot drift out of step with the amber band beside it.
       */
      const meterX = width - PAD_R + 14;
      const meterWidth = 16;
      context.fillStyle = 'rgba(255,255,255,0.06)';
      context.fillRect(meterX, PAD_T, meterWidth, plotHeight);
      const depthHeight =
        Math.min(1, heldDepth.current / GR_FULL_SCALE_DB) * plotHeight;
      if (depthHeight > 0.5) {
        const meterInk = context.createLinearGradient(
          0,
          PAD_T,
          0,
          PAD_T + plotHeight,
        );
        meterInk.addColorStop(0, `rgba(${OUTPUT_INK},0.85)`);
        meterInk.addColorStop(1, `rgba(${HELD_INK},0.95)`);
        context.fillStyle = meterInk;
        context.fillRect(meterX, PAD_T, meterWidth, depthHeight);
      }
      if (peakHold.current > 0.05) {
        const holdY =
          PAD_T + Math.min(1, peakHold.current / GR_FULL_SCALE_DB) * plotHeight;
        context.fillStyle = `rgba(${HELD_INK},0.95)`;
        context.fillRect(meterX, Math.round(holdY), meterWidth, 2);
      }
      context.textAlign = 'left';
      context.fillStyle = 'rgba(255,255,255,0.32)';
      GR_TICKS_DB.forEach((db) => {
        const y = PAD_T + (db / GR_FULL_SCALE_DB) * plotHeight;
        context.fillText(db === 0 ? '0' : `-${db}`, meterX + meterWidth + 5, y);
      });

      frame = requestAnimationFrame(paint);
    };

    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [ceilingDb, enabled, t]);

  return (
    <div className="dsp-eq-plot dsp-maximizer-display">
      <canvas
        ref={canvasRef}
        className="dsp-eq-graph dsp-maximizer-canvas"
        aria-hidden="true"
      />
      {/* Live numbers as text rather than as canvas glyphs: these are the
          readings somebody quotes when they report what the stage did, and
          text can be selected, translated and read aloud. */}
      <div className="dsp-master-status dsp-maximizer-status" aria-live="off">
        <span className={enabled ? 'is-fixed' : 'is-warning'}>
          {t('dsp.maximizer.reduction')}
          <b ref={reductionRef}>0.0 dB</b>
        </span>
        <span className="is-safe">
          {t('dsp.maximizer.graph.peakHold')}
          <b ref={holdRef}>0.0 dB</b>
        </span>
        <span className="is-safe">
          {t('dsp.maximizer.graph.output')}
          <b ref={outputRef}>—</b>
        </span>
        <span className="is-safe">
          {t('dsp.maximizer.drive')}
          <b>{`+${maximizer.driveDb.toFixed(1)} dB`}</b>
        </span>
      </div>
      <ul className="dsp-eq-legend dsp-master-legend">
        <li className="dsp-eq-legend-item">
          <span
            className="dsp-eq-legend-mark is-filled"
            style={{ color: `rgba(${OUTPUT_INK},0.6)` }}
          />
          {t('dsp.maximizer.graph.output')}
          <span className="dsp-eq-legend-scale">dBFS</span>
        </li>
        <li className="dsp-eq-legend-item">
          <span
            className="dsp-eq-legend-mark is-filled"
            style={{ color: `rgba(${HELD_INK},0.6)` }}
          />
          {t('dsp.maximizer.graph.held')}
        </li>
        <li className="dsp-eq-legend-item">
          <span
            className="dsp-eq-legend-mark is-dashed"
            style={{ color: `rgb(${HELD_INK})` }}
          />
          {t('dsp.maximizer.ceiling')}
          <span className="dsp-eq-legend-scale">dBTP</span>
        </li>
      </ul>
    </div>
  );
};

export default DspMaximizerGraph;
