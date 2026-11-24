/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The gate, live (mockup A, Ivan's pick 2026-11-23): the last five seconds
 * of the level the gate itself hears, in the voice's colour, against the line where it opens and
 * the dashed one 4 dB under it where it closes again, both in the gate's
 * colour, with the stretches it held the room down greyed. The line drags up and down: it is the Opens at
 * dial, moved where the voice can be seen against it.
 *
 * The level is the gate's own detector (engine 1.32), which hears the voice
 * after the cleaner. The bar this replaced drew the mic's own level, which
 * still carries the room the cleaner takes away: the room read 20 dB over a
 * threshold the gate never saw it cross.
 */

import { useEffect, useRef } from 'react';
import { VOICE_RANGES } from '../../common/dsp/voiceStage';
import signedTick from '../graph/signedTick';
import { spectrumInk } from '../dsp/dspInks';
import { startGraphLoop } from '../dsp/graphLoop';
import { readInk, readTextInk } from '../utils/theme';
import { useTranslation } from '../utils/I18nContext';
import { GATE_HYSTERESIS_DB } from './MicLiveBar';
import {
  dbOfY,
  fitMicCanvas,
  haloText,
  gateInk,
  IMicPlot,
  MIC_PLOT_FONT,
  yOfDb,
} from './micPlot';
import { gateOpenness, GATE_OPEN_AT } from './micGate';
import type { IMicLevel } from './useMicLevels';

const SPAN_MS = 5000;
const TOP_DB = 0;
const FLOOR_DB = -100;
const GRID_DB = [-20, -40, -60, -80];
const PADS = { left: 0, top: 6, right: 10, bottom: 16 };
/** How near the line a press takes hold of it, CSS pixels. */
const GRAB_PX = 9;
/** How far a grid label's middle keeps from the gate's lines, CSS pixels. */
const LABEL_CLEAR_PX = 7;

interface ISample {
  at: number;
  levelDb: number;
  openness: number;
}

interface IMicGateLiveProps {
  thresholdDb: number;
  rangeDb: number;
  latest: React.MutableRefObject<IMicLevel | undefined>;
  /** The engine answering on this mic with the gate on. */
  live: boolean;
  isDisabled: boolean;
  onThreshold: (db: number) => void;
  onCommit: () => void;
}

const MicGateLive = ({
  thresholdDb,
  rangeDb,
  latest,
  live,
  isDisabled,
  onThreshold,
  onCommit,
}: IMicGateLiveProps) => {
  const { t } = useTranslation();
  const canvas = useRef<HTMLCanvasElement>(null);
  const lamp = useRef<HTMLSpanElement>(null);
  const state = useRef<HTMLElement>(null);
  const share = useRef<HTMLElement>(null);
  const plotRef = useRef<IMicPlot | undefined>(undefined);
  const dragging = useRef(false);
  const redraw = useRef<(() => void) | undefined>(undefined);
  const settings = useRef({ thresholdDb, rangeDb, live, isDisabled });
  settings.current = { thresholdDb, rangeDb, live, isDisabled };
  const words = useRef({
    open: '',
    closed: '',
    opens: '',
    waiting: '',
    ago: '',
    now: '',
  });
  words.current = {
    open: t('mic.gate.live.stateOpen'),
    closed: t('mic.gate.live.stateClosed'),
    opens: t('mic.gate.live.opens', {
      db: signedTick(Math.round(thresholdDb)),
    }),
    waiting: t('mic.gate.live.waiting'),
    ago: t('mic.live.ago', { seconds: SPAN_MS / 1000 }),
    now: t('mic.live.now'),
  };

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) {
      return undefined;
    }
    const samples: ISample[] = [];
    let seen: IMicLevel | undefined;

    const loop = startGraphLoop(({ schedule }) => {
      const plot = fitMicCanvas(element, context, PADS);
      plotRef.current = plot;
      if (!plot) {
        schedule();
        return;
      }
      const now = performance.now();
      const { thresholdDb: opensDb, rangeDb: range } = settings.current;
      const level = latest.current;
      if (!settings.current.live) {
        samples.length = 0;
      } else if (level && level !== seen && level.gateLevelDb !== undefined) {
        seen = level;
        samples.push({
          at: now,
          levelDb: level.gateLevelDb,
          openness: gateOpenness(level.gateGainDb ?? 0, range),
        });
      }
      while (samples.length > 0 && now - samples[0].at > SPAN_MS) {
        samples.shift();
      }
      const y = (db: number) => yOfDb(plot, db, TOP_DB, FLOOR_DB);
      const x = (at: number) =>
        plot.right - ((now - at) / SPAN_MS) * (plot.right - plot.left);
      const textInk = readTextInk();
      const voiceInk = spectrumInk();
      context.font = MIC_PLOT_FONT;

      // The stretches the gate held the room down, from its own gain.
      for (let index = 1; index < samples.length; index += 1) {
        const closure = 1 - samples[index].openness;
        if (closure > 0.02) {
          const from = x(samples[index - 1].at);
          context.fillStyle = readInk(0.09 * closure);
          context.fillRect(
            from,
            plot.top,
            x(samples[index].at) - from + 0.5,
            plot.bottom - plot.top,
          );
        }
      }

      const opensY = Math.round(y(opensDb)) + 0.5;
      const closesY = Math.round(y(opensDb - GATE_HYSTERESIS_DB)) + 0.5;
      context.strokeStyle = readInk(0.06);
      context.lineWidth = 1;
      context.fillStyle = textInk;
      context.textAlign = 'left';
      GRID_DB.forEach((db) => {
        const at = Math.round(y(db)) + 0.5;
        context.beginPath();
        context.moveTo(plot.left, at);
        context.lineTo(plot.right, at);
        context.stroke();
        // Not where the gate's own lines run through it: "−60 dB" struck
        // through by the line at −52 read as neither.
        const label = at - 3;
        if (
          Math.abs(label - 4 - opensY) > LABEL_CLEAR_PX &&
          Math.abs(label - 4 - closesY) > LABEL_CLEAR_PX
        ) {
          context.fillText(`${signedTick(db)} dB`, plot.left + 4, label);
        }
      });
      context.fillText(words.current.ago, plot.left, plot.height - 3);
      context.textAlign = 'right';
      context.fillText(words.current.now, plot.right, plot.height - 3);

      // What the gate heard, as an area so the room under the line reads as
      // a floor and a word as a hill rising through it.
      if (samples.length > 1) {
        context.beginPath();
        samples.forEach((sample, index) => {
          const point = [x(sample.at), y(sample.levelDb)] as const;
          if (index === 0) {
            context.moveTo(...point);
          } else {
            context.lineTo(...point);
          }
        });
        context.strokeStyle = `rgba(${voiceInk}, 0.95)`;
        context.lineWidth = 1.6;
        context.stroke();
        context.lineTo(x(samples[samples.length - 1].at), plot.bottom);
        context.lineTo(x(samples[0].at), plot.bottom);
        context.closePath();
        context.fillStyle = `rgba(${voiceInk}, 0.2)`;
        context.fill();
      }

      // Where it closes again, then where it opens, over everything.
      context.setLineDash([5, 4]);
      context.strokeStyle = readInk(0.4);
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(plot.left, closesY);
      context.lineTo(plot.right, closesY);
      context.stroke();
      context.setLineDash([]);
      context.strokeStyle = gateInk(1);
      context.lineWidth = dragging.current ? 3 : 2;
      context.beginPath();
      context.moveTo(plot.left, opensY);
      context.lineTo(plot.right, opensY);
      context.stroke();
      // The grip, at the left where nothing is drawn yet.
      context.fillStyle = gateInk(1);
      context.beginPath();
      context.arc(
        plot.left + 14,
        opensY,
        dragging.current ? 6 : 5,
        0,
        Math.PI * 2,
      );
      context.fill();
      context.font = `600 ${MIC_PLOT_FONT}`;
      context.textAlign = 'right';
      context.fillStyle = gateInk(1);
      haloText(context, words.current.opens, plot.right - 4, opensY - 6);
      context.font = MIC_PLOT_FONT;

      const last = samples[samples.length - 1];
      const open = last !== undefined && last.openness > GATE_OPEN_AT;
      if (last) {
        context.beginPath();
        context.arc(plot.right, y(last.levelDb), 4.5, 0, Math.PI * 2);
        context.fillStyle = open ? `rgba(${voiceInk}, 1)` : readInk(0.45);
        context.fill();
      }

      // The readouts beside it, written here rather than rendered.
      lamp.current?.classList.toggle('is-open', open);
      if (state.current) {
        let said = words.current.waiting;
        if (last) {
          said = open ? words.current.open : words.current.closed;
        }
        state.current.textContent = said;
      }
      if (share.current) {
        let openFor = 0;
        for (let index = 1; index < samples.length; index += 1) {
          if (samples[index].openness > GATE_OPEN_AT) {
            openFor += samples[index].at - samples[index - 1].at;
          }
        }
        const heard = samples.length > 1 ? last.at - samples[0].at : 0;
        share.current.textContent =
          heard > 0 ? `${Math.round((openFor / heard) * 100)} %` : '—';
      }
    });
    redraw.current = loop.schedule;
    return () => {
      redraw.current = undefined;
      loop.stop();
    };
  }, [latest]);

  // A setting moved while nothing plays still reaches the picture.
  redraw.current?.();

  const levelAt = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const plot = plotRef.current;
    if (!plot) {
      return undefined;
    }
    const { top } = event.currentTarget.getBoundingClientRect();
    return { plot, y: event.clientY - top };
  };

  const near = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const at = levelAt(event);
    return (
      at !== undefined &&
      Math.abs(
        at.y - yOfDb(at.plot, settings.current.thresholdDb, TOP_DB, FLOOR_DB),
      ) <= GRAB_PX
    );
  };

  const follow = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const at = levelAt(event);
    if (!at) {
      return;
    }
    const { min, max } = VOICE_RANGES.gateThresholdDb;
    const db = Math.round(dbOfY(at.plot, at.y, TOP_DB, FLOOR_DB));
    onThreshold(Math.min(max, Math.max(min, db)));
  };

  return (
    <div
      className="dsp-band mic-live-picture"
      role="figure"
      aria-label={t('mic.gate.live.label')}
    >
      <div className="dsp-band-head mic-live-picture__head">
        <span className="dsp-band-title">{t('mic.gate.live.title')}</span>
        <span className="mic-live-picture__key" aria-hidden="true">
          <span>
            <i className="mic-live-picture__swatch is-gate" />
            {t('mic.gate.live.keyLevel')}
          </span>
          <span>
            <i className="mic-live-picture__swatch is-closed" />
            {t('mic.gate.live.keyClosed')}
          </span>
          <span>
            <i className="mic-live-picture__rule is-gate" />
            {t('mic.gate.live.keyOpens')}
          </span>
          <span>
            <i className="mic-live-picture__rule is-dashed" />
            {t('mic.gate.live.keyCloses')}
          </span>
        </span>
      </div>
      <canvas
        ref={canvas}
        className="mic-live-picture__canvas mic-gate-live__canvas"
        aria-hidden="true"
        onPointerDown={(event) => {
          if (isDisabled || !near(event)) {
            return;
          }
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          follow(event);
        }}
        onPointerMove={(event) => {
          if (dragging.current) {
            follow(event);
            return;
          }
          event.currentTarget.style.cursor =
            !isDisabled && near(event) ? 'ns-resize' : '';
        }}
        onPointerUp={(event) => {
          if (!dragging.current) {
            return;
          }
          dragging.current = false;
          event.currentTarget.releasePointerCapture(event.pointerId);
          onCommit();
        }}
        onPointerCancel={() => {
          if (!dragging.current) {
            return;
          }
          dragging.current = false;
          onCommit();
        }}
      />
      <div className="mic-live-picture__readouts">
        <span className="mic-live-picture__reading">
          <span
            ref={lamp}
            className="mic-live-picture__lamp"
            aria-hidden="true"
          />
          <strong ref={state} role="status">
            {t('mic.gate.live.waiting')}
          </strong>
        </span>
        <span className="mic-live-picture__reading">
          <span>
            {t('mic.gate.live.openShare', { seconds: SPAN_MS / 1000 })}
          </span>
          <strong ref={share}>—</strong>
        </span>
        <span className="dsp-band-hint mic-live-picture__hint">
          {t('mic.gate.live.hint')}
        </span>
      </div>
    </div>
  );
};

export default MicGateLive;
