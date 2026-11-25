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
import DspRailRow from '../dsp/DspRailRow';
import DspSectionIcon from '../dsp/DspSectionIcon';
import type { TDspSection } from '../dsp/sections';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';
import { toDb } from './MicLiveBar';
import { gateOpenness } from './micGate';
import type { IMicLevel } from './useMicLevels';

export type TMicStage =
  // The mic maker's own effects: Windows' registration, ahead of the rack,
  // and on its own row above the rack's switch (`MicOwnEffectsCard`).
  | 'own'
  | 'lowCut'
  | 'denoise'
  | 'gate'
  | 'level'
  | 'deEsser'
  | 'eq'
  | 'dynamics'
  | 'reverb'
  | 'maximizer';

export const MIC_STAGES: readonly {
  id: TMicStage;
  labelKey: TranslationKey;
}[] = [
  { id: 'lowCut', labelKey: 'mic.stage.lowCut' },
  { id: 'denoise', labelKey: 'mic.stage.cleaner' },
  { id: 'gate', labelKey: 'mic.stage.gate' },
  // After the gate, where the engine runs it (`voice_level.h`).
  { id: 'level', labelKey: 'mic.stage.level' },
  { id: 'deEsser', labelKey: 'mic.stage.deEsser' },
  { id: 'eq', labelKey: 'mic.stage.eq' },
  { id: 'dynamics', labelKey: 'mic.stage.compressor' },
  // After Dynamics and before the Maximizer, where the engine runs it
  // (`reverb.h`): the limiter holds the voice and its tail together.
  { id: 'reverb', labelKey: 'mic.stage.reverb' },
  { id: 'maximizer', labelKey: 'mic.stage.limiter' },
];

/** Whether a stage is doing anything to the voice right now. */
/** The stages whose delay the engine reports (`latency.parts`). */
const DELAY_STAGES: ReadonlySet<TMicStage> = new Set<TMicStage>([
  'denoise',
  'deEsser',
  'maximizer',
]);

export const micStageOn = (settings: IDspSettings, stage: TMicStage) => {
  const { voice } = settings;
  switch (stage) {
    case 'own':
      // Not the rack's: its own row reads Windows' registration.
      return false;
    case 'lowCut':
      return Boolean(
        voice?.enabled &&
        (voice.lowCutHz > 0 || voice.proximityDb > 0 || voice.deplosive > 0),
      );
    case 'gate':
      return Boolean(voice?.enabled && voice.gateEnabled);
    case 'level':
      return Boolean(voice?.enabled && voice.levelEnabled);
    case 'denoise':
      return settings.denoise.enabled && settings.denoise.voice.enabled;
    case 'deEsser':
      return settings.deEsser.enabled;
    case 'eq':
      return settings.eq.enabled;
    case 'dynamics':
      return settings.dynamics.enabled;
    case 'reverb':
      return Boolean(settings.reverb?.enabled);
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
  /** How open the gate is by its own gain, 0 to 1 (`micGate.ts`). */
  gateOpen: number,
  makeupDb: number,
): number => {
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  switch (stage) {
    case 'denoise':
      return clamp(
        level.room ? (level.room.beforeDb - level.room.afterDb) / 30 : 0,
      );
    case 'gate':
      return 0.15 + 0.85 * gateOpen;
    case 'level':
      // How far it is lifting the voice, of the 24 dB it may.
      return clamp(Math.abs(level.levelGainDb ?? 0) / 24);
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

/** A quiet level lifted to a line. */
const LevelIcon = () => (
  <svg
    className="dsp-section-icon"
    viewBox="0 0 20 20"
    width="20"
    height="20"
    aria-hidden="true"
  >
    <path className="dsp-section-icon__frame" d="M2 6 H18" />
    <path
      className="dsp-section-icon__accent"
      d="M3 16 H7 M7 16 V8 M7 8 L5 10 M7 8 L9 10 M11 16 H17"
    />
  </svg>
);

/** A sound and its tail dying away behind it. */
const ReverbIcon = () => (
  <svg
    className="dsp-section-icon"
    viewBox="0 0 20 20"
    width="20"
    height="20"
    aria-hidden="true"
  >
    <path
      className="dsp-section-icon__frame"
      d="M8 6 V14 M11 7.5 V12.5 M14 8.5 V11.5 M17 9.5 V10.5"
    />
    <path className="dsp-section-icon__accent" d="M4 3 V17" />
  </svg>
);

/** A capsule with its maker's chip beside it. */
const OwnIcon = () => (
  <svg
    className="dsp-section-icon"
    viewBox="0 0 20 20"
    width="20"
    height="20"
    aria-hidden="true"
  >
    <path
      className="dsp-section-icon__frame"
      d="M6 3.5 a2.5 2.5 0 0 1 5 0 V9 a2.5 2.5 0 0 1 -5 0 Z M3.5 8.5 a5 5 0 0 0 10 0 M8.5 13.5 V16.5"
    />
    <path className="dsp-section-icon__accent" d="M14 12 h4 v4 h-4 Z" />
  </svg>
);

const StageIcon = ({ stage }: { stage: TMicStage }) => {
  if (stage === 'own') {
    return <OwnIcon />;
  }
  if (stage === 'reverb') {
    return <ReverbIcon />;
  }
  if (stage === 'lowCut') {
    return <LowCutIcon />;
  }
  if (stage === 'gate') {
    return <GateIcon />;
  }
  if (stage === 'level') {
    return <LevelIcon />;
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
  /**
   * Each delay-adding stage's delay in ms, as the engine measures it;
   * undefined until the engine has written a status for the mic.
   */
  delays: Partial<Record<TMicStage, number>> | undefined;
  latest: React.MutableRefObject<IMicLevel | undefined>;
  /** Whether the engine is answering on this mic, so the meters move. */
  live: boolean;
  /** The mic maker's own effects: running, and whether there are any. */
  ownEffects: { on: boolean; available: boolean };
  /** Their switch, which asks Windows (`MicOwnEffectsCard`). */
  onOwnToggle: () => void;
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
  ownEffects,
  onOwnToggle,
}: IMicStageRailProps) => {
  const { t } = useTranslation();
  const meters = useRef<Partial<Record<TMicStage, HTMLSpanElement | null>>>({});
  const gateRangeDb =
    settings.voice?.enabled && settings.voice.gateEnabled
      ? settings.voice.gateRangeDb
      : undefined;
  const { makeupDb } = settings.dynamics;

  // Every row's meter from one loop, written straight into the bars: a
  // re-render per frame of seven rows is the jank the readings avoid too.
  useEffect(() => {
    const history: Partial<Record<TMicStage, number[]>> = {};
    let frame = 0;
    let open = 0;
    let animation = 0;
    const draw = () => {
      frame += 1;
      const level = latest.current;
      if (live && level && frame % METER_EVERY === 0) {
        // The gate's own gain (engine 1.32), never the mic's level, which
        // still carries the room the cleaner takes before the gate hears it.
        open =
          gateRangeDb !== undefined && level.gateGainDb !== undefined
            ? gateOpenness(level.gateGainDb, gateRangeDb)
            : 0;
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
  }, [latest, live, gateRangeDb, makeupDb]);

  const delayText = (id: TMicStage, on: boolean) => {
    // Off is no delay and no sound change: a dash, not a measurement.
    if (!on) {
      return '—';
    }
    // Not measured yet: a dash, as the header's total, never a figure from
    // the dials. Those read "0 ms" for the cleaner, which adds 61-63 ms at
    // 48 kHz (74 ms at 352.8 and 384), and the app's own 20 ms estimate was
    // as wrong, so neither stands in for the engine's reading.
    if (delays === undefined && DELAY_STAGES.has(id)) {
      return '—';
    }
    const ms = delays?.[id];
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
      {/* The maker's own effects run ahead of everything below and are not
          the rack's, so the rack's switch does not govern them: a row of
          their own, first, as the voice meets them. */}
      <DspRailRow
        name={t('mic.stage.own')}
        isOff={!ownEffects.on}
        power={{
          id: 'mic-rail-own',
          isOn: ownEffects.on,
          isDisabled: !ownEffects.available,
          onToggle: onOwnToggle,
        }}
      >
        <button
          type="button"
          className={`dsp-rail-tab${active === 'own' ? ' is-active' : ''}${
            ownEffects.on ? ' is-on' : ''
          }`}
          aria-current={active === 'own' ? 'true' : undefined}
          title={t('mic.stage.own')}
          onClick={() => onSelect('own')}
        >
          <StageIcon stage="own" />
          <span className="dsp-rail-name studio-rail__word">
            {t('mic.stage.own')}
          </span>
        </button>
      </DspRailRow>
      <div className="mic-rail__master">
        <span className="mic-rail__master-name studio-rail__word">
          {t('mic.rail.master')}
        </span>
        <span className="mic-rail__master-state studio-rail__word">
          {settings.enabled ? t('dsp.enabled') : t('dsp.bypassed')}
        </span>
        {/* Folded with the words, as each stage's switch is: left out, a
            sliver of it showed past the folded rail's edge. */}
        <span className="dsp-rail-switch studio-rail__word">
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
          <DspRailRow
            key={id}
            name={t(labelKey)}
            isOff={!on}
            power={{
              id: `mic-rail-${id}`,
              isOn: switched,
              isDisabled: !settings.enabled,
              onToggle: () => onToggle(id),
            }}
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
          </DspRailRow>
        );
      })}
      <p className="mic-rail__note studio-rail__word">{t('mic.rail.note')}</p>
    </nav>
  );
};

export default MicStageRail;
