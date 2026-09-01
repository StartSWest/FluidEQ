/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { ANALYSIS_BASS_FORGE_BANDS } from '../../common/dsp/analysisWire';
import { IBassForgeSettings } from '../../common/dsp/chain';
import { useTranslation } from '../utils/I18nContext';
import { readDspBassForgeBands } from './store';
import { IGraphLoopFrame, startGraphLoop } from './graphLoop';

/**
 * The low band going in, the low band coming out, and the difference.
 *
 * Zoomed to 20 Hz - 1 kHz and nothing else, which is the whole reason this
 * plot exists. A full-range spectrum behind this stage would be the same
 * picture the Exciter's page and the EQ's page already draw, with nothing of
 * this stage in it: what Forge does happens inside a band that occupies about
 * an eighth of a 20 Hz - 20 kHz log axis, and at that width the two curves
 * this graph is FOR sit on top of each other.
 *
 * The generated content is the filled area BETWEEN the two runs, in two hues
 * split at the corner. The two hues divide it BY FREQUENCY, not by generator,
 * and the labels say so: this graph cannot attribute a band to the divider or
 * to the harmonics, because it is not told. `bass_forge.cpp` computes
 * `sub * sub_amount + shaped` into one number and then sends that through
 * drive, the DC blocker and `mix` before the output followers ever see it, so
 * by the time anything is metered the two generators are one signal and their
 * origin is gone.
 *
 * The corner is still the line worth drawing, for two reasons that survive
 * that. It is where the USER put `splitHz`, so it is the boundary they are
 * actually steering. And with the divider up, energy below it is
 * overwhelmingly the divider's: the divider's whole output is an octave below
 * a band that already stops at the corner.
 *
 * What that does NOT hold for is a very low fundamental. The presence
 * generator is fed the whole low band, so the second harmonic of a 35 Hz note
 * lands near 70 Hz — under a default 90 Hz corner, on the low side of this
 * plot, with `subAmount` possibly at zero. Colour there is honestly "energy
 * below the split", which is what the legend now claims and all it claims.
 *
 * Only the positive difference is filled. Where the forged run sits BELOW the
 * dry one the two paths coincide and the area collapses to nothing, because
 * colouring a loss the same way as a gain would be the picture lying about
 * which direction the stage moved.
 *
 * Everything is read inside the frame loop from plain module values rather
 * than through React state. Both runs are republished every analysis window,
 * about twenty-three times a second; a state update per window is a reconcile
 * for sixteen numbers no component renders.
 */

/**
 * The meter's own range, from `kMeterLowHz`/`kMeterHighHz` in `bass_forge.cpp`.
 *
 * Not a display choice: the eight followers are log-spaced across exactly this
 * span, so band `i` lands at `i / 7` of the plot width and the curve can be
 * interpolated by index instead of by frequency.
 */
const MIN_HZ = 20;
const MAX_HZ = 1_000;

const BANDS = ANALYSIS_BASS_FORGE_BANDS;

/**
 * The vertical range. The publisher's floor is -120 dB, which as a plot floor
 * would spend two thirds of the height on levels no low band ever reaches;
 * -72 puts a quiet passage near the bottom and a loud one near the top.
 */
const FLOOR_DB = -72;
const TOP_DB = 0;

const PAD_L = 34;
const PAD_R = 12;
/** Clear of the legend, which is absolutely positioned over the plot's top. */
const PAD_T = 34;
const PAD_B = 20;

const GRID_DB = [0, -12, -24, -36, -48, -60];

const GRID_HZ: [number, string][] = [
  [20, '20'],
  [30, '30'],
  [50, '50'],
  [100, '100'],
  [200, '200'],
  [500, '500'],
  [1_000, '1k'],
];

/**
 * The same system stack every other graph in this rack paints with.
 *
 * Named in full rather than left to `sans-serif`: canvas has no cascade to
 * fall back through, and a generic family answers from fontconfig on Linux
 * with DejaVu Sans while the DOM beside it is drawing Ubuntu.
 */
const GRAPH_FONT =
  '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Ubuntu, Cantarell, "Noto Sans", "DejaVu Sans", sans-serif';

/**
 * The rack's existing inks, borrowed from the Exciter's low band and its
 * organic stage. Named for the SIDE of the corner each one paints and not for
 * a generator: the meter cannot tell the two generators apart. See the header.
 */
const LOW_SIDE_INK = '84, 200, 255';
const HIGH_SIDE_INK = '255, 176, 89';
const OUTPUT_INK = '64, 214, 200';
const DRY_INK = '255, 255, 255';

/** Smoothstep, so eight measured points read as a curve and not as a chain. */
const ease = (t: number): number => t * t * (3 - 2 * t);

/**
 * The run's value at a fractional band index, in dB.
 *
 * Interpolating the INDEX rather than the frequency is exact here and not an
 * approximation: the followers are geometrically spaced across the plot's own
 * end points, so equal steps in index are equal steps in x.
 */
const sampleRun = (run: readonly number[], at: number): number => {
  const low = Math.max(0, Math.min(BANDS - 1, Math.floor(at)));
  const high = Math.max(0, Math.min(BANDS - 1, low + 1));
  const first = run[low] ?? FLOOR_DB;
  const second = run[high] ?? FLOOR_DB;
  return first + (second - first) * ease(at - low);
};

interface IDspBassForgeGraphProps {
  bassForge: IBassForgeSettings;
}

const DspBassForgeGraph = ({ bassForge }: IDspBassForgeGraphProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  /**
   * The live settings, read by the loop rather than closed over.
   *
   * Keeps `splitHz` following a drag at the frame rate without tearing the
   * animation down and rebuilding it on every step of that drag.
   */
  const settingsRef = useRef(bassForge);
  settingsRef.current = bassForge;
  /**
   * The two runs resampled to one value per pixel column, reused frame to
   * frame. Allocating them inside the loop is twelve hundred numbers a frame
   * handed straight to the collector for no gain.
   */
  const dryRef = useRef(new Float32Array(0));
  const forgedRef = useRef(new Float32Array(0));
  /** The running loop's way in, for a render that has to reach the canvas. */
  const redraw = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    const paint = ({ schedule }: IGraphLoopFrame) => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) {
        // Waiting on the document rather than on the engine, so asked for
        // again whether or not anything is playing.
        schedule();
        return;
      }

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) {
        schedule();
        return;
      }
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      const backingW = Math.round(width * ratio);
      const backingH = Math.round(height * ratio);
      // Only when it changed: assigning width clears the canvas, so doing it
      // every frame is a free repaint of everything drawn below.
      if (canvas.width !== backingW || canvas.height !== backingH) {
        canvas.width = backingW;
        canvas.height = backingH;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const plotW = Math.max(1, width - PAD_L - PAD_R);
      const plotH = Math.max(1, height - PAD_T - PAD_B);
      const floorY = PAD_T + plotH;
      const toX = (hz: number) =>
        PAD_L +
        (Math.log10(Math.min(MAX_HZ, Math.max(MIN_HZ, hz)) / MIN_HZ) /
          Math.log10(MAX_HZ / MIN_HZ)) *
          plotW;
      const toY = (db: number) =>
        floorY -
        ((Math.max(FLOOR_DB, Math.min(TOP_DB, db)) - FLOOR_DB) /
          (TOP_DB - FLOOR_DB)) *
          plotH;

      const { enabled, splitHz, isolate } = settingsRef.current;

      context.font = GRAPH_FONT;
      context.lineWidth = 1;

      /* -------------------------------------------------------- the grid */
      context.textAlign = 'right';
      context.textBaseline = 'middle';
      GRID_DB.forEach((db) => {
        const line = Math.round(toY(db)) + 0.5;
        context.strokeStyle =
          db === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)';
        context.beginPath();
        context.moveTo(PAD_L, line);
        context.lineTo(width - PAD_R, line);
        context.stroke();
        context.fillStyle = 'rgba(255,255,255,0.34)';
        context.fillText(`${db}`, PAD_L - 5, line);
      });

      context.textAlign = 'center';
      context.textBaseline = 'top';
      GRID_HZ.forEach(([hz, label]) => {
        const line = Math.round(toX(hz)) + 0.5;
        context.strokeStyle = 'rgba(255,255,255,0.045)';
        context.beginPath();
        context.moveTo(line, PAD_T);
        context.lineTo(line, floorY);
        context.stroke();
        context.fillStyle = 'rgba(255,255,255,0.34)';
        context.fillText(label, toX(hz), floorY + 4);
      });

      /* ---------------------------------------------------- the two runs */
      /**
       * Read here and nowhere else. When the stage is bypassed the native
       * side resets it on every block, which drives both runs to the -120
       * floor — so the numbers are honest, but two flat lines pinned to the
       * bottom of a plot read as a meter that is running and hearing silence.
       * A stage that is not running draws no measurement at all.
       */
      if (enabled) {
        const { inputDb, outputDb } = readDspBassForgeBands();
        const columns = Math.max(2, Math.round(plotW));
        if (dryRef.current.length !== columns + 1) {
          dryRef.current = new Float32Array(columns + 1);
          forgedRef.current = new Float32Array(columns + 1);
        }
        const dry = dryRef.current;
        const forged = forgedRef.current;
        for (let column = 0; column <= columns; column += 1) {
          const at = (column / columns) * (BANDS - 1);
          dry[column] = sampleRun(inputDb, at);
          forged[column] = sampleRun(outputDb, at);
        }
        const columnX = (column: number) => PAD_L + (column / columns) * plotW;

        /**
         * What was made, as the area between the runs, clipped at the corner.
         *
         * Two fills of the same path rather than two paths: the corner is a
         * frequency and the area is continuous across it, so cutting the
         * PAINT at `splitHz` keeps the shape whole while still saying which
         * SIDE of the user's own corner each part of it landed on.
         */
        const madePath = () => {
          context.beginPath();
          context.moveTo(columnX(0), toY(forged[0]));
          for (let column = 1; column <= columns; column += 1) {
            context.lineTo(columnX(column), toY(forged[column]));
          }
          for (let column = columns; column >= 0; column -= 1) {
            context.lineTo(
              columnX(column),
              toY(Math.min(forged[column], dry[column])),
            );
          }
          context.closePath();
        };

        const cornerX = toX(splitHz);
        [
          { ink: LOW_SIDE_INK, from: PAD_L, to: cornerX },
          { ink: HIGH_SIDE_INK, from: cornerX, to: width - PAD_R },
        ].forEach(({ ink, from, to }) => {
          if (to - from < 0.5) {
            return;
          }
          context.save();
          context.beginPath();
          context.rect(from, PAD_T, to - from, plotH);
          context.clip();
          madePath();
          context.fillStyle = `rgba(${ink},0.26)`;
          context.fill();
          context.restore();
        });

        /**
         * Under Isolate the two curves go, and the fill between them stays.
         *
         * That fill IS the stage's contribution, and the contribution is
         * exactly what Isolate sends to the speakers — so dropping the curves
         * leaves the picture showing what is audible and nothing that is not.
         * Drawing them anyway would put a dry reference and a summed output on
         * screen while neither is being played, which is the graph disagreeing
         * with the audio at the one moment a user is checking it.
         *
         * The meters themselves are unchanged: they measure the band inside
         * the stage, which Isolate does not move. Only what is worth drawing
         * from them does.
         */
        if (!isolate) {
          // The dry run first and dim, because it is the reference the forged
          // one is read against rather than a second result.
          context.strokeStyle = `rgba(${DRY_INK},0.3)`;
          context.lineWidth = 1.2;
          context.beginPath();
          for (let column = 0; column <= columns; column += 1) {
            context.lineTo(columnX(column), toY(dry[column]));
          }
          context.stroke();

          context.strokeStyle = `rgba(${OUTPUT_INK},0.92)`;
          context.lineWidth = 1.6;
          context.beginPath();
          for (let column = 0; column <= columns; column += 1) {
            context.lineTo(columnX(column), toY(forged[column]));
          }
          context.stroke();
        }
      }

      /* ------------------------------------------------------- the split */
      // Drawn whether or not the stage is running: it is a setting rather than
      // a measurement, and seeing where the corner sits is how it gets aimed.
      const splitX = Math.round(toX(splitHz)) + 0.5;
      context.save();
      context.setLineDash([3, 4]);
      context.strokeStyle = enabled
        ? 'rgba(255,255,255,0.5)'
        : 'rgba(255,255,255,0.24)';
      context.lineWidth = 1.2;
      context.beginPath();
      context.moveTo(splitX, PAD_T);
      context.lineTo(splitX, floorY);
      context.stroke();
      context.restore();

      // Flipped to the inside once the corner is near the right edge, where a
      // label drawn outward is painted past the plot or clipped away.
      const labelFlips = splitX > width - PAD_R - 40;
      context.textBaseline = 'top';
      context.textAlign = labelFlips ? 'right' : 'left';
      context.fillStyle = enabled
        ? 'rgba(255,255,255,0.6)'
        : 'rgba(255,255,255,0.3)';
      context.fillText(
        `${Math.round(splitHz)} Hz`,
        splitX + (labelFlips ? -4 : 4),
        PAD_T + 3,
      );
    };

    const loop = startGraphLoop(paint);
    redraw.current = loop.schedule;
    return () => {
      redraw.current = undefined;
      loop.stop();
    };
  }, []);

  // Repaint when anything drawn changes. The loop only turns while the engine
  // is publishing, so the split and the dials reach the canvas through here
  // while nothing is playing.
  useEffect(() => {
    redraw.current?.();
  });

  return (
    <div
      className={`dsp-eq-plot dsp-bass-forge-display${
        bassForge.enabled ? '' : ' is-off'
      }`}
    >
      <canvas
        ref={canvasRef}
        className="dsp-eq-graph dsp-bass-forge-canvas"
        // A continuously moving restatement of the dials below. Naming it
        // would put eight numbers that change twenty-three times a second
        // into the accessibility tree.
        aria-hidden="true"
      />
      <ul className="dsp-eq-legend dsp-bass-forge-legend">
        <li className="dsp-eq-legend-item">
          <span
            className="dsp-eq-legend-mark"
            style={{ color: `rgba(${DRY_INK},0.4)` }}
          />
          {t('dsp.eq.legend.input')}
        </li>
        <li className="dsp-eq-legend-item">
          <span
            className="dsp-eq-legend-mark"
            style={{ color: `rgb(${OUTPUT_INK})` }}
          />
          {t('dsp.eq.legend.spectrum')}
        </li>
        <li className="dsp-eq-legend-item">
          <span
            className="dsp-eq-legend-mark is-filled"
            style={{ color: `rgb(${LOW_SIDE_INK})` }}
          />
          {t('dsp.bassForge.graph.belowSplit')}
        </li>
        <li className="dsp-eq-legend-item">
          <span
            className="dsp-eq-legend-mark is-filled"
            style={{ color: `rgb(${HIGH_SIDE_INK})` }}
          />
          {t('dsp.bassForge.graph.aboveSplit')}
        </li>
        <li className="dsp-eq-legend-item">
          <span className="dsp-eq-legend-mark is-dashed" />
          {t('dsp.bassForge.splitHz')}
        </li>
      </ul>
    </div>
  );
};

export default DspBassForgeGraph;
