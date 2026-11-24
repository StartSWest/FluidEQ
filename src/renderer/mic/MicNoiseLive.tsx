/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Noise cancelling, live (mockup A, Ivan's pick 2026-11-23): the voice as
 * the cleaner hears it (engine 1.32's cleaner tap, after the low cut) behind,
 * and as it leaves the cleaner in front, with the room's floor before and
 * after drawn across both and what was taken between them.
 *
 * The two spectra are windowed and smoothed alike in the engine, so the gap
 * between them is the cleaner's work and nothing else: not the low cut, which
 * is ahead of both, and not the gate, which is after both.
 */

import { useEffect, useRef } from 'react';
import signedTick from '../graph/signedTick';
import { createEqSpectrum } from '../dsp/dspEqSpectrum';
import { spectrumInk } from '../dsp/dspInks';
import { startGraphLoop } from '../dsp/graphLoop';
import { readDspAnalyser, readDspSampleRate } from '../dsp/store';
import { readInk, readTextInk } from '../utils/theme';
import { useTranslation } from '../utils/I18nContext';
import {
  fitMicCanvas,
  haloText,
  IMicPlot,
  MIC_PLOT_FONT,
  TAKEN_INK,
  xOfHz,
  yOfDb,
} from './micPlot';
import type { IMicLevel } from './useMicLevels';

const LOW_HZ = 20;
const HIGH_HZ = 20000;
const TOP_DB = 0;
const FLOOR_DB = -120;
const GRID_DB = [-20, -40, -60, -80, -100];
const GRID_HZ: [number, string][] = [
  [50, '50'],
  [100, '100'],
  [200, '200'],
  [500, '500'],
  [1000, '1k'],
  [2000, '2k'],
  [5000, '5k'],
  [10000, '10k'],
];
const PADS = { left: 0, top: 8, right: 0, bottom: 16 };
/** Where the arrow between the two floors stands, from the right edge. */
const ARROW_FROM_RIGHT = 74;

interface IMicNoiseLiveProps {
  /** The cleaner on. */
  on: boolean;
  /** The engine answering on this mic. */
  live: boolean;
  /** The mic's readings, whose room is the strip's and the rail's too. */
  latest: React.MutableRefObject<IMicLevel | undefined>;
}

/** One spectrum as an area on the plot. */
const traceArea = (
  context: CanvasRenderingContext2D,
  plot: IMicPlot,
  axis: readonly number[],
  levels: Float64Array,
  high: number,
) => {
  let started = false;
  let firstX = plot.left;
  let lastX = plot.left;
  context.beginPath();
  for (let index = 0; index < axis.length; index += 1) {
    const hz = axis[index];
    if (hz >= LOW_HZ && hz <= high && Number.isFinite(levels[index])) {
      const px = xOfHz(plot, hz, LOW_HZ, high);
      const py = yOfDb(plot, levels[index], TOP_DB, FLOOR_DB);
      if (!started) {
        context.moveTo(px, py);
        firstX = px;
        started = true;
      } else {
        context.lineTo(px, py);
      }
      lastX = px;
    }
  }
  return { started, firstX, lastX };
};

const MicNoiseLive = ({ on, live, latest }: IMicNoiseLiveProps) => {
  const { t } = useTranslation();
  const canvas = useRef<HTMLCanvasElement>(null);
  const taken = useRef<HTMLElement>(null);
  const over = useRef<HTMLElement>(null);
  const redraw = useRef<(() => void) | undefined>(undefined);
  const settings = useRef({ on, live });
  settings.current = { on, live };
  const words = useRef({ before: '', after: '' });
  words.current = {
    before: t('mic.cleaner.live.roomBefore'),
    after: t('mic.cleaner.live.roomAfter'),
  };

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) {
      return undefined;
    }
    const beforeSpectrum = createEqSpectrum();
    const afterSpectrum = createEqSpectrum();

    const loop = startGraphLoop(({ schedule }) => {
      const plot = fitMicCanvas(element, context, PADS);
      if (!plot) {
        schedule();
        return;
      }
      const { on: isOn, live: isLive } = settings.current;
      const rate = readDspSampleRate();
      const high = Math.min(HIGH_HZ, rate / 2);
      const x = (hz: number) => xOfHz(plot, hz, LOW_HZ, high);
      const y = (db: number) => yOfDb(plot, db, TOP_DB, FLOOR_DB);
      const textInk = readTextInk();
      context.font = MIC_PLOT_FONT;

      context.strokeStyle = readInk(0.06);
      context.lineWidth = 1;
      context.fillStyle = textInk;
      context.textAlign = 'center';
      GRID_HZ.forEach(([hz, label]) => {
        if (hz >= high) {
          return;
        }
        const at = Math.round(x(hz)) + 0.5;
        context.beginPath();
        context.moveTo(at, plot.top);
        context.lineTo(at, plot.bottom);
        context.stroke();
        context.fillText(label, at, plot.height - 3);
      });
      context.textAlign = 'right';
      GRID_DB.forEach((db) => {
        const at = Math.round(y(db)) + 0.5;
        context.beginPath();
        context.moveTo(plot.left, at);
        context.lineTo(plot.right, at);
        context.stroke();
        context.fillText(`${signedTick(db)}`, plot.right - 3, at - 3);
      });

      const beforeTap = readDspAnalyser('cleanerIn');
      const afterTap = readDspAnalyser('denoise');
      const room = isLive && isOn ? latest.current?.room : undefined;
      if (beforeTap && afterTap && isLive && isOn) {
        const before = beforeSpectrum.read(beforeTap, rate);
        const after = afterSpectrum.read(afterTap, rate);

        const drawn = traceArea(
          context,
          plot,
          before.axis,
          before.levels,
          high,
        );
        if (drawn.started) {
          // Grey whatever the colours, as the card's hint says: the DSP
          // pages' output ink takes a scene's colour under its tint.
          context.strokeStyle = readInk(0.4);
          context.lineWidth = 1;
          context.stroke();
          context.lineTo(drawn.lastX, plot.bottom);
          context.lineTo(drawn.firstX, plot.bottom);
          context.closePath();
          context.fillStyle = readInk(0.08);
          context.fill();
        }
        const voiceInk = spectrumInk();
        const cleaned = traceArea(
          context,
          plot,
          after.axis,
          after.levels,
          high,
        );
        if (cleaned.started) {
          context.strokeStyle = `rgba(${voiceInk}, 0.95)`;
          context.lineWidth = 1.4;
          context.stroke();
          context.lineTo(cleaned.lastX, plot.bottom);
          context.lineTo(cleaned.firstX, plot.bottom);
          context.closePath();
          context.fillStyle = `rgba(${voiceInk}, 0.28)`;
          context.fill();
        }
      }

      if (room) {
        const applied = TAKEN_INK;
        const beforeY = Math.round(y(room.beforeDb)) + 0.5;
        const afterY = Math.round(y(room.afterDb)) + 0.5;
        context.setLineDash([4, 4]);
        context.lineWidth = 1;
        context.strokeStyle = readInk(0.55);
        context.beginPath();
        context.moveTo(plot.left, beforeY);
        context.lineTo(plot.right, beforeY);
        context.stroke();
        context.strokeStyle = `rgba(${spectrumInk()}, 0.9)`;
        context.beginPath();
        context.moveTo(plot.left, afterY);
        context.lineTo(plot.right, afterY);
        context.stroke();
        context.setLineDash([]);
        context.textAlign = 'left';
        context.fillStyle = readInk(0.75);
        haloText(
          context,
          `${words.current.before} · ${signedTick(Math.round(room.beforeDb))} dB`,
          plot.left + 6,
          beforeY - 5,
        );
        context.fillStyle = `rgba(${spectrumInk()}, 1)`;
        haloText(
          context,
          `${words.current.after} · ${signedTick(Math.round(room.afterDb))} dB`,
          plot.left + 6,
          afterY + 13,
        );
        // What was taken, between the two, in the colour every "taken" is.
        const gap = afterY - beforeY;
        if (gap > 14) {
          const arrowX = plot.right - ARROW_FROM_RIGHT;
          context.strokeStyle = `rgba(${applied}, 1)`;
          context.fillStyle = `rgba(${applied}, 1)`;
          context.lineWidth = 1.6;
          context.beginPath();
          context.moveTo(arrowX, beforeY + 2);
          context.lineTo(arrowX, afterY - 7);
          context.stroke();
          context.beginPath();
          context.moveTo(arrowX - 4.5, afterY - 8);
          context.lineTo(arrowX + 4.5, afterY - 8);
          context.lineTo(arrowX, afterY - 1);
          context.closePath();
          context.fill();
          context.font = `600 ${MIC_PLOT_FONT}`;
          haloText(
            context,
            `${signedTick(Math.round(room.afterDb - room.beforeDb))} dB`,
            arrowX + 8,
            (beforeY + afterY) / 2 + 4,
          );
          context.font = MIC_PLOT_FONT;
        }
      }

      if (taken.current) {
        taken.current.textContent = room
          ? `${signedTick(Math.round(room.afterDb - room.beforeDb))} dB`
          : '—';
      }
      if (over.current) {
        over.current.textContent = room
          ? `${Math.max(0, Math.round(room.voiceDb - room.afterDb))} dB`
          : '—';
      }
    });
    redraw.current = loop.schedule;
    return () => {
      redraw.current = undefined;
      loop.stop();
    };
  }, [latest]);

  redraw.current?.();

  return (
    <div
      className="dsp-band mic-live-picture"
      role="figure"
      aria-label={t('mic.cleaner.live.label')}
    >
      <div className="dsp-band-head mic-live-picture__head">
        <span className="dsp-band-title">{t('mic.cleaner.live.title')}</span>
        <span className="mic-live-picture__key" aria-hidden="true">
          <span>
            <i className="mic-live-picture__swatch is-heard" />
            {t('mic.cleaner.live.keyBefore')}
          </span>
          <span>
            <i className="mic-live-picture__swatch is-voice" />
            {t('mic.cleaner.live.keyAfter')}
          </span>
        </span>
      </div>
      <canvas
        ref={canvas}
        className="mic-live-picture__canvas"
        aria-hidden="true"
      />
      <div className="mic-live-picture__readouts">
        <span className="mic-live-picture__reading">
          <span>{t('mic.cleaner.live.taken')}</span>
          <strong ref={taken} className="is-taken">
            —
          </strong>
        </span>
        <span className="mic-live-picture__reading">
          <span>{t('mic.cleaner.live.over')}</span>
          <strong ref={over}>—</strong>
        </span>
        <span className="dsp-band-hint mic-live-picture__hint">
          {t('mic.cleaner.live.hint')}
        </span>
      </div>
    </div>
  );
};

export default MicNoiseLive;
