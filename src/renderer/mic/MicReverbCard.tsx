/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The mic's Reverb (engine 1.33, `reverb.h`): a preset pick of its own, the
 * shape of the tail drawn from the dials, the five types, and the dials in
 * three bands — the tail, its colour, and what it does while you talk.
 *
 * The picture is the dials' own consequence, never a reading: the voice,
 * the pre-delay's gap, the tail starting at its mix and falling 60 dB over
 * its decay, and with ducking on the lower tail heard while you talk. It is
 * whole from the first frame, so nothing on the card moves as data comes.
 */

import { useEffect, useRef } from 'react';
import {
  IReverbSettings,
  REVERB_DEFAULTS,
  REVERB_RANGES,
  REVERB_TYPES,
  TReverbType,
} from '../../common/dsp/reverbStage';
import type { TranslationKey } from '../../common/i18n';
import { Dial, ProcessorCard } from '../dsp/DspControls';
import { spectrumInk } from '../dsp/dspInks';
import { readInk, readTextInk } from '../utils/theme';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';
import MicPresetBar from './MicPresetBar';
import {
  fitMicCanvas,
  gateInk,
  haloText,
  MIC_PLOT_FONT,
  yOfDb,
} from './micPlot';

const TYPE_KEYS: Record<TReverbType, TranslationKey> = {
  plate: 'mic.reverb.type.plate',
  vocalPlate: 'mic.reverb.type.vocalPlate',
  room: 'mic.reverb.type.room',
  chamber: 'mic.reverb.type.chamber',
  hall: 'mic.reverb.type.hall',
};

const TYPE_HINTS: Record<TReverbType, TranslationKey> = {
  plate: 'mic.reverb.typeHint.plate',
  vocalPlate: 'mic.reverb.typeHint.vocalPlate',
  room: 'mic.reverb.typeHint.room',
  chamber: 'mic.reverb.typeHint.chamber',
  hall: 'mic.reverb.typeHint.hall',
};

const TOP_DB = 0;
const FLOOR_DB = -66;
const GRID_DB = [-20, -40, -60];
const PADS = { left: 0, top: 8, right: 0, bottom: 16 };
/** How long the voice the tail follows is drawn. */
const VOICE_S = 0.18;

interface ITailProps {
  reverb: IReverbSettings;
  on: boolean;
}

/** "1.8 s", "0.6 s"; "120 ms" under a second for the pre-delay. */
const seconds = (value: number) => `${value.toFixed(1)} s`;

const MicReverbTail = ({ reverb, on }: ITailProps) => {
  const { t } = useTranslation();
  const canvas = useRef<HTMLCanvasElement>(null);
  const draw = useRef<() => void>(() => undefined);

  draw.current = () => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) {
      return;
    }
    const plot = fitMicCanvas(element, context, PADS);
    if (!plot) {
      return;
    }
    const pre = reverb.predelayMs / 1000;
    const span = Math.max(1, VOICE_S + pre + reverb.decayS * 1.08);
    const x = (time: number) =>
      plot.left + (time / span) * (plot.right - plot.left);
    const y = (db: number) => yOfDb(plot, db, TOP_DB, FLOOR_DB);
    const voiceInk = spectrumInk();
    const alpha = on ? 1 : 0.45;
    context.font = MIC_PLOT_FONT;

    context.strokeStyle = readInk(0.06);
    context.lineWidth = 1;
    context.fillStyle = readTextInk();
    context.textAlign = 'left';
    GRID_DB.forEach((db) => {
      const at = Math.round(y(db)) + 0.5;
      context.beginPath();
      context.moveTo(plot.left, at);
      context.lineTo(plot.right, at);
      context.stroke();
      context.fillText(`${db} dB`, plot.right - 40, at - 3);
    });

    // The voice the tail follows.
    context.fillStyle = readInk(0.16 * alpha);
    context.fillRect(x(0), y(-3), x(VOICE_S) - x(0), y(FLOOR_DB) - y(-3));
    context.fillStyle = readTextInk();
    context.fillText(t('mic.reverb.tail.voice'), x(0) + 4, y(-3) + 12);

    // The tail: from the mix, 60 dB down at the decay time.
    const start = VOICE_S + pre;
    const end = start + reverb.decayS;
    const tailAt = (time: number, depthDb: number) =>
      reverb.mixDb - depthDb - ((time - start) / reverb.decayS) * 60;
    const shape = (depthDb: number, until: number) => {
      context.beginPath();
      context.moveTo(x(start), y(FLOOR_DB));
      const steps = 48;
      for (let i = 0; i <= steps; i += 1) {
        const time = start + ((until - start) * i) / steps;
        context.lineTo(x(time), y(Math.max(FLOOR_DB, tailAt(time, depthDb))));
      }
    };
    // Under the envelope, the tail as a reverb's response looks: a few
    // reflections standing apart just after the pre-delay, then the dense
    // wash, every line under the envelope by a random few dB. The same
    // lines every frame (a fixed seed), so the picture never shimmers.
    const until = Math.min(span, end + 0.2);
    const fill = context.createLinearGradient(
      0,
      y(reverb.mixDb),
      0,
      y(FLOOR_DB),
    );
    fill.addColorStop(0, `rgba(${voiceInk}, ${0.2 * alpha})`);
    fill.addColorStop(1, `rgba(${voiceInk}, 0)`);
    shape(0, until);
    context.lineTo(x(until), y(FLOOR_DB));
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    let seed = 0x2545f491;
    const random = () => {
      // Exact in a double: the product stays under 2^53.
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const early = Math.min(0.06, reverb.decayS * 0.08);
    const step = 2;
    context.lineWidth = 1;
    for (let px = x(start); px < x(until); px += step) {
      const time =
        start + ((px - x(start)) / (x(until) - x(start))) * (until - start);
      const isEarly = time - start < early;
      // Early on, a reflection only now and then; after, every line.
      const drawn = !isEarly || random() <= 0.18;
      const below = isEarly ? random() * 4 : 2 + random() * 14;
      const top = Math.max(FLOOR_DB, tailAt(time, below));
      if (drawn && top > FLOOR_DB) {
        context.strokeStyle = `rgba(${voiceInk}, ${(isEarly ? 0.9 : 0.42) * alpha})`;
        context.beginPath();
        context.moveTo(Math.round(px) + 0.5, y(FLOOR_DB));
        context.lineTo(Math.round(px) + 0.5, y(top));
        context.stroke();
      }
    }
    shape(0, until);
    context.strokeStyle = `rgba(${voiceInk}, ${0.95 * alpha})`;
    context.lineWidth = 1.6;
    context.stroke();

    // While you talk, the tail ducked by its depth.
    if (reverb.duck && reverb.duckDb > 0) {
      shape(reverb.duckDb, Math.min(span, end));
      context.setLineDash([4, 4]);
      context.strokeStyle = gateInk(alpha);
      context.lineWidth = 1.4;
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = gateInk(alpha);
      context.textAlign = 'left';
      haloText(
        context,
        t('mic.reverb.tail.ducked', { db: Math.round(reverb.duckDb) }),
        x(start) + 6,
        y(reverb.mixDb - reverb.duckDb) + 14,
      );
    }

    // The pre-delay's gap and the decay's end, marked.
    context.strokeStyle = readInk(0.3 * alpha);
    context.lineWidth = 1;
    context.setLineDash([2, 3]);
    [start, end].forEach((time) => {
      if (time > span) {
        return;
      }
      const at = Math.round(x(time)) + 0.5;
      context.beginPath();
      context.moveTo(at, plot.top);
      context.lineTo(at, y(FLOOR_DB));
      context.stroke();
    });
    context.setLineDash([]);
    context.font = `600 ${MIC_PLOT_FONT}`;
    context.fillStyle = `rgba(${voiceInk}, ${alpha})`;
    context.textAlign = 'left';
    haloText(
      context,
      t('mic.reverb.tail.mix', { db: Math.round(reverb.mixDb) }),
      x(start) + 6,
      y(reverb.mixDb) - 6,
    );
    context.textAlign = end > span * 0.8 ? 'right' : 'left';
    haloText(
      context,
      t('mic.reverb.tail.decay', { time: seconds(reverb.decayS) }),
      end > span * 0.8 ? x(end) - 6 : x(end) + 6,
      plot.top + 12,
    );
    context.font = MIC_PLOT_FONT;
    context.fillStyle = readTextInk();
    context.textAlign = 'left';
    context.fillText('0 s', plot.left, plot.height - 3);
    context.textAlign = 'right';
    context.fillText(seconds(span), plot.right, plot.height - 3);
  };

  useEffect(() => {
    draw.current();
  });

  useEffect(() => {
    const element = canvas.current;
    if (!element) {
      return undefined;
    }
    const observer = new ResizeObserver(() => draw.current());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="dsp-band mic-live-picture"
      role="figure"
      aria-label={t('mic.reverb.tail.label')}
    >
      <div className="dsp-band-head mic-live-picture__head">
        <span className="dsp-band-title">{t('mic.reverb.tail.title')}</span>
        <span className="mic-live-picture__key" aria-hidden="true">
          <span>
            <i className="mic-live-picture__swatch is-heard" />
            {t('mic.reverb.tail.keyVoice')}
          </span>
          <span>
            <i className="mic-live-picture__swatch is-voice" />
            {t('mic.reverb.tail.keyTail')}
          </span>
          <span className={reverb.duck ? undefined : 'is-hidden'}>
            <i className="mic-live-picture__rule is-gate" />
            {t('mic.reverb.tail.keyDucked')}
          </span>
        </span>
      </div>
      <canvas
        ref={canvas}
        className="mic-live-picture__canvas"
        aria-hidden="true"
      />
    </div>
  );
};

interface IMicReverbCardProps {
  reverb: IReverbSettings | undefined;
  onPatch: (next: IReverbSettings) => void;
  onCommit: () => void;
}

const MicReverbCard = ({ reverb, onPatch, onCommit }: IMicReverbCardProps) => {
  const { t } = useTranslation();
  const current = reverb ?? REVERB_DEFAULTS;
  const on = current.enabled;
  const patch = (next: Partial<IReverbSettings>) =>
    onPatch({ ...current, ...next });
  // The values a preset sets: everything but the switch.
  const values: Omit<IReverbSettings, 'enabled'> = {
    type: current.type,
    mixDb: current.mixDb,
    decayS: current.decayS,
    predelayMs: current.predelayMs,
    toneHz: current.toneHz,
    lowCutHz: current.lowCutHz,
    width: current.width,
    duck: current.duck,
    duckDb: current.duckDb,
  };
  const r = REVERB_RANGES;
  const dial = (
    key: 'mixDb' | 'decayS' | 'predelayMs' | 'toneHz' | 'lowCutHz' | 'duckDb',
    labelKey: TranslationKey,
    unit: string,
    step: number,
    isDisabled = !on,
  ) => (
    <Dial
      labelKey={labelKey}
      value={current[key]}
      defaultValue={REVERB_DEFAULTS[key]}
      min={r[key].min}
      max={r[key].max}
      unit={unit}
      step={step}
      isDisabled={isDisabled}
      onChange={(value) => patch({ [key]: value })}
      onCommit={onCommit}
    />
  );

  return (
    <ProcessorCard
      id="mic-reverb"
      titleKey="mic.reverb.title"
      descriptionKey="mic.reverb.description"
      isEnabled={on}
      onToggle={() => {
        patch({ enabled: !on });
        onCommit();
      }}
      toolbar={
        <MicPresetBar
          stage="reverb"
          values={values}
          hint={(each) =>
            `${t(TYPE_KEYS[each.type])} · ${each.decayS.toFixed(1)} s · ${each.mixDb} dB`
          }
          onPick={(picked) => {
            onPatch({ ...picked, enabled: true });
            onCommit();
          }}
        />
      }
    >
      <MicReverbTail reverb={current} on={on} />
      <div className="dsp-band">
        <div className="dsp-de-esser-head">
          <span className="dsp-band-title">{t('mic.reverb.group.type')}</span>
          <div
            className="segmented"
            role="group"
            aria-label={t('mic.reverb.group.type')}
          >
            {REVERB_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={`segmented__option${
                  current.type === type ? ' is-selected' : ''
                }`}
                aria-pressed={current.type === type}
                disabled={!on}
                onClick={() => {
                  patch({ type });
                  onCommit();
                }}
              >
                {t(TYPE_KEYS[type])}
              </button>
            ))}
          </div>
        </div>
        <p className="dsp-band-hint">{t(TYPE_HINTS[current.type])}</p>
      </div>
      <div className="dsp-band">
        <div className="dsp-band-head">
          <span className="dsp-band-title">{t('mic.reverb.group.tail')}</span>
        </div>
        <p className="dsp-band-hint">{t('mic.reverb.group.tailHint')}</p>
        <div className="dsp-band-dials">
          {dial('mixDb', 'mic.reverb.mix', 'dB', 1)}
          {dial('decayS', 'mic.reverb.decay', 's', 0.1)}
          {dial('predelayMs', 'mic.reverb.predelay', 'ms', 1)}
        </div>
      </div>
      <div className="dsp-band">
        <div className="dsp-band-head">
          <span className="dsp-band-title">{t('mic.reverb.group.colour')}</span>
        </div>
        <p className="dsp-band-hint">{t('mic.reverb.group.colourHint')}</p>
        <div className="dsp-band-dials">
          {dial('toneHz', 'mic.reverb.tone', 'Hz', 100)}
          {dial('lowCutHz', 'mic.reverb.lowCut', 'Hz', 10)}
          <Dial
            labelKey="mic.reverb.width"
            value={current.width * 100}
            defaultValue={REVERB_DEFAULTS.width * 100}
            min={0}
            max={100}
            unit="%"
            step={1}
            isDisabled={!on}
            onChange={(percent) => patch({ width: percent / 100 })}
            onCommit={onCommit}
          />
        </div>
      </div>
      <div className="dsp-band">
        <div className="dsp-de-esser-head">
          <span className="dsp-band-title">{t('mic.reverb.group.duck')}</span>
          <Switch
            id="mic-reverb-duck"
            isOn={current.duck}
            isDisabled={!on}
            handleToggle={() => {
              patch({ duck: !current.duck });
              onCommit();
            }}
            ariaLabel={t('mic.reverb.group.duck')}
          />
        </div>
        <p className="dsp-band-hint">{t('mic.reverb.group.duckHint')}</p>
        <div className="dsp-band-dials">
          {dial('duckDb', 'mic.reverb.duckDb', 'dB', 1, !on || !current.duck)}
        </div>
      </div>
    </ProcessorCard>
  );
};

export default MicReverbCard;
