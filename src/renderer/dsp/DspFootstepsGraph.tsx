/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import LiveFigure from '../components/LiveFigure';
import { useTranslation } from '../utils/I18nContext';
import writeLiveText from '../utils/liveText';
import { readTextInk } from '../utils/theme';
import { appliedInk, outputInk } from './dspInks';
import { readDspFootstepsReport } from './footstepsTelemetry';
import { drawFootsteps, IFootstepsInks } from './footstepsPlot';
import { IGraphLoopFrame, startGraphLoop } from './graphLoop';
import useCanvasSize from './useCanvasSize';

/**
 * What Footsteps did over the last eight seconds of a game.
 *
 * One picture for the one claim the stage makes: the quiet sounds come up
 * and nothing else does. The steps band is drawn as it arrives, every lift
 * stands out of it in violet, the background the stage learnt is a dashed
 * line under it, and the rumble Calm took off a blast hangs from the top of
 * the blast in amber. A gunshot passes as a grey peak with nothing on it.
 *
 * Read inside the frame loop from a plain module value, as every DSP graph
 * is: the report arrives about twenty-three times a second and is only ever
 * painted.
 */

/** Eight seconds: a run of a dozen steps and the shots between them. */
const WINDOW_MS = 8_000;

/** One column per analysis window (`FEQ_METER_WINDOW`, ~42.7 ms at 48 kHz). */
const SAMPLE_MS = 43;

const HISTORY = Math.ceil(WINDOW_MS / SAMPLE_MS) + 1;

/** How long a lift's figure is held before it eases back, ms. */
const READOUT_RELEASE_MS = 450;
const MAX_STEP_MS = 100;

/** Room above the strip for the legend and the readouts, as the De-esser's. */
const PAD_T = 64;
/** Room under the strip for "now", clear of what the strip draws. */
const PAD_B = 20;
const PAD_X = 12;

const CALMED_INK = '255, 176, 89';
const CUE_INK = '206, 218, 228';

const formatLift = (db: number): string =>
  db < 0.05 ? '0.0 dB' : `+${db.toFixed(1)} dB`;
const formatCalm = (db: number): string =>
  db > -0.05 ? '0.0 dB' : `−${Math.abs(db).toFixed(1)} dB`;
const formatLevel = (db: number): string =>
  db <= -119 ? '—' : `${db < 0 ? '−' : ''}${Math.abs(db).toFixed(0)} dB`;

const LIFT_WIDEST = [formatLift(10)];
const CALM_WIDEST = [formatCalm(-9)];
const LEVEL_WIDEST = [formatLevel(-100)];

interface IDspFootstepsGraphProps {
  enabled: boolean;
  isolate: boolean;
}

const DspFootstepsGraph = ({ enabled, isolate }: IDspFootstepsGraphProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const liftRef = useRef<HTMLSpanElement | null>(null);
  const calmRef = useRef<HTMLSpanElement | null>(null);
  const bedRef = useRef<HTMLSpanElement | null>(null);

  /**
   * The strip as a ring, parallel arrays rewritten one column per window.
   * A column the stage did not measure is NaN in `level` and drawn as
   * nothing, never as silence, which would read as a game gone quiet.
   */
  const level = useRef(new Float32Array(HISTORY).fill(Number.NaN));
  const cue = useRef(new Float32Array(HISTORY).fill(Number.NaN));
  const bed = useRef(new Float32Array(HISTORY).fill(Number.NaN));
  const lift = useRef(new Float32Array(HISTORY));
  const calm = useRef(new Float32Array(HISTORY));
  const writeAt = useRef(0);
  const sampledAt = useRef(0);
  /** The column being gathered, folded over every frame inside it. */
  const pending = useRef({
    level: Number.NaN,
    cue: Number.NaN,
    bed: Number.NaN,
    lift: 0,
    calm: 0,
  });
  const heldLift = useRef(0);
  const heldCalm = useRef(0);
  const lastFrame = useRef(0);
  const redraw = useRef<(() => void) | undefined>(undefined);
  const paintNow = useRef<(() => void) | undefined>(undefined);
  const size = useCanvasSize(canvasRef, () => paintNow.current?.());

  useEffect(() => {
    const ease = (dt: number) => 1 - Math.exp(-dt / READOUT_RELEASE_MS);
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
      const report = enabled ? readDspFootstepsReport() : undefined;

      if (report) {
        const column = pending.current;
        const most = Math.max(...report.liftDb);
        column.level = Number.isNaN(column.level)
          ? report.levelDb
          : Math.max(column.level, report.levelDb);
        column.cue = Number.isNaN(column.cue)
          ? report.cueDb
          : Math.max(column.cue, report.cueDb);
        column.bed = report.bedDb;
        column.lift = Math.max(column.lift, most);
        column.calm = Math.min(column.calm, report.calmDb);
        heldLift.current =
          most > heldLift.current
            ? most
            : heldLift.current + (most - heldLift.current) * ease(dt);
        heldCalm.current =
          report.calmDb < heldCalm.current
            ? report.calmDb
            : heldCalm.current + (report.calmDb - heldCalm.current) * ease(dt);
      } else {
        heldLift.current -= heldLift.current * ease(dt);
        heldCalm.current -= heldCalm.current * ease(dt);
      }

      if (now - sampledAt.current >= SAMPLE_MS) {
        const at = writeAt.current;
        const column = pending.current;
        level.current[at] = report ? column.level : Number.NaN;
        cue.current[at] = report ? column.cue : Number.NaN;
        bed.current[at] = report ? column.bed : Number.NaN;
        lift.current[at] = report ? column.lift : 0;
        calm.current[at] = report ? column.calm : 0;
        writeAt.current = (at + 1) % HISTORY;
        pending.current = {
          level: Number.NaN,
          cue: Number.NaN,
          bed: Number.NaN,
          lift: 0,
          calm: 0,
        };
        sampledAt.current = now;
      }

      writeLiveText(
        liftRef.current,
        report ? formatLift(heldLift.current) : '—',
      );
      writeLiveText(
        calmRef.current,
        report ? formatCalm(heldCalm.current) : '—',
      );
      writeLiveText(bedRef.current, report ? formatLevel(report.bedDb) : '—');

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

      // The band in a fixed pale grey, as the De-esser draws what it leaves,
      // so the lift is the one coloured thing on the strip whatever colours
      // a scene gives the page.
      const inks: IFootstepsInks = {
        level: outputInk(),
        cue: CUE_INK,
        lifted: appliedInk(),
        calmed: CALMED_INK,
        text: readTextInk(),
      };
      drawFootsteps(
        context,
        {
          x: PAD_X,
          y: PAD_T,
          width: Math.max(1, width - PAD_X * 2),
          height: Math.max(1, height - PAD_T - PAD_B),
        },
        {
          level: level.current,
          cue: cue.current,
          bed: bed.current,
          lift: lift.current,
          calm: calm.current,
          at: (index) => (writeAt.current + index) % HISTORY,
        },
        HISTORY,
        // How far into the next column time has gone, so the strip glides
        // left every frame instead of stepping a column at a time.
        Math.min(1, (now - sampledAt.current) / SAMPLE_MS),
        isolate,
        inks,
        t('dsp.footsteps.graph.now'),
      );
    };

    const loop = startGraphLoop(paint, {
      // The strip empties when the engine lets go, as every time strip in
      // the rack does: resumed later, the join would be drawn as eight
      // unbroken seconds.
      onEngineGone: () => {
        level.current.fill(Number.NaN);
        cue.current.fill(Number.NaN);
        bed.current.fill(Number.NaN);
        lift.current.fill(0);
        calm.current.fill(0);
        writeAt.current = 0;
        pending.current = {
          level: Number.NaN,
          cue: Number.NaN,
          bed: Number.NaN,
          lift: 0,
          calm: 0,
        };
        sampledAt.current = performance.now();
        heldLift.current = 0;
        heldCalm.current = 0;
      },
    });
    redraw.current = loop.schedule;
    paintNow.current = () => paint({ schedule: loop.schedule });
    return () => {
      redraw.current = undefined;
      paintNow.current = undefined;
      loop.stop();
    };
  }, [enabled, isolate, size, t]);

  // A switch reaches the canvas through here while nothing plays.
  useEffect(() => {
    redraw.current?.();
  });

  return (
    <div
      className={`dsp-eq-plot dsp-footsteps-display${enabled ? '' : ' is-off'}`}
    >
      <canvas
        ref={canvasRef}
        className="dsp-eq-graph dsp-footsteps-canvas"
        aria-hidden="true"
      />
      <div className="dsp-master-status dsp-footsteps-status" aria-live="off">
        {isolate ? (
          <span className="is-isolate">{t('dsp.footsteps.graph.isolate')}</span>
        ) : null}
        <span className="is-lift">
          {t('dsp.footsteps.graph.lifting')}
          <b>
            <LiveFigure
              className="dsp-status-figure"
              widest={LIFT_WIDEST}
              textRef={liftRef}
            >
              —
            </LiveFigure>
          </b>
        </span>
        <span className="is-calm">
          {t('dsp.footsteps.graph.calming')}
          <b>
            <LiveFigure
              className="dsp-status-figure"
              widest={CALM_WIDEST}
              textRef={calmRef}
            >
              —
            </LiveFigure>
          </b>
        </span>
        <span className="is-bed">
          {t('dsp.footsteps.graph.background')}
          <b>
            <LiveFigure
              className="dsp-status-figure"
              widest={LEVEL_WIDEST}
              textRef={bedRef}
            >
              —
            </LiveFigure>
          </b>
        </span>
      </div>
      <ul className="dsp-eq-legend dsp-master-legend dsp-footsteps-legend">
        <li className="dsp-eq-legend-item">
          <span className="dsp-eq-legend-mark is-filled is-everything" />
          {t('dsp.footsteps.graph.everything')}
        </li>
        <li className="dsp-eq-legend-item">
          <span className="dsp-eq-legend-mark is-steps" />
          {t('dsp.footsteps.graph.steps')}
        </li>
        <li className="dsp-eq-legend-item">
          <span className="dsp-eq-legend-mark is-filled is-lifted" />
          {t('dsp.footsteps.graph.lifted')}
        </li>
        <li className="dsp-eq-legend-item">
          <span className="dsp-eq-legend-mark is-dashed" />
          {t('dsp.footsteps.graph.background')}
        </li>
        <li className="dsp-eq-legend-item">
          <span className="dsp-eq-legend-mark is-filled is-calmed" />
          {t('dsp.footsteps.graph.calmed')}
        </li>
      </ul>
    </div>
  );
};

export default DspFootstepsGraph;
