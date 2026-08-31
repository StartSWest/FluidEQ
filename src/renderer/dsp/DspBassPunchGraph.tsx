/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { IBassPunchSettings } from '../../common/dsp/chain';
import { useTranslation } from '../utils/I18nContext';
import { readDspBassPunchActivity } from './store';

/**
 * The last three seconds of what Punch did, on a time axis.
 *
 * The Maximizer's picture, borrowed for the same reason it was drawn there:
 * this stage has no opinion about frequency either. It shapes WHEN the low end
 * arrives, so a spectrum behind it would be the picture the Exciter's, Forge's
 * and the EQ's pages already draw with nothing of this stage in it. The axis
 * that means something is time and the shape that means something is the
 * envelope of the gain being applied.
 *
 * Two lanes rather than one, because the three numbers are not measured on the
 * same audio. Attack and sustain are gains on the LOW band, signed around
 * unity; the duck is a gain on everything ABOVE the split. Stacking them on one
 * axis would invite reading a deep duck as the bass losing level, which is the
 * opposite of what the control does.
 *
 * Everything is read inside the frame loop from plain module values rather
 * than through React state. These are republished every analysis window, about
 * twenty-three times a second, and a state update per window is a repaint at a
 * rate no display can show and the reconciler cannot afford beside the panel.
 */

/** How much history the strip holds. Long enough to see a bloom decay out. */
const WINDOW_MS = 3_000;

/**
 * One column per analysis window, so the strip scrolls at the same speed on a
 * 60 Hz panel and a 144 Hz one.
 *
 * 43 ms and not the Maximizer's 33: `FEQ_METER_WINDOW` is 2048 samples, which
 * at 48 kHz publishes about every 42.7 ms. A shorter column would be narrower
 * than the thing it reports, so the same publication would be redrawn in two
 * adjacent columns and one transient would look like two.
 */
const SAMPLE_MS = 43;

const HISTORY = Math.ceil(WINDOW_MS / SAMPLE_MS) + 1;

/**
 * The low lane's half-range, from `kAttackCeilingDb` in `bass_punch.cpp`.
 *
 * The attack section's own ceiling, which is the largest figure either of the
 * two low-band gains can reach — sustain stops at 9. Drawing to the larger of
 * the two keeps both on one scale that never clips.
 */
const LOW_SPAN_DB = 12;

/** The duck lane's full deflection, from `kDuckMaxDb`. It only ever cuts. */
const DUCK_SPAN_DB = 6;

/** What is below anything worth drawing: a gain of this size is unity. */
const SILENT_DB = 0.05;

/**
 * Decay toward rest for the attack READOUT only.
 *
 * The excursion itself lasts a few milliseconds. Printed raw, the number is
 * unreadable — it is replaced before the eye reaches it. The strip beside it
 * is drawn from the samples themselves and is not smoothed.
 */
const RELEASE_PER_FRAME = 0.86;

const PAD_L = 38;
const PAD_R = 14;
/**
 * The legend and the status chips own two fixed rows above the plot, at the
 * heights the stylesheet puts them. Drawing under either one made the readings
 * look like they were labelling whatever passed behind them.
 */
const PAD_T = 64;
const PAD_B = 22;

/** How much of the plot the duck lane takes, and the gap that separates them. */
const DUCK_SHARE = 0.3;
const LANE_GAP = 14;

const LOW_GRID_DB = [12, 6, 0, -6, -12];
const DUCK_GRID_DB = [0, -3, -6];

/**
 * The same system stack every other graph in this rack paints with.
 *
 * Named in full rather than left to `sans-serif`: canvas has no cascade to
 * fall back through, and a generic family answers from fontconfig on Linux
 * with DejaVu Sans while the DOM beside it is drawing Ubuntu.
 */
const GRAPH_FONT =
  '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Ubuntu, Cantarell, "Noto Sans", "DejaVu Sans", sans-serif';

/** The rack's existing inks. Amber is the event, teal the state, blue the cut. */
const TRANSIENT_INK = '255, 176, 89';
const SUSTAIN_INK = '64, 214, 200';
const DUCK_INK = '84, 200, 255';

/**
 * The larger of two signed gains, by magnitude.
 *
 * The same fold `fold_by_magnitude` does on the native side, and for the same
 * reason: attack is bipolar, so a plain maximum would keep +0.1 dB over the
 * -7 dB softening that is the whole reason somebody turned the dial left.
 */
const louder = (first: number, second: number): number =>
  Math.abs(second) > Math.abs(first) ? second : first;

/** A signed reading, or an em dash where the stage is not running. */
const readout = (db: number, running: boolean): string => {
  if (!running) {
    return '—';
  }
  return Math.abs(db) < SILENT_DB
    ? '0.0 dB'
    : `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
};

interface IDspBassPunchGraphProps {
  bassPunch: IBassPunchSettings;
}

const DspBassPunchGraph = ({ bassPunch }: IDspBassPunchGraphProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const transientRef = useRef<HTMLSpanElement | null>(null);
  const sustainRef = useRef<HTMLSpanElement | null>(null);
  const duckRef = useRef<HTMLSpanElement | null>(null);
  /**
   * The strip, oldest first, written as a ring so scrolling costs one index.
   *
   * Parallel arrays rather than one array of objects: this is rewritten
   * twenty-three times a second and read in full on every frame, and the four
   * are always written together. `live` is what the column was measured
   * against — a column written while the stage was bypassed carries no
   * reading, and drawing it as 0 dB would say the stage was running and
   * choosing to do nothing, which is exactly what a centred dial means and
   * therefore the one thing an off stage must not appear to be doing.
   */
  const transients = useRef(new Float32Array(HISTORY));
  const sustains = useRef(new Float32Array(HISTORY));
  const ducks = useRef(new Float32Array(HISTORY));
  const live = useRef(new Uint8Array(HISTORY));
  const writeAt = useRef(0);
  const pendingTransient = useRef(0);
  const sampledAt = useRef(0);
  const heldTransient = useRef(0);

  const { enabled } = bassPunch;

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
      const { transientDb, sustainDb, duckDb } = readDspBassPunchActivity();

      /**
       * The two sampling semantics, kept apart here as well as in the drawing.
       *
       * `transientDb` is a max-over-window that the native reader CLEARS as it
       * takes it, because the excursion lasts a few milliseconds while frames
       * drain about every 43 ms; sampled as a point value it read 0.0 dB in 70
       * of 70 frames through the real host. So it is folded by magnitude
       * across every frame that lands inside a column.
       *
       * `sustainDb` and `duckDb` are states that persist across several
       * windows — sustain spans three or four, the duck stays engaged about
       * 90 ms — so the latest value at the column boundary IS the column's
       * value. Folding them by magnitude too would draw an envelope of their
       * peaks rather than the shape they actually had.
       */
      pendingTransient.current = enabled
        ? louder(pendingTransient.current, transientDb)
        : 0;
      if (now - sampledAt.current >= SAMPLE_MS) {
        const at = writeAt.current;
        transients.current[at] = pendingTransient.current;
        sustains.current[at] = enabled ? sustainDb : 0;
        ducks.current[at] = enabled ? duckDb : 0;
        live.current[at] = enabled ? 1 : 0;
        writeAt.current = (at + 1) % HISTORY;
        pendingTransient.current = enabled ? transientDb : 0;
        sampledAt.current = now;
      }

      heldTransient.current =
        Math.abs(transientDb) > Math.abs(heldTransient.current)
          ? transientDb
          : heldTransient.current * RELEASE_PER_FRAME;

      if (transientRef.current) {
        transientRef.current.textContent = readout(
          heldTransient.current,
          enabled,
        );
      }
      if (sustainRef.current) {
        sustainRef.current.textContent = readout(sustainDb, enabled);
      }
      if (duckRef.current) {
        duckRef.current.textContent = readout(duckDb, enabled);
      }

      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      const pixelWidth = Math.round(width * ratio);
      const pixelHeight = Math.round(height * ratio);
      // Only when it changed: assigning width clears the canvas, so doing it
      // every frame is a free repaint of everything drawn below.
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const plotWidth = Math.max(1, width - PAD_L - PAD_R);
      const plotHeight = Math.max(1, height - PAD_T - PAD_B);
      const lanes = Math.max(1, plotHeight - LANE_GAP);
      const duckHeight = lanes * DUCK_SHARE;
      const lowHeight = lanes - duckHeight;
      const lowCentreY = PAD_T + lowHeight / 2;
      const duckTopY = PAD_T + lowHeight + LANE_GAP;
      const lowY = (db: number): number =>
        lowCentreY -
        (Math.max(-LOW_SPAN_DB, Math.min(LOW_SPAN_DB, db)) / LOW_SPAN_DB) *
          (lowHeight / 2);
      const duckY = (db: number): number =>
        duckTopY +
        (Math.min(DUCK_SPAN_DB, Math.abs(db)) / DUCK_SPAN_DB) * duckHeight;
      const columnX = (index: number): number =>
        PAD_L + (index / (HISTORY - 1)) * plotWidth;
      /** Ring index to display order, oldest at the left edge. */
      const sampleAt = (index: number): number =>
        (writeAt.current + index) % HISTORY;

      context.font = GRAPH_FONT;
      context.textBaseline = 'middle';
      context.lineWidth = 1;

      /* -------------------------------------------------------- the grid */
      context.textAlign = 'right';
      LOW_GRID_DB.forEach((db) => {
        const line = Math.round(lowY(db)) + 0.5;
        context.strokeStyle =
          db === 0 ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)';
        context.beginPath();
        context.moveTo(PAD_L, line);
        context.lineTo(width - PAD_R, line);
        context.stroke();
        context.fillStyle = 'rgba(255,255,255,0.36)';
        context.fillText(db > 0 ? `+${db}` : `${db}`, PAD_L - 6, line);
      });
      DUCK_GRID_DB.forEach((db) => {
        const line = Math.round(duckY(db)) + 0.5;
        context.strokeStyle =
          db === 0 ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)';
        context.beginPath();
        context.moveTo(PAD_L, line);
        context.lineTo(width - PAD_R, line);
        context.stroke();
        context.fillStyle = 'rgba(255,255,255,0.36)';
        context.fillText(`${db}`, PAD_L - 6, line);
      });

      // Time runs left to right and the newest column is the right edge, so
      // "now" is where the eye already is when a hit arrives.
      context.textAlign = 'center';
      for (let second = WINDOW_MS / 1_000 - 1; second >= 1; second -= 1) {
        const x = PAD_L + plotWidth * (1 - (second * 1_000) / WINDOW_MS);
        const line = Math.round(x) + 0.5;
        context.strokeStyle = 'rgba(255,255,255,0.05)';
        context.beginPath();
        context.moveTo(line, PAD_T);
        context.lineTo(line, height - PAD_B);
        context.stroke();
        context.fillStyle = 'rgba(255,255,255,0.3)';
        context.fillText(`-${second}s`, x, height - PAD_B / 2);
      }
      // Right-aligned rather than centred on the last column: this margin is
      // 14px, not the 62 the Maximizer keeps for its meter, so a centred label
      // would hang half its width off the end of the canvas.
      context.textAlign = 'right';
      context.fillStyle = 'rgba(255,255,255,0.3)';
      context.fillText(
        t('dsp.bassPunch.graph.now'),
        width - PAD_R + 6,
        height - PAD_B / 2,
      );

      /* ------------------------------------------------- the two states */
      /**
       * Runs of consecutive measured columns, so a continuous trace is only
       * ever drawn across time the stage was actually running. Without this
       * the line would jump the gap left by a bypass and claim a reading for
       * seconds nothing was measured.
       */
      const runs: [number, number][] = [];
      for (let index = 0; index < HISTORY; index += 1) {
        if (live.current[sampleAt(index)] === 1) {
          const open = runs[runs.length - 1];
          if (open && open[1] === index - 1) {
            open[1] = index;
          } else {
            runs.push([index, index]);
          }
        }
      }

      const trace = (
        ink: string,
        baseline: number,
        valueY: (index: number) => number,
      ) => {
        runs.forEach(([from, to]) => {
          context.beginPath();
          context.moveTo(columnX(from), baseline);
          for (let index = from; index <= to; index += 1) {
            context.lineTo(columnX(index), valueY(index));
          }
          context.lineTo(columnX(to), baseline);
          context.closePath();
          context.fillStyle = `rgba(${ink},0.2)`;
          context.fill();

          context.beginPath();
          for (let index = from; index <= to; index += 1) {
            context.lineTo(columnX(index), valueY(index));
          }
          context.strokeStyle = `rgba(${ink},0.85)`;
          context.lineWidth = 1.6;
          context.stroke();
        });
      };

      trace(DUCK_INK, duckTopY, (index) =>
        duckY(ducks.current[sampleAt(index)]),
      );
      trace(SUSTAIN_INK, lowCentreY, (index) =>
        lowY(sustains.current[sampleAt(index)]),
      );

      // Over the traces rather than under them: unity is the line every one of
      // these three numbers is read against, and a filled area that covered it
      // would take away the thing being compared to.
      context.strokeStyle = 'rgba(255,255,255,0.22)';
      context.lineWidth = 1;
      [lowCentreY, duckTopY].forEach((y) => {
        const line = Math.round(y) + 0.5;
        context.beginPath();
        context.moveTo(PAD_L, line);
        context.lineTo(width - PAD_R, line);
        context.stroke();
      });

      /* ------------------------------------------------- the transients */
      /**
       * Separate marks, and deliberately not a line.
       *
       * Each is the largest excursion inside its own window and there is no
       * value BETWEEN two of them to draw — the reader clears the slot as it
       * takes it. Joining them would invent one, and would draw the same kind
       * of shape as the two traces above, which are states that genuinely do
       * persist between samples.
       */
      const stemWidth = Math.max(2, (plotWidth / (HISTORY - 1)) * 0.45);
      runs.forEach(([from, to]) => {
        for (let index = from; index <= to; index += 1) {
          const db = transients.current[sampleAt(index)];
          // A window in which the attack section applied unity has no mark.
          // Drawing one would put a floor of ticks under a stage that is
          // running and leaving the transient exactly as it arrived.
          if (Math.abs(db) >= SILENT_DB) {
            const top = lowY(db);
            const x = columnX(index) - stemWidth / 2;
            context.fillStyle = `rgba(${TRANSIENT_INK},0.55)`;
            context.fillRect(
              x,
              Math.min(top, lowCentreY),
              stemWidth,
              Math.abs(lowCentreY - top),
            );
            context.fillStyle = `rgba(${TRANSIENT_INK},0.95)`;
            context.fillRect(x, Math.round(top) - 1, stemWidth, 2);
          }
        }
      });

      frame = requestAnimationFrame(paint);
    };

    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [enabled, t]);

  return (
    <div
      className={`dsp-eq-plot dsp-bass-punch-display${
        enabled ? '' : ' is-off'
      }`}
    >
      <canvas
        ref={canvasRef}
        className="dsp-eq-graph dsp-bass-punch-canvas"
        // A continuously moving restatement of the dials below. Naming it
        // would put three numbers that change twenty-three times a second into
        // the accessibility tree.
        aria-hidden="true"
      />
      {/* Live numbers as text rather than as canvas glyphs: these are the
          readings somebody quotes when they report what the stage did, and
          text can be selected, translated and read aloud. */}
      <div className="dsp-master-status dsp-bass-punch-status" aria-live="off">
        <span className="is-attack">
          {t('dsp.bassPunch.attack')}
          <b ref={transientRef}>—</b>
        </span>
        <span className="is-sustain">
          {t('dsp.bassPunch.sustain')}
          <b ref={sustainRef}>—</b>
        </span>
        <span className="is-duck">
          {t('dsp.bassPunch.duck')}
          <b ref={duckRef}>—</b>
        </span>
      </div>
      <ul className="dsp-eq-legend dsp-master-legend">
        {/* Dashed, because the mark it names is: the attack lane is a row of
            separate marks and the swatch has to say so before the eye reaches
            the plot. */}
        <li className="dsp-eq-legend-item">
          <span
            className="dsp-eq-legend-mark is-dashed"
            style={{ color: `rgb(${TRANSIENT_INK})` }}
          />
          {t('dsp.bassPunch.attack')}
          <span className="dsp-eq-legend-scale">
            {t('dsp.bassPunch.graph.perWindow')}
          </span>
        </li>
        <li className="dsp-eq-legend-item">
          <span
            className="dsp-eq-legend-mark is-filled"
            style={{ color: `rgba(${SUSTAIN_INK},0.7)` }}
          />
          {t('dsp.bassPunch.sustain')}
          <span className="dsp-eq-legend-scale">
            {t('dsp.bassPunch.graph.sampled')}
          </span>
        </li>
        <li className="dsp-eq-legend-item">
          <span
            className="dsp-eq-legend-mark is-filled"
            style={{ color: `rgba(${DUCK_INK},0.7)` }}
          />
          {t('dsp.bassPunch.duck')}
          <span className="dsp-eq-legend-scale">
            {t('dsp.bassPunch.graph.sampled')}
          </span>
        </li>
      </ul>
    </div>
  );
};

export default DspBassPunchGraph;
