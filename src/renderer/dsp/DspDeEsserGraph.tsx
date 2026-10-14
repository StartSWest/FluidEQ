/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import type { IHostAnalysisDeEsser } from '../../common/dsp/analysisWire';
import { IDeEsserSettings } from '../../common/dsp/deEsser';
import LiveFigure from '../components/LiveFigure';
import { useTranslation } from '../utils/I18nContext';
import writeLiveText from '../utils/liveText';
import { readTextInk } from '../utils/theme';
import { readDspDeEsserReport } from './deEsserTelemetry';
import {
  drawHistory,
  drawTreble,
  IDeEsserInks,
  IPlotBox,
  ITrebleNow,
} from './deEsserPlot';
import { baseCurveInk, BASE_CURVE_CSS } from './dspInks';
import { IGraphLoopFrame, startGraphLoop } from './graphLoop';
import useCanvasSize from './useCanvasSize';

/**
 * What the De-esser did over the last four seconds, beside the treble now.
 *
 * Two pictures because the stage makes two claims. Over time: it cuts an S
 * and lets a hi-hat by — a strip where every S has its cut hanging over it
 * and the hi-hats pass grey with nothing taken. Over frequency: where the S
 * was and what shape of cut it got, which is what the three modes differ in.
 *
 * Read inside the frame loop from a plain module value, as every DSP graph
 * is: the report arrives about twenty-three times a second and is only ever
 * painted.
 */

/** Four seconds: long enough to see a phrase's S's and the hats between. */
const WINDOW_MS = 4_000;

/** One column per analysis window (`FEQ_METER_WINDOW`, ~42.7 ms at 48 kHz). */
const SAMPLE_MS = 43;

const HISTORY = Math.ceil(WINDOW_MS / SAMPLE_MS) + 1;

/**
 * Where the tells call a sound a voice. The stage spares by confidence
 * continuously; the strip has two colours, and this is the middle of the
 * scale they are cut from.
 */
const VOICE_CONFIDENCE = 0.5;

/**
 * How the treble picture moves between readings, by elapsed time and never
 * per frame, so a 144 Hz screen draws the same motion a 60 Hz one does.
 *
 * Readings arrive about every 43 ms and each one is a fresh window, so drawn
 * as they come every mark jumped: a band's bar fell 8 dB a frame between
 * readings and rose again, its threshold mark stepped with every window, and
 * the S line went on and off with each one. Now each quantity is quick to
 * arrive and slow to leave, as a meter's needle is.
 */
const MOTION = {
  /** A band rising: nearly at once. */
  levelRiseMs: 15,
  /** A band falling, dB per second. */
  levelFallDbPerS: 24,
  /** Where the stage starts on a band, which moves with the song. */
  thresholdMs: 180,
  /** A cut deepening, and letting go. */
  cutAttackMs: 20,
  cutReleaseMs: 220,
  /** The S line sliding to where the S is, appearing and fading. */
  sMoveMs: 70,
  sAppearMs: 40,
  sFadeMs: 450,
  /** The cut readout letting go. */
  readoutReleaseMs: 300,
} as const;

/** The share of the way a one-pole covers in `dt` with time constant `tau`. */
const toward = (dt: number, tau: number): number =>
  1 - Math.exp(-dt / Math.max(1, tau));

/** The longest step taken at once: a tab brought back is not a jump. */
const MAX_STEP_MS = 100;

/**
 * The treble picture one frame on: each band's level, threshold and cut
 * moved toward the reading by the time that passed, and the S line slid and
 * faded rather than switched. A reading on other bands — the range was
 * moved — is taken as it comes, since there is nothing to move from.
 */
const moveTreble = (
  drawn: ITrebleNow,
  report: Readonly<IHostAnalysisDeEsser>,
  dt: number,
): ITrebleNow => {
  const sameBands =
    drawn.hz.length === report.bandHz.length &&
    drawn.hz.every((hz, band) => Math.abs(hz - (report.bandHz[band] ?? 0)) < 1);
  if (!sameBands) {
    return {
      hz: [...report.bandHz],
      levelDb: [...report.bandLevelDb],
      thresholdDb: [...report.bandThresholdDb],
      cutDb: [...report.bandCutDb],
      sHz: report.frequencyHz,
      sAlpha: 0,
    };
  }
  const rise = toward(dt, MOTION.levelRiseMs);
  const fall = (MOTION.levelFallDbPerS * dt) / 1000;
  const levelDb = report.bandLevelDb.map((target, band) => {
    const at = drawn.levelDb[band] ?? target;
    return target > at
      ? at + (target - at) * rise
      : Math.max(target, at - fall);
  });
  const settle = toward(dt, MOTION.thresholdMs);
  const thresholdDb = report.bandThresholdDb.map((target, band) => {
    const at = drawn.thresholdDb[band] ?? target;
    return at + (target - at) * settle;
  });
  const cutDb = report.bandCutDb.map((target, band) => {
    const at = drawn.cutDb[band] ?? target;
    const tau = target < at ? MOTION.cutAttackMs : MOTION.cutReleaseMs;
    return at + (target - at) * toward(dt, tau);
  });
  const cutting = report.reductionDb < -0.05 && report.frequencyHz > 0;
  let { sHz } = drawn;
  if (cutting) {
    // Slid in octaves from where it was showing; placed where it is when
    // nothing was showing.
    sHz =
      drawn.sHz > 0 && drawn.sAlpha > 0.01
        ? 2 **
          (Math.log2(drawn.sHz) +
            (Math.log2(report.frequencyHz) - Math.log2(drawn.sHz)) *
              toward(dt, MOTION.sMoveMs))
        : report.frequencyHz;
  }
  const sAlpha =
    drawn.sAlpha +
    ((cutting ? 1 : 0) - drawn.sAlpha) *
      toward(dt, cutting ? MOTION.sAppearMs : MOTION.sFadeMs);
  return { hz: drawn.hz, levelDb, thresholdDb, cutDb, sHz, sAlpha };
};

/** How long "Cymbals let through" stays up after the sound it names. */
const SPARED_HOLD_MS = 1_500;

const PAD_T = 64;
const PAD_B = 6;
const PAD_X = 12;
const PANE_GAP = 18;

/**
 * A canvas this tall holds the two pictures stacked. The stylesheet gives a
 * narrow card's canvas that height (`_dspDeEsser.scss`) and the graph reads
 * the arrangement from it, so the two cannot disagree.
 */
const STACKED_HEIGHT = 380;

const CUT_INK = '255, 176, 89';
const NOT_VOICE_INK = '150, 160, 172';

const formatHz = (hz: number): string =>
  hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${Math.round(hz)} Hz`;

const formatCut = (db: number): string =>
  Math.abs(db) < 0.05 ? '0.0 dB' : `−${Math.abs(db).toFixed(1)} dB`;

const S_WIDEST = [formatHz(12000)];
const CUT_WIDEST = [formatCut(-18)];

interface IDspDeEsserGraphProps {
  deEsser: IDeEsserSettings;
}

const DspDeEsserGraph = ({ deEsser }: IDspDeEsserGraphProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sRef = useRef<HTMLSpanElement | null>(null);
  const cutRef = useRef<HTMLSpanElement | null>(null);
  const sparedRef = useRef<HTMLSpanElement | null>(null);

  /**
   * The strip as a ring, parallel arrays rewritten one column per window.
   * `live` says the column was measured: a bypassed stage draws nothing,
   * never a zero, which would read as a stage choosing to cut nothing.
   */
  const standout = useRef(new Float32Array(HISTORY).fill(Number.NaN));
  const cut = useRef(new Float32Array(HISTORY));
  const voice = useRef(new Uint8Array(HISTORY));
  const live = useRef(new Uint8Array(HISTORY));
  const writeAt = useRef(0);
  const sampledAt = useRef(0);
  /** The column being gathered, folded over every frame inside it. */
  const pending = useRef({ standout: Number.NaN, cut: 0, voice: 0 });
  /** The treble picture as drawn, each mark moving toward its reading. */
  const held = useRef<ITrebleNow>({
    hz: [],
    levelDb: [],
    thresholdDb: [],
    cutDb: [],
    sHz: 0,
    sAlpha: 0,
  });
  const heldCut = useRef(0);
  const lastFrame = useRef(0);
  const lastS = useRef({ hz: 0, at: 0 });
  const sparedAt = useRef(Number.NEGATIVE_INFINITY);
  const redraw = useRef<(() => void) | undefined>(undefined);
  const paintNow = useRef<(() => void) | undefined>(undefined);
  const size = useCanvasSize(canvasRef, () => paintNow.current?.());

  const { enabled, isolate, lowHz, highHz, mode, rangeDb } = deEsser;

  useEffect(() => {
    const paint = ({ schedule }: IGraphLoopFrame) => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) {
        schedule();
        return;
      }
      const now = performance.now();
      const dt = Math.min(MAX_STEP_MS, Math.max(0, now - lastFrame.current));
      lastFrame.current = now;
      const report = enabled ? readDspDeEsserReport() : undefined;

      if (report) {
        // How far the loudest band stood over where the stage starts on it:
        // the quantity the cut is made from, on the strip's one scale.
        let over = Number.NaN;
        report.bandLevelDb.forEach((level, band) => {
          const margin = level - (report.bandThresholdDb[band] ?? 0);
          over = Number.isNaN(over) ? margin : Math.max(over, margin);
        });
        const column = pending.current;
        if (Number.isNaN(column.standout) || over > column.standout) {
          column.standout = over;
          column.voice = report.confidence >= VOICE_CONFIDENCE ? 1 : 0;
        }
        column.cut = Math.min(column.cut, report.reductionDb);
        if (
          over > 0 &&
          report.confidence < VOICE_CONFIDENCE &&
          report.reductionDb > -0.5
        ) {
          sparedAt.current = now;
        }
        if (report.reductionDb < -0.05 && report.frequencyHz > 0) {
          lastS.current = { hz: report.frequencyHz, at: now };
        }
        held.current = moveTreble(held.current, report, dt);
        heldCut.current =
          report.reductionDb < heldCut.current
            ? report.reductionDb
            : heldCut.current +
              (report.reductionDb - heldCut.current) *
                toward(dt, MOTION.readoutReleaseMs);
      } else {
        heldCut.current -=
          heldCut.current * toward(dt, MOTION.readoutReleaseMs);
        held.current = {
          ...held.current,
          sAlpha: held.current.sAlpha * (1 - toward(dt, MOTION.sFadeMs)),
        };
      }

      if (now - sampledAt.current >= SAMPLE_MS) {
        const at = writeAt.current;
        const column = pending.current;
        standout.current[at] = report ? column.standout : Number.NaN;
        cut.current[at] = report ? column.cut : 0;
        voice.current[at] = column.voice;
        live.current[at] = report ? 1 : 0;
        writeAt.current = (at + 1) % HISTORY;
        pending.current = { standout: Number.NaN, cut: 0, voice: 0 };
        sampledAt.current = now;
      }

      const hasS = lastS.current.hz > 0 && now - lastS.current.at < 1_000;
      writeLiveText(sRef.current, hasS ? formatHz(lastS.current.hz) : '—');
      writeLiveText(cutRef.current, report ? formatCut(heldCut.current) : '—');
      sparedRef.current?.classList.toggle(
        'is-hidden',
        isolate || now - sparedAt.current > SPARED_HOLD_MS,
      );

      const { width, height } = size.current;
      if (width < 1 || height < 1) {
        return;
      }
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      const pixelWidth = Math.round(width * ratio);
      const pixelHeight = Math.round(height * ratio);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const inks: IDeEsserInks = {
        voice: baseCurveInk(),
        notVoice: NOT_VOICE_INK,
        cut: CUT_INK,
        text: readTextInk(),
      };
      // The deepest the dial allows, never under 6 dB, so a gentle profile's
      // 3 dB cut is still drawn as something rather than a hairline.
      const span = Math.max(6, rangeDb);
      const inner = {
        x: PAD_X,
        y: PAD_T,
        width: Math.max(1, width - PAD_X * 2),
        height: Math.max(1, height - PAD_T - PAD_B),
      };
      const sideBySide = height < STACKED_HEIGHT;
      const historyBox: IPlotBox = sideBySide
        ? { ...inner, width: (inner.width - PANE_GAP) * 0.6 }
        : { ...inner, height: (inner.height - PANE_GAP) * 0.55 };
      const trebleBox: IPlotBox = sideBySide
        ? {
            ...inner,
            x: inner.x + historyBox.width + PANE_GAP,
            width: inner.width - historyBox.width - PANE_GAP,
          }
        : {
            ...inner,
            y: inner.y + historyBox.height + PANE_GAP,
            height: inner.height - historyBox.height - PANE_GAP,
          };

      drawHistory(
        context,
        historyBox,
        {
          standout: standout.current,
          cut: cut.current,
          voice: voice.current,
          live: live.current,
          at: (index) => (writeAt.current + index) % HISTORY,
        },
        HISTORY,
        // How far into the next column time has gone, so the strip glides
        // left every frame instead of stepping a column at a time.
        Math.min(1, (now - sampledAt.current) / SAMPLE_MS),
        span,
        isolate,
        inks,
        t('dsp.deEsser.graph.now'),
      );
      drawTreble(
        context,
        trebleBox,
        held.current,
        lowHz,
        highHz,
        mode,
        span,
        inks,
      );
    };

    const loop = startGraphLoop(paint, {
      // The strip empties when the engine lets go, for the reason every time
      // strip in the rack does: resumed later, the join would be drawn as
      // four unbroken seconds.
      onEngineGone: () => {
        standout.current.fill(Number.NaN);
        cut.current.fill(0);
        voice.current.fill(0);
        live.current.fill(0);
        writeAt.current = 0;
        pending.current = { standout: Number.NaN, cut: 0, voice: 0 };
        sampledAt.current = performance.now();
        held.current = {
          hz: [],
          levelDb: [],
          thresholdDb: [],
          cutDb: [],
          sHz: 0,
          sAlpha: 0,
        };
        heldCut.current = 0;
        lastS.current = { hz: 0, at: 0 };
        sparedAt.current = Number.NEGATIVE_INFINITY;
      },
    });
    redraw.current = loop.schedule;
    paintNow.current = () => paint({ schedule: loop.schedule });
    return () => {
      redraw.current = undefined;
      paintNow.current = undefined;
      loop.stop();
    };
  }, [enabled, isolate, lowHz, highHz, mode, rangeDb, size, t]);

  // The range and the mode reach the canvas through here while nothing plays.
  useEffect(() => {
    redraw.current?.();
  });

  return (
    <div
      className={`dsp-eq-plot dsp-de-esser-display${enabled ? '' : ' is-off'}`}
    >
      <canvas
        ref={canvasRef}
        className="dsp-eq-graph dsp-de-esser-canvas"
        aria-hidden="true"
      />
      <div className="dsp-master-status dsp-de-esser-status" aria-live="off">
        {isolate ? (
          <span className="is-isolate">{t('dsp.deEsser.graph.isolate')}</span>
        ) : (
          <span className="is-s">
            {t('dsp.deEsser.graph.s')}
            <b>
              <LiveFigure
                className="dsp-status-figure"
                widest={S_WIDEST}
                textRef={sRef}
              >
                —
              </LiveFigure>
            </b>
          </span>
        )}
        <span className="is-cut">
          {t('dsp.deEsser.graph.cut')}
          <b>
            <LiveFigure
              className="dsp-status-figure"
              widest={CUT_WIDEST}
              textRef={cutRef}
            >
              —
            </LiveFigure>
          </b>
        </span>
        <span className="is-spared is-hidden" ref={sparedRef}>
          {t('dsp.deEsser.graph.spared')}
        </span>
      </div>
      <ul className="dsp-eq-legend dsp-master-legend dsp-de-esser-legend">
        <li className="dsp-eq-legend-item">
          <span
            className="dsp-eq-legend-mark is-filled"
            style={{ color: BASE_CURVE_CSS }}
          />
          {t('dsp.deEsser.graph.voice')}
        </li>
        <li className="dsp-eq-legend-item">
          <span
            className="dsp-eq-legend-mark is-filled"
            style={{ color: `rgb(${NOT_VOICE_INK})` }}
          />
          {t('dsp.deEsser.graph.notVoice')}
        </li>
        <li className="dsp-eq-legend-item">
          <span
            className="dsp-eq-legend-mark is-filled"
            style={{ color: `rgb(${CUT_INK})` }}
          />
          {t('dsp.deEsser.graph.cut')}
        </li>
        <li className="dsp-eq-legend-item">
          <span className="dsp-eq-legend-mark is-dashed" />
          {t('dsp.deEsser.graph.threshold')}
        </li>
      </ul>
    </div>
  );
};

export default DspDeEsserGraph;
