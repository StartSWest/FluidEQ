/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The mic's stages, in the order the voice goes through them, on the DSP
 * page's own rail (`dsp-rail`), with what mockup A gave each row (Ivan's
 * pick, 2026-11-23): its own switch, which turns the stage fully off; the
 * delay it adds, as the engine measures it; and a small live meter of what
 * it is doing to the voice. Over them, the whole mic on or off. The two
 * Voice stages draw their glyphs in the same two strokes as every other
 * stage's (`DspSectionIcon`).
 */

import { useEffect, useRef } from 'react';
import type { IDspSettings } from '../../common/dsp/chain';
import type { TranslationKey } from '../../common/i18n';
import DspSectionIcon from '../dsp/DspSectionIcon';
import type { TDspSection } from '../dsp/sections';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';
import { GATE_HYSTERESIS_DB, toDb } from './MicLiveBar';
import type { IMicLevel } from './useMicLevels';

export type TMicStage =
  'lowCut' | 'denoise' | 'gate' | 'deEsser' | 'eq' | 'dynamics' | 'maximizer';

export const MIC_STAGES: readonly {
  id: TMicStage;
  labelKey: TranslationKey;
}[] = [
  { id: 'lowCut', labelKey: 'mic.stage.lowCut' },
  { id: 'denoise', labelKey: 'mic.stage.cleaner' },
  { id: 'gate', labelKey: 'mic.stage.gate' },
  { id: 'deEsser', labelKey: 'mic.stage.deEsser' },
  { id: 'eq', labelKey: 'mic.stage.eq' },
  { id: 'dynamics', labelKey: 'mic.stage.compressor' },
  { id: 'maximizer', labelKey: 'mic.stage.limiter' },
];

/** Whether a stage is doing anything to the voice right now. */
export const micStageOn = (settings: IDspSettings, stage: TMicStage) => {
  const { voice } = settings;
  switch (stage) {
    case 'lowCut':
      return Boolean(
        voice?.enabled &&
        (voice.lowCutHz > 0 || voice.proximityDb > 0 || voice.deplosive > 0),
      );
    case 'gate':
      return Boolean(voice?.enabled && voice.gateEnabled);
    case 'denoise':
      return settings.denoise.enabled && settings.denoise.voice.enabled;
    case 'deEsser':
      return settings.deEsser.enabled;
    case 'eq':
      return settings.eq.enabled;
    case 'dynamics':
      return settings.dynamics.enabled;
    default:
      return settings.maximizer.enabled;
  }
};

/** How many bars each row's meter keeps, oldest first. */
const METER_BARS = 5;
/** The meters move every this many painted frames: about ten times a second. */
const METER_EVERY = 6;

/**
 * What a stage's meter shows, 0 to 1: how much it is doing now. The stages
 * that only filter show the voice coming through them; the rest show their
 * own work, which is what tells a switched-on stage from a switched-off one.
 */
const meterValue = (
  stage: TMicStage,
  level: IMicLevel,
  gateOpen: boolean,
  makeupDb: number,
): number => {
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  switch (stage) {
    case 'denoise':
      return clamp(-level.noiseTakenDb / 30);
    case 'gate':
      return gateOpen ? 1 : 0.15;
    case 'dynamics':
      return clamp(
        -Math.min(0, (level.compressorGainDb ?? makeupDb) - makeupDb) / 12,
      );
    case 'maximizer':
      return clamp(-level.limiterDb / 6);
    default:
      return clamp((toDb(level.output) + 60) / 60);
  }
};

/** A low cut's slope, and the voice standing clear above it. */
const LowCutIcon = () => (
  <svg
    className="dsp-section-icon"
    viewBox="0 0 20 20"
    width="20"
    height="20"
    aria-hidden="true"
  >
    <path className="dsp-section-icon__frame" d="M2 16 C5 16 6 7 9 7 H18" />
    <path
      className="dsp-section-icon__accent"
      d="M13 4 V12 M11 9.5 L13 12 L15 9.5"
    />
  </svg>
);

/** A level crossing a dashed line: open above it, closed under. */
const GateIcon = () => (
  <svg
    className="dsp-section-icon"
    viewBox="0 0 20 20"
    width="20"
    height="20"
    aria-hidden="true"
  >
    <path
      className="dsp-section-icon__frame"
      d="M2 11 H4 M6 11 H8 M10 11 H12 M14 11 H16 M18 11 H18.5"
    />
    <path
      className="dsp-section-icon__accent"
      d="M2 15 H6 L8 4 L10 15 H12 L13 13 L14 15 H18"
    />
  </svg>
);

const StageIcon = ({ stage }: { stage: TMicStage }) => {
  if (stage === 'lowCut') {
    return <LowCutIcon />;
  }
  if (stage === 'gate') {
    return <GateIcon />;
  }
  return <DspSectionIcon section={stage as TDspSection} />;
};

interface IMicStageRailProps {
  heading: string;
  active: TMicStage;
  settings: IDspSettings;
  onSelect: (stage: TMicStage) => void;
  /** A stage's own switch: off fully, or back as it was. */
  onToggle: (stage: TMicStage) => void;
  /** The whole mic's rack on or off. */
  onMaster: () => void;
  /** Each delay-adding stage's delay in ms, as the engine measures it. */
  delays: Partial<Record<TMicStage, number>>;
  latest: React.MutableRefObject<IMicLevel | undefined>;
  /** Whether the engine is answering on this mic, so the meters move. */
  live: boolean;
}

const MicStageRail = ({
  heading,
  active,
  settings,
  onSelect,
  onToggle,
  onMaster,
  delays,
  latest,
  live,
}: IMicStageRailProps) => {
  const { t } = useTranslation();
  const meters = useRef<Partial<Record<TMicStage, HTMLSpanElement | null>>>({});
  const gateDb =
    settings.voice?.enabled && settings.voice.gateEnabled
      ? settings.voice.gateThresholdDb
      : undefined;
  const { makeupDb } = settings.dynamics;

  // Every row's meter from one loop, written straight into the bars: a
  // re-render per frame of seven rows is the jank the readings avoid too.
  useEffect(() => {
    const history: Partial<Record<TMicStage, number[]>> = {};
    let frame = 0;
    let open = false;
    let animation = 0;
    const draw = () => {
      frame += 1;
      const level = latest.current;
      if (live && level && frame % METER_EVERY === 0) {
        if (gateDb !== undefined) {
          const input = toDb(level.input);
          open = open ? input > gateDb - GATE_HYSTERESIS_DB : input > gateDb;
        }
        MIC_STAGES.forEach(({ id }) => {
          const bars = meters.current[id];
          if (!bars) {
            return;
          }
          const past = history[id] ?? [];
          past.push(meterValue(id, level, open, makeupDb));
          if (past.length > METER_BARS) {
            past.shift();
          }
          history[id] = past;
          Array.from(bars.children).forEach((bar, index) => {
            const value = past[index] ?? 0;
            (bar as HTMLElement).style.transform = `scaleY(${Math.max(
              0.12,
              value,
            )})`;
          });
        });
      }
      animation = requestAnimationFrame(draw);
    };
    animation = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animation);
  }, [latest, live, gateDb, makeupDb]);

  const delayText = (id: TMicStage, on: boolean) => {
    // Off is no delay and no sound change: a dash, not a measurement.
    if (!on) {
      return '—';
    }
    const ms = delays[id];
    if (ms === undefined || ms <= 0) {
      return t('dsp.latency.ms', { ms: '0' });
    }
    return t('dsp.latency.ms', {
      ms: ms >= 10 ? String(Math.round(ms)) : ms.toFixed(1).replace(/\.0$/, ''),
    });
  };

  return (
    // No heading over the stages: the header names the mic just above, and
    // its Windows name repeated here was cut to an ellipsis at every width.
    <nav className="dsp-rail mic-rail" aria-label={heading}>
      <div className="mic-rail__master">
        <span className="mic-rail__master-name studio-rail__word">
          {t('mic.rail.master')}
        </span>
        <span className="mic-rail__master-state studio-rail__word">
          {settings.enabled ? t('dsp.enabled') : t('dsp.bypassed')}
        </span>
        {/* Folded with the words, as each stage's switch is: left out, a
            sliver of it showed past the folded rail's edge. */}
        <span className="mic-rail__switch studio-rail__word">
          <Switch
            id="mic-rail-master"
            isOn={settings.enabled}
            isDisabled={false}
            handleToggle={onMaster}
            ariaLabel={t('mic.rail.master')}
          />
        </span>
      </div>
      {MIC_STAGES.map(({ id, labelKey }) => {
        const on = settings.enabled && micStageOn(settings, id);
        const switched = micStageOn(settings, id);
        return (
          <div
            key={id}
            className={`mic-rail__row${on ? '' : ' is-off'}${
              id === active ? ' is-active' : ''
            }`}
          >
            <button
              type="button"
              className={`dsp-rail-tab${id === active ? ' is-active' : ''}${
                on ? ' is-on' : ''
              }`}
              aria-current={id === active ? 'true' : undefined}
              title={t(labelKey)}
              onClick={() => onSelect(id)}
            >
              <StageIcon stage={id} />
              <span className="dsp-rail-name studio-rail__word">
                {t(labelKey)}
              </span>
              <span
                className="mic-rail__meter studio-rail__word"
                aria-hidden="true"
                ref={(element) => {
                  meters.current[id] = element;
                }}
              >
                {Array.from({ length: METER_BARS }, (_, index) => (
                  <span key={index} className="mic-rail__bar" />
                ))}
              </span>
              <span className="mic-rail__delay studio-rail__word">
                {delayText(id, on)}
              </span>
            </button>
            <span className="mic-rail__switch studio-rail__word">
              <Switch
                id={`mic-rail-${id}`}
                isOn={switched}
                isDisabled={!settings.enabled}
                handleToggle={() => onToggle(id)}
                ariaLabel={t(labelKey)}
              />
            </span>
          </div>
        );
      })}
      <p className="mic-rail__note studio-rail__word">{t('mic.rail.note')}</p>
    </nav>
  );
};

export default MicStageRail;
