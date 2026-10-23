/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { MouseEvent, PointerEvent, useEffect, useRef } from 'react';
import { useTranslation } from '../utils/I18nContext';
import halfLifeOfFrameStep from '../utils/frameStep';
import { type TBandChannel } from '../../common/constants';
import { getEaseFactor } from '../../common/smoothing';
import { IEqBandSettings, IEqSettings } from '../../common/dsp/chain';
import { createCanvasLayer, prepareCanvasLayer } from './canvasLayer';
import { createEqResponses } from './dspEqResponses';
import { createEqSpectrum } from './dspEqSpectrum';
import {
  readDspAnalyser,
  readDspBandAmounts,
  readDspBandLevels,
  subscribeDspAnalysers,
} from './store';
import {
  readTextInk,
  readAccent,
  readAccentLight,
  readSurface,
  readSurfaceAlpha,
} from '../utils/theme';
import { spectrumInk } from './dspInks';
import { drawEarTag, isHeardOn, rackPlaysEars } from './dspEqEars';
import {
  GRAB_RADIUS,
  GRID_DB,
  GRID_DBFS,
  GRID_HZ,
  HANDLE_R,
  HEIGHT,
  MAX_HZ,
  MIN_HZ,
  PAD_B,
  PAD_L,
  PAD_R,
  PAD_T,
  POINT_STEP_PX,
  SPECTRUM_FLOOR_DB,
  SPECTRUM_TOP_DB,
  dbToY,
  dbfsToY,
  hzToX,
  plotH,
  plotW,
  xToHz,
  yToDb,
  yToDbfs,
} from './dspEqGraphScale';

/**
 * The curve's easing as half-lives: the steps it was tuned at, a frame at a
 * time on a 60 Hz screen — 0.05 and 0.02 for a dynamic band opening and
 * settling, 0.12 for its level line, 0.08 for the line's brightness — held to
 * that speed on a screen of any rate.
 */
const ENGAGE_OPEN_HALF_LIFE_MS = halfLifeOfFrameStep(0.05);
const ENGAGE_SETTLE_HALF_LIFE_MS = halfLifeOfFrameStep(0.02);
const LEVEL_HALF_LIFE_MS = halfLifeOfFrameStep(0.12);
const LIT_HALF_LIFE_MS = halfLifeOfFrameStep(0.08);

interface IDspEqGraphProps {
  eq: IEqSettings;
  sampleRate: number;
  /**
   * The bands play analog-matched (`rackPlaysMatched`): the Treble choice
   * where whatever runs the rack reads it, so the curve is the one heard.
   */
  matched: boolean;
  selected: number;
  onSelect: (index: number) => void;
  /** Live, while a handle is dragged. */
  onChange: (index: number, next: Partial<IEqBandSettings>) => void;
  /** Once the drag ends. */
  onCommit: () => void;
  /**
   * A right-click on a handle: the band's menu, at the pointer — the menu a
   * band of the main EQ opens, so the two EQs are worked the same way.
   */
  onMenu: (index: number, x: number, y: number) => void;
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
  matched,
  selected,
  onSelect,
  onChange,
  onCommit,
  onMenu,
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
    matched: boolean;
    selected: number;
    /** The strings the canvas draws. Through the ref like everything else,
     * so switching language repaints without rebuilding the observer. */
    t: (
      key:
        | 'dsp.eq.thresholdMark'
        | 'eq.channels.letter.left'
        | 'eq.channels.letter.right',
      values?: Record<string, string>,
    ) => string;
    redraw?: () => void;
  }>({ eq, sampleRate, matched, selected, t });
  // Assigned field by field: replacing the object would drop `redraw`, which
  // the paint effect installs once and every later render depends on.
  view.current.eq = eq;
  view.current.sampleRate = sampleRate;
  view.current.matched = matched;
  view.current.selected = selected;
  view.current.t = t;

  /** CSS pixels of the drawing area, read from the element each paint. */
  const boxRef = useRef({ width: 0, height: HEIGHT });

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
    /** The drawn level of each band, eased the same way its engagement is. */
    const drawnLevels: number[] = [];
    /** How present the band's live level line is, 0 to 1. */
    let drawnLit = 0;
    /** Whether the selected band hears anything, for its level line. */
    let pickedAudible = false;
    /**
     * The curve, the at-rest twin and the right ear at each plotted point,
     * summed from the bands' cached responses (`dspEqResponses.ts`).
     *
     * Kept out here and grown in place, because a pair of fresh arrays per
     * frame is garbage collected sixty times a second for nothing.
     */
    let plotTotal = new Float64Array(0);
    let plotRest = new Float64Array(0);
    /** The right ear's curve, while a band is kept to one ear. */
    let plotRight = new Float64Array(0);
    const responsesFor = createEqResponses();
    /** The live spectrum's reading and its ballistics (`dspEqSpectrum.ts`). */
    const spectrum = createEqSpectrum();
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    /**
     * The grid and the curve, each drawn once and reused until what it shows
     * changes; a frame only lays them either side of the live spectrum.
     *
     * The graph draws every frame the screen does, 240 a second as readily
     * as 60, and redrawing the curve each time was most of a frame's work:
     * every band's response at every point, the grid, every label. Nothing
     * on either layer moves between edits unless a dynamic band is easing.
     */
    const under = createCanvasLayer();
    const over = createCanvasLayer();
    if (!canvas || !context || !under || !over) {
      return undefined;
    }
    /** The layer the grid or curve code is drawing on. */
    let pen = under.context;
    /** What the curve layer was last drawn from. */
    let overDrawn: unknown[] = [];
    /** When the last frame was painted, for easing timed in real time. */
    let paintedAt = Number.NEGATIVE_INFINITY;

    /**
     * Each dynamic band's drawn engagement and the selected band's level
     * line, moved by the time that passed. Says whether any of it is still
     * moving, which is the only thing that redraws the curve between edits.
     */
    const easeEngagement = (
      liveEq: IEqSettings,
      pick: number,
      elapsedMs: number,
    ): boolean => {
      const amounts = readDspBandAmounts();
      let moving = false;
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
         * moves at the same rate both ways reads as drift. About a quarter of
         * a second to open and most of a second to settle, the pace an eye
         * follows without being pulled — timed, so a 240 Hz screen eases at
         * the speed a 60 Hz one does.
         */
        const next =
          shown +
          (target - shown) *
            getEaseFactor(
              elapsedMs,
              target > shown
                ? ENGAGE_OPEN_HALF_LIFE_MS
                : ENGAGE_SETTLE_HALF_LIFE_MS,
            );
        drawnAmounts[index] = next;
        moving = moving || Math.abs(target - next) > 0.001;
      });

      const picked = liveEq.bands[pick];
      pickedAudible = false;
      if (!picked?.dynamic || !picked.enabled) {
        return moving;
      }
      const heard = readDspBandLevels()[pick];
      pickedAudible =
        typeof heard === 'number' && heard > SPECTRUM_FLOOR_DB + 6;
      if (pickedAudible) {
        const settled = drawnLevels[pick] ?? heard;
        drawnLevels[pick] =
          settled +
          (heard - settled) * getEaseFactor(elapsedMs, LEVEL_HALF_LIFE_MS);
      }
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
      const over12 =
        (drawnLevels[pick] ?? picked.thresholdDb) - picked.thresholdDb;
      const past = Math.max(0, Math.min(1, over12 / 12));
      const lit = pickedAudible ? 0.3 + past * 0.68 : 0;
      drawnLit += (lit - drawnLit) * getEaseFactor(elapsedMs, LIT_HALF_LIFE_MS);
      // The selected dynamic band's line follows the music every frame.
      return true;
    };

    /**
     * The canvas's size in CSS pixels, border and all, as the observer below
     * last reported it. Measured by `getBoundingClientRect` only until the
     * first report: asked every frame, it made the browser work out the
     * page's layout on the spot whenever anything beside the graph had moved
     * — two thirds of this graph's frame, measured with the meters running.
     */
    let measured: { width: number; height: number } | undefined;

    let frame = 0;
    const paint = () => {
      const textInk = readTextInk();
      frame = 0;
      const box = measured ?? canvas.getBoundingClientRect();
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

      const {
        eq: liveEq,
        sampleRate: rate,
        matched: playsMatched,
        selected: pick,
        t: translate,
      } = view.current;
      // Local to the paint, from the box just measured: the module-scope maths
      // takes the size rather than closing over it.
      const W = boxRef.current.width;
      const H = boxRef.current.height;
      const X = (hz: number) => hzToX(hz, W);
      const Y = (db: number) => dbToY(db, H);

      const now = performance.now();
      const settling = easeEngagement(liveEq, pick, now - paintedAt);
      paintedAt = now;
      const steps = Math.max(2, Math.round(plotW(W) / POINT_STEP_PX));
      const responses = responsesFor(liveEq, rate, playsMatched, steps);
      // Everything the curve layer is drawn from; any of it changing redraws
      // the layer, and so does a dynamic band still easing.
      const overFrom: unknown[] = [
        backingW,
        backingH,
        ratio,
        textInk,
        readAccent(1, '#00e5cf'),
        readAccentLight(1, '#a1fcff'),
        readSurface('--surface-block', ''),
        readSurface('--surface-base', ''),
        liveEq,
        rate,
        playsMatched,
        pick,
        translate,
      ];
      const overStale =
        settling ||
        overFrom.length !== overDrawn.length ||
        overFrom.some((value, index) => value !== overDrawn[index]);
      overDrawn = overFrom;
      const underKey = `${backingW}x${backingH}@${ratio}|${textInk}`;

      if (under.key !== underKey) {
        prepareCanvasLayer(under, backingW, backingH, ratio);
        pen = under.context;
        pen.font =
          '12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
        pen.textBaseline = 'middle';

        GRID_DB.forEach((db) => {
          const y = Math.round(Y(db)) + 0.5;
          pen.strokeStyle =
            db === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)';
          pen.lineWidth = 1;
          pen.beginPath();
          pen.moveTo(PAD_L, y);
          pen.lineTo(boxRef.current.width - PAD_R, y);
          pen.stroke();
          pen.fillStyle = textInk;
          pen.textAlign = 'right';
          pen.fillText(db > 0 ? `+${db}` : `${db}`, PAD_L - 8, y);
        });

        // The level scale belongs to the spectrum; both axes need readable ink.
        pen.textAlign = 'left';
        pen.fillStyle = textInk;
        GRID_DBFS.forEach((dbfs) => {
          const level =
            (dbfs - SPECTRUM_FLOOR_DB) / (SPECTRUM_TOP_DB - SPECTRUM_FLOOR_DB);
          const y = Math.round(PAD_T + plotH(H) - level * plotH(H)) + 0.5;
          pen.fillText(`${dbfs}`, PAD_L + plotW(W) + 7, y);
        });

        pen.textAlign = 'center';
        GRID_HZ.forEach(([hz, label]) => {
          const x = Math.round(X(hz)) + 0.5;
          pen.strokeStyle = 'rgba(255,255,255,0.07)';
          pen.beginPath();
          pen.moveTo(x, PAD_T);
          pen.lineTo(x, PAD_T + plotH(H));
          pen.stroke();
          pen.fillStyle = textInk;
          pen.fillText(label, x, boxRef.current.height - PAD_B / 2);
        });

        under.key = underKey;
      }

      // The cached grid, the live spectrum over it, the cached curve on top.
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(under.canvas, 0, 0);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      /**
       * The live spectrum, behind everything else.
       *
       * Tapped after the chain, so what is drawn is what is heard: cut a band
       * and the shape under the curve drops with it. That is the whole reason
       * an EQ shows a spectrum at all — otherwise you are aiming at a guess.
       *
       * Read the way the main graph reads its own (`liveGraphBand.ts`): each
       * point the power in a twelfth of an octave around it, or three bins
       * where a twelfth is narrower, levelled so a tone reads its own dBFS.
       * It was the loudest single bin under each pixel column, which draws
       * the grain of one transform — a few decibels from bin to bin — as
       * peaks the record does not have, and leaves broadband music twenty to
       * thirty decibels under its real level, well below the dashed threshold
       * of a dynamic band it was meant to be read against. From an engine
       * that sends the EQ tap live it is the window ending now, with the
       * bass read from a long window, at a twenty-fourth of an octave, under
       * an analyser's ballistics (`dspEqSpectrum.ts`).
       */
      const live = readDspAnalyser('eq');
      if (live) {
        const { axis, levels } = spectrum.read(live, rate);
        const floorY = PAD_T + plotH(H);

        // The contour alone is stroked: a stroke round the closed shape drew
        // its two ends and the floor as lines the music never made.
        const contour = new Path2D();
        let firstX: number | undefined;
        let lastX = 0;
        for (let point = 0; point < axis.length; point += 1) {
          const hz = axis[point];
          if (hz >= MIN_HZ && hz <= MAX_HZ) {
            const reading = Number.isFinite(levels[point])
              ? levels[point]
              : SPECTRUM_FLOOR_DB;
            const level =
              (Math.min(SPECTRUM_TOP_DB, Math.max(SPECTRUM_FLOOR_DB, reading)) -
                SPECTRUM_FLOOR_DB) /
              (SPECTRUM_TOP_DB - SPECTRUM_FLOOR_DB);
            const x = X(hz);
            const y = floorY - level * plotH(H);
            if (firstX === undefined) {
              contour.moveTo(x, y);
              firstX = x;
            } else {
              contour.lineTo(x, y);
            }
            lastX = x;
          }
        }
        if (firstX !== undefined) {
          const area = new Path2D(contour);
          area.lineTo(lastX, floorY);
          area.lineTo(firstX, floorY);
          area.closePath();
          // Lit from the top of the scale down, so what is loud reads
          // brighter than what is quiet, the way an analyser's fill does.
          const ink = spectrumInk();
          const fill = context.createLinearGradient(0, PAD_T, 0, floorY);
          fill.addColorStop(0, `rgba(${ink}, 0.28)`);
          fill.addColorStop(1, `rgba(${ink}, 0.03)`);
          context.save();
          context.fillStyle = fill;
          context.fill(area);
          context.strokeStyle = `rgba(${ink}, 0.45)`;
          context.lineWidth = 1.25;
          context.lineJoin = 'round';
          context.stroke(contour);
          context.restore();
        }
      }

      context.setTransform(1, 0, 0, 1, 0, 0);
      if (overStale) {
        prepareCanvasLayer(over, backingW, backingH, ratio);
        pen = over.context;
        const plotHz = responses.hz;
        // Each band's own contribution, faint. The sum alone cannot say which
        // band is responsible for a dip.
        responses.bands.forEach((response, index) => {
          if (!response) {
            return;
          }
          pen.beginPath();
          for (let i = 0; i <= steps; i += 1) {
            const y = Y(response[i]);
            if (i === 0) {
              pen.moveTo(X(plotHz[i]), y);
            } else {
              pen.lineTo(X(plotHz[i]), y);
            }
          }
          const isPick = index === pick;
          pen.strokeStyle = isPick
            ? readAccentLight(0.55, 'rgba(156,255,244,0.55)')
            : 'rgba(255,255,255,0.15)';
          pen.lineWidth = isPick ? 1.5 : 1;
          pen.stroke();
        });

        // The cut drawn on its own, in a colder colour than the bands: it is not
        // a band and cannot be selected or dragged, so it should not look like
        // one.
        const { subsonic } = responses;
        if (subsonic) {
          pen.beginPath();
          for (let i = 0; i <= steps; i += 1) {
            const y = Y(subsonic[i]);
            if (i === 0) {
              pen.moveTo(X(plotHz[i]), y);
            } else {
              pen.lineTo(X(plotHz[i]), y);
            }
          }
          pen.strokeStyle = 'rgba(120,170,255,0.45)';
          pen.lineWidth = 1.25;
          pen.setLineDash([4, 3]);
          pen.stroke();
          pen.setLineDash([]);
        }

        /**
         * What each band is applying right now, as the worklet measured it
         * (`easeEngagement`).
         *
         * A static band is always 1. A dynamic one is somewhere between 0 and 1
         * and moves with the material, which is the only way the threshold dial
         * has any visible effect: the full-strength curve and the at-rest curve
         * are both fixed, so drawing either of them alone made the control look
         * broken while it was working.
         */
        const amountOf = (index: number): number => drawnAmounts[index] ?? 1;

        /**
         * Two ears while a band is kept to one: the curve, its at-rest twin, the
         * shading and the grain are the left ear's, and the right ear's runs
         * beside it dashed. With every band on both the two are one curve.
         */
        const twoEared = rackPlaysEars(liveEq);
        const heardOn = (index: number, ear: TBandChannel): boolean => {
          const one = liveEq.bands[index];
          return !twoEared || one === undefined || isHeardOn(one, ear);
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

        if (plotTotal.length !== steps + 1) {
          plotTotal = new Float64Array(steps + 1);
          plotRest = new Float64Array(steps + 1);
          plotRight = new Float64Array(steps + 1);
        }
        for (let i = 0; i <= steps; i += 1) {
          const floor = subsonic ? subsonic[i] : 0;
          let total = floor;
          let rest = floor;
          let right = floor;
          responses.bands.forEach((response, index) => {
            if (!response) {
              return;
            }
            const applied = response[i] * amountOf(index);
            if (heardOn(index, 'left')) {
              total += applied;
              if (!liveEq.bands[index]?.dynamic) {
                rest += response[i];
              }
            }
            if (heardOn(index, 'right')) {
              right += applied;
            }
          });
          plotTotal[i] = total;
          plotRest[i] = hasDynamic ? rest : total;
          plotRight[i] = twoEared ? right : total;
        }

        // The right ear first, so the left — the solid line — is painted over
        // it where the two meet. Dashed longer and fuller than the at-rest
        // twin, which is a third of the curve's weight: the two must not be
        // read as each other.
        if (twoEared) {
          pen.beginPath();
          for (let i = 0; i <= steps; i += 1) {
            const y = Y(plotRight[i]);
            if (i === 0) {
              pen.moveTo(X(plotHz[i]), y);
            } else {
              pen.lineTo(X(plotHz[i]), y);
            }
          }
          pen.strokeStyle = readAccent(0.9, 'rgba(0,229,207,0.9)');
          pen.lineWidth = 2.5;
          pen.setLineDash([9, 7]);
          pen.stroke();
          pen.setLineDash([]);
        }

        if (hasDynamic) {
          pen.beginPath();
          for (let i = 0; i <= steps; i += 1) {
            const hz = plotHz[i];
            const y = Y(plotRest[i]);
            if (i === 0) {
              pen.moveTo(X(hz), y);
            } else {
              pen.lineTo(X(hz), y);
            }
          }
          // The curve's own colour at a third of its weight, so it reads as the
          // same line somewhere else rather than as a second, unrelated trace.
          pen.strokeStyle = readAccent(0.32, 'rgba(0,229,207,0.32)');
          pen.lineWidth = 1.5;
          pen.setLineDash([6, 4]);
          pen.stroke();
          pen.setLineDash([]);
        }

        pen.beginPath();
        for (let i = 0; i <= steps; i += 1) {
          const hz = plotHz[i];
          const y = Y(plotTotal[i]);
          if (i === 0) {
            pen.moveTo(X(hz), y);
          } else {
            pen.lineTo(X(hz), y);
          }
        }
        pen.strokeStyle = readAccent(1, '#00e5cf');
        pen.lineWidth = 2.5;
        pen.lineJoin = 'round';
        pen.stroke();

        /** The part of the authored curve that adds energy above unity. */
        pen.beginPath();
        for (let i = 0; i <= steps; i += 1) {
          const hz = plotHz[i];
          const over = plotTotal[i];
          const y = over > 0 ? Y(over) : Y(0);
          if (i === 0) {
            pen.moveTo(X(hz), y);
          } else {
            pen.lineTo(X(hz), y);
          }
        }
        pen.lineTo(X(MAX_HZ), Y(0));
        pen.lineTo(X(MIN_HZ), Y(0));
        pen.closePath();
        const boostShade = pen.createLinearGradient(0, PAD_T, 0, Y(0));
        boostShade.addColorStop(0, readAccent(0.16, 'rgba(0,229,207,0.16)'));
        boostShade.addColorStop(1, readAccent(0.035, 'rgba(0,229,207,0.035)'));
        pen.fillStyle = boostShade;
        pen.fill();

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
           * Both of these are what the band hears, and the spectrum behind them
           * is a narrower slice of it.
           *
           * The threshold and the detector both measure the band's whole
           * passband, where 1.0 is full scale. The spectrum is the power in a
           * twelfth of an octave, and a band's passband is several of those —
           * an octave and more at the Qs these bands use — so the band hears
           * more than any one point of the spectrum under it shows. So the
           * threshold is drawn with the band's OWN level beside it and the two
           * are read against each other; the spectrum is the shape behind
           * them, not the thing they are compared to.
           */
          const toY = (dbfs: number) => dbfsToY(dbfs, H);
          const y = toY(picked.thresholdDb);
          // The half-power edges: the octave span either side of centre that a
          // bell of this Q actually hears.
          const spread = 2 ** (1 / (2 * Math.max(0.1, picked.quality)));
          const from = X(Math.max(MIN_HZ, picked.frequency / spread));
          const to = X(Math.min(MAX_HZ, picked.frequency * spread));
          pen.beginPath();
          pen.moveTo(from, y);
          pen.lineTo(to, y);
          pen.strokeStyle = 'rgba(255,196,92,0.85)';
          pen.lineWidth = 1.75;
          pen.setLineDash([5, 3]);
          pen.stroke();
          pen.setLineDash([]);

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
          // Where it rests and how bright it is are eased in `easeEngagement`.
          const restingAt = drawnLevels[pick] ?? picked.thresholdDb;
          if (drawnLit > 0.02) {
            const heardY = toY(restingAt);
            pen.beginPath();
            pen.moveTo(from, heardY);
            pen.lineTo(to, heardY);
            pen.strokeStyle = `rgba(255,196,92,${drawnLit.toFixed(3)})`;
            pen.lineWidth = 2.5;
            pen.stroke();
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
          pen.font =
            '600 11px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
          pen.textBaseline = 'bottom';
          // Set explicitly rather than inherited: the grid labels leave this as
          // 'right' and the axis labels as 'left', so whichever ran last decided
          // where this landed.
          pen.textAlign = 'left';
          pen.fillStyle = 'rgba(255,196,92,0.95)';
          const caption = translate('dsp.eq.thresholdMark', {
            level: picked.thresholdDb.toFixed(0),
          });
          const captionWidth = pen.measureText(caption).width;
          // Centred over the segment it belongs to, then held inside the plot:
          // a band near either edge has its line clipped, and a caption centred
          // on the part that was cut off ends up outside the box.
          const captionX = (from + to) / 2 - captionWidth / 2;
          pen.fillText(
            caption,
            Math.min(
              PAD_L + plotW(W) - captionWidth,
              Math.max(PAD_L, captionX),
            ),
            y - 3,
          );
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
            {
              phase: 0.6,
              colour: readAccent(0.42, 'rgba(0,229,207,0.42)'),
              width: 1.2,
            },
            {
              phase: -0.9,
              colour: readAccentLight(0.28, 'rgba(156,255,244,0.28)'),
              width: 1,
            },
          ].forEach(({ phase, colour, width }) => {
            pen.beginPath();
            for (let i = 0; i <= steps; i += 1) {
              const hz = plotHz[i];
              const wobble =
                Math.sin(i * 1.9 + phase * 7) * Math.sin(i * 0.47 + phase);
              const y = Y(plotTotal[i]) + wobble * grain;
              if (i === 0) {
                pen.moveTo(X(hz), y);
              } else {
                pen.lineTo(X(hz), y);
              }
            }
            pen.strokeStyle = colour;
            pen.lineWidth = width;
            pen.stroke();
          });
        }

        liveEq.bands.forEach((one, index) => {
          const x = X(one.frequency);
          const y = Y(one.gainDb);
          const isPick = index === pick;
          pen.globalAlpha = one.enabled ? 1 : 0.32;

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
            pen.beginPath();
            pen.arc(x, y, HANDLE_R + 4, 0, Math.PI * 2);
            pen.strokeStyle = 'rgba(255,196,92,0.85)';
            pen.lineWidth = 1.5;
            pen.setLineDash([3, 3]);
            pen.stroke();
            pen.setLineDash([]);
          }

          pen.beginPath();
          pen.arc(x, y, HANDLE_R, 0, Math.PI * 2);
          // The card colour, not the near-black violet this drawing was built
          // on. That colour predates the palette and is nowhere else in the
          // window, so an unselected handle read as a hole punched through the
          // plot rather than as a knob standing on it. The cyan ring below is
          // what marks it; the fill only has to hide the curve behind it.
          pen.fillStyle = isPick
            ? readAccent(1, '#00e5cf')
            : readSurfaceAlpha(
                '--surface-block',
                0.92,
                'rgba(30, 66, 87, 0.92)',
              );
          pen.fill();
          pen.strokeStyle = isPick
            ? '#ffffff'
            : readAccent(0.7, 'rgba(0,229,207,0.7)');
          pen.lineWidth = 2;
          pen.stroke();
          // Which ear, beside the handle, on a band kept to one.
          if (twoEared && one.ear !== undefined) {
            drawEarTag(
              context,
              x,
              y,
              translate(
                one.ear === 'left'
                  ? 'eq.channels.letter.left'
                  : 'eq.channels.letter.right',
              ),
              readAccentLight(1, '#a1fcff'),
              readSurfaceAlpha('--surface-base', 1, '#061821'),
              one.ear === 'left',
            );
          }
          pen.globalAlpha = 1;
        });
      }
      context.drawImage(over.canvas, 0, 0);
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
     *
     * Stopping is only safe because something re-arms it. The subscription at
     * the foot of this effect is that something: the engine registering its
     * analyser is an event now, and without it the only re-arm was the
     * per-render redraw below — which does not fire, because a host frame
     * arriving renders nothing. The panel therefore came up dead after every
     * refresh, output change and driver restart, and needed a control moved
     * before the spectrum would start.
     */
    const schedule = () => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    function tick() {
      frame = 0;
      paint();
      if (readDspAnalyser('eq')) {
        schedule();
      }
    }

    view.current.redraw = schedule;
    schedule();

    const observer =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver((entries) => {
            const size = entries[entries.length - 1]?.borderBoxSize?.[0];
            measured = size
              ? { width: size.inlineSize, height: size.blockSize }
              : undefined;
            schedule();
          })
        : undefined;
    observer?.observe(canvas);

    /**
     * The engine arriving, which is the other thing that has to start a frame.
     *
     * Both directions matter. A registration restarts the loop that stopped
     * while there was nothing to draw; a release gives one last frame, so the
     * spectrum clears instead of freezing on whatever the host sent last.
     */
    const unwatch = subscribeDspAnalysers(schedule);

    return () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
      observer?.disconnect();
      unwatch();
    };
  }, []);

  // Repaint when anything drawn changes. The loop itself is armed once above.
  useEffect(() => {
    view.current.redraw?.();
  });

  const localPoint = (
    event: PointerEvent<HTMLCanvasElement> | MouseEvent<HTMLCanvasElement>,
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    const box = canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  /**
   * The nearest handle within reach, or -1, so a click near two of them takes
   * the one actually aimed at rather than the first in the array.
   */
  const nearestHandle = (point: { x: number; y: number }): number => {
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
    return best;
  };

  const onContextMenu = (event: MouseEvent<HTMLCanvasElement>) => {
    const point = localPoint(event);
    const index = point ? nearestHandle(point) : -1;
    if (index < 0) {
      return;
    }
    event.preventDefault();
    onMenu(index, event.clientX, event.clientY);
  };

  const onDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = localPoint(event);
    if (!point) {
      return;
    }
    // A right-click picks the band and leaves its menu to `onContextMenu`:
    // it is not the start of a drag, of a band or of the threshold line.
    if (event.button !== 0) {
      const aimed = nearestHandle(point);
      if (aimed >= 0) {
        onSelect(aimed);
      }
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

    const best = nearestHandle(point);
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
      onContextMenu={onContextMenu}
    />
  );
};

export default DspEqGraph;
