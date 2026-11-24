/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Voice level (mockup A, Ivan's pick 2026-11-24): the voice brought to a
 * steady level while it speaks, after the gate (`voice_level.h`). The card
 * draws ten seconds of the voice as it arrives faint behind, levelled in
 * front, and the target line; under it how far it is lifting now, and the
 * two dials.
 *
 * The readings are the engine's own (1.33): the level it heard and the gain
 * it applied, so "levelled" is the heard level plus that gain, the same sum
 * the engine makes.
 */

import { useEffect, useRef } from 'react';
import { IVoiceSettings, VOICE_RANGES } from '../../common/dsp/voiceStage';
import signedTick from '../graph/signedTick';
import { Dial, ProcessorCard } from '../dsp/DspControls';
import { spectrumInk } from '../dsp/dspInks';
import { startGraphLoop } from '../dsp/graphLoop';
import { readInk, readTextInk } from '../utils/theme';
import { useTranslation } from '../utils/I18nContext';
import {
  fitMicCanvas,
  gateInk,
  haloText,
  MIC_PLOT_FONT,
  yOfDb,
} from './micPlot';
import MicPresetBar from './MicPresetBar';
import type { IMicLevel } from './useMicLevels';

const SPAN_MS = 10000;
const TOP_DB = 0;
const FLOOR_DB = -70;
const GRID_DB = [-10, -30, -50];
const PADS = { left: 0, top: 6, right: 0, bottom: 16 };
/** "+6.2 dB", "−11.4 dB" with a true minus, and "0.0 dB" for nothing. */
const signedDb = (db: number) => {
  const shown = Math.abs(db).toFixed(1);
  if (Number(shown) === 0) {
    return '0.0 dB';
  }
  return `${db < 0 ? '−' : '+'}${shown} dB`;
};

/** A lift this close to nothing reads as nothing being done. */
const RESTING_DB = 0.5;

interface ISample {
  at: number;
  heardDb: number;
  gainDb: number;
}

interface IMicLevelLiveProps {
  targetDb: number;
  latest: React.MutableRefObject<IMicLevel | undefined>;
  /** The engine answering on this mic with Voice level on. */
  live: boolean;
}

const MicLevelLive = ({ targetDb, latest, live }: IMicLevelLiveProps) => {
  const { t } = useTranslation();
  const canvas = useRef<HTMLCanvasElement>(null);
  const lifted = useRef<HTMLElement>(null);
  const doing = useRef<HTMLElement>(null);
  const redraw = useRef<(() => void) | undefined>(undefined);
  const settings = useRef({ targetDb, live });
  settings.current = { targetDb, live };
  const words = useRef({
    target: '',
    ago: '',
    now: '',
    following: '',
    holding: '',
  });
  words.current = {
    target: t('mic.level.live.target', {
      db: signedTick(Math.round(targetDb)),
    }),
    ago: t('mic.live.ago', { seconds: SPAN_MS / 1000 }),
    now: t('mic.live.now'),
    following: t('mic.level.live.following'),
    holding: t('mic.level.live.holding'),
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
      if (!plot) {
        schedule();
        return;
      }
      const now = performance.now();
      const { targetDb: target, live: isLive } = settings.current;
      const level = latest.current;
      if (!isLive) {
        samples.length = 0;
      } else if (
        level &&
        level !== seen &&
        level.levelHeardDb !== undefined &&
        level.levelGainDb !== undefined
      ) {
        seen = level;
        samples.push({
          at: now,
          heardDb: level.levelHeardDb,
          gainDb: level.levelGainDb,
        });
      }
      while (samples.length > 0 && now - samples[0].at > SPAN_MS) {
        samples.shift();
      }
      const y = (db: number) => yOfDb(plot, db, TOP_DB, FLOOR_DB);
      const x = (at: number) =>
        plot.right - ((now - at) / SPAN_MS) * (plot.right - plot.left);
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
        context.fillText(`${signedTick(db)} dB`, plot.left + 4, at - 3);
      });
      context.fillText(words.current.ago, plot.left, plot.height - 3);
      context.textAlign = 'right';
      context.fillText(words.current.now, plot.right, plot.height - 3);

      const area = (levelOf: (sample: ISample) => number) => {
        context.beginPath();
        samples.forEach((sample, index) => {
          const point = [x(sample.at), y(levelOf(sample))] as const;
          if (index === 0) {
            context.moveTo(...point);
          } else {
            context.lineTo(...point);
          }
        });
      };
      if (samples.length > 1) {
        const voiceInk = spectrumInk();
        // As it arrives, grey behind.
        area((sample) => sample.heardDb);
        context.lineTo(x(samples[samples.length - 1].at), plot.bottom);
        context.lineTo(x(samples[0].at), plot.bottom);
        context.closePath();
        context.fillStyle = readInk(0.1);
        context.fill();
        // Levelled, in the voice's colour in front.
        area((sample) => sample.heardDb + sample.gainDb);
        context.strokeStyle = `rgba(${voiceInk}, 0.95)`;
        context.lineWidth = 1.4;
        context.stroke();
        context.lineTo(x(samples[samples.length - 1].at), plot.bottom);
        context.lineTo(x(samples[0].at), plot.bottom);
        context.closePath();
        context.fillStyle = `rgba(${voiceInk}, 0.26)`;
        context.fill();
      }

      // The target, in the gate's colour as the line a level is held to.
      const targetY = Math.round(y(target)) + 0.5;
      context.strokeStyle = gateInk(1);
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(plot.left, targetY);
      context.lineTo(plot.right, targetY);
      context.stroke();
      context.font = `600 ${MIC_PLOT_FONT}`;
      context.fillStyle = gateInk(1);
      context.textAlign = 'right';
      haloText(context, words.current.target, plot.right - 4, targetY - 6);
      context.font = MIC_PLOT_FONT;

      const last = samples[samples.length - 1];
      if (lifted.current) {
        lifted.current.textContent = last ? signedDb(last.gainDb) : '—';
      }
      if (doing.current) {
        let said = '—';
        if (last && samples.length > 1) {
          const before = samples[samples.length - 2].gainDb;
          said =
            Math.abs(last.gainDb - before) > 0.05 ||
            Math.abs(last.gainDb) < RESTING_DB
              ? words.current.following
              : words.current.holding;
        }
        doing.current.textContent = said;
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
      aria-label={t('mic.level.live.label')}
    >
      <div className="dsp-band-head mic-live-picture__head">
        <span className="dsp-band-title">{t('mic.level.live.title')}</span>
        <span className="mic-live-picture__key" aria-hidden="true">
          <span>
            <i className="mic-live-picture__swatch is-heard" />
            {t('mic.level.live.keyArrives')}
          </span>
          <span>
            <i className="mic-live-picture__swatch is-voice" />
            {t('mic.level.live.keyLevelled')}
          </span>
          <span>
            <i className="mic-live-picture__rule is-gate" />
            {t('mic.level.live.keyTarget')}
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
          <span>{t('mic.level.live.lifted')}</span>
          <strong ref={lifted}>—</strong>
        </span>
        <span className="mic-live-picture__reading">
          <span>{t('mic.level.live.state')}</span>
          {/* As wide as the longer of its two words from the first frame,
              so the reading beside it never moves when one replaces the
              other. */}
          <span className="mic-live-picture__word">
            <strong ref={doing}>—</strong>
            <strong className="mic-live-picture__sizer" aria-hidden="true">
              {t('mic.level.live.following')}
            </strong>
            <strong className="mic-live-picture__sizer" aria-hidden="true">
              {t('mic.level.live.holding')}
            </strong>
          </span>
        </span>
      </div>
    </div>
  );
};

interface IMicLevelCardProps {
  voice: IVoiceSettings;
  onPatch: (next: IVoiceSettings) => void;
  onCommit: () => void;
  latest: React.MutableRefObject<IMicLevel | undefined>;
  live: boolean;
}

const MicLevelCard = ({
  voice,
  onPatch,
  onCommit,
  latest,
  live,
}: IMicLevelCardProps) => {
  const { t } = useTranslation();
  const on = voice.enabled && voice.levelEnabled;
  const patch = (next: Partial<IVoiceSettings>) =>
    onPatch({ ...voice, enabled: true, ...next });
  return (
    <ProcessorCard
      id="mic-level"
      titleKey="mic.level.title"
      descriptionKey="mic.level.description"
      isEnabled={on}
      onToggle={() => {
        patch({ levelEnabled: !on });
        onCommit();
      }}
      toolbar={
        <MicPresetBar
          stage="level"
          values={voice}
          hint={(each) =>
            `${each.levelTargetDb} dB · +${each.levelMaxLiftDb} dB`
          }
          onPick={(values) => {
            patch({ ...values, levelEnabled: true });
            onCommit();
          }}
        />
      }
    >
      <MicLevelLive
        targetDb={voice.levelTargetDb}
        latest={latest}
        live={live && on}
      />
      <div className="dsp-band">
        <div className="dsp-band-head">
          <span className="dsp-band-title">{t('mic.level.group')}</span>
        </div>
        <p className="dsp-band-hint">{t('mic.level.groupHint')}</p>
        <div className="dsp-band-dials">
          <Dial
            labelKey="mic.level.target"
            value={voice.levelTargetDb}
            defaultValue={-18}
            min={VOICE_RANGES.levelTargetDb.min}
            max={VOICE_RANGES.levelTargetDb.max}
            unit="dB"
            step={1}
            isDisabled={!on}
            onChange={(levelTargetDb) => patch({ levelTargetDb })}
            onCommit={onCommit}
          />
          <Dial
            labelKey="mic.level.maxLift"
            value={voice.levelMaxLiftDb}
            defaultValue={18}
            min={VOICE_RANGES.levelMaxLiftDb.min}
            max={VOICE_RANGES.levelMaxLiftDb.max}
            unit="dB"
            step={1}
            isDisabled={!on}
            onChange={(levelMaxLiftDb) => patch({ levelMaxLiftDb })}
            onCommit={onCommit}
          />
        </div>
      </div>
    </ProcessorCard>
  );
};

export default MicLevelCard;
