import { useId, type CSSProperties, type ReactNode } from 'react';
import type { TranslationKey } from 'common/i18n';
import { resolveParamName, type IScenePackParam } from 'common/scenePacks';
import { RESPONSE_KEYS, type ISceneResponse } from 'common/sceneResponse';
import { useTranslation } from '../utils/I18nContext';
import {
  RESPONSE_SLIDER_STEPS as STEPS,
  responseFromPosition as fromPosition,
  responseToPosition as toPosition,
} from '../utils/responseSlider';
import { SAVED_KEYS, type TTuningSaved } from './useStudioTuning';
import '../styles/StudioControls.scss';

const RESPONSE_TEXT: Record<
  keyof ISceneResponse,
  { label: TranslationKey; hint: TranslationKey }
> = {
  sensitivity: {
    label: 'studio.settings.sensitivity',
    hint: 'studio.settings.sensitivityHint',
  },
  threshold: {
    label: 'studio.settings.threshold',
    hint: 'studio.settings.thresholdHint',
  },
  attack: {
    label: 'studio.settings.attack',
    hint: 'studio.settings.attackHint',
  },
  release: {
    label: 'studio.settings.release',
    hint: 'studio.settings.releaseHint',
  },
};

interface ISliderProps {
  label: string;
  hint?: string;
  value: string;
  /** 0..1 along the track. */
  position: number;
  disabled: boolean;
  onPosition: (position: number) => void;
  onCommit: () => void;
}

/**
 * One setting: its name and value on a line, the slider under them. Moving
 * it moves the stage; letting go — the pointer, or the key that moved it —
 * saves.
 */
function Setting({
  label,
  hint,
  value,
  position,
  disabled,
  onPosition,
  onCommit,
}: ISliderProps) {
  const id = useId();
  return (
    <div className="studio-setting" title={hint}>
      <label className="studio-setting__head" htmlFor={id}>
        <span className="studio-setting__label">{label}</span>
        <span className="studio-setting__value">{value}</span>
      </label>
      <input
        id={id}
        type="range"
        className="studio-slider"
        min={0}
        max={STEPS}
        step={1}
        value={Math.round(position * STEPS)}
        aria-valuetext={value}
        disabled={disabled}
        style={{ '--fill': `${position * 100}%` } as CSSProperties}
        onChange={(event) => onPosition(Number(event.target.value) / STEPS)}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onBlur={onCommit}
      />
    </div>
  );
}

function Group({
  title,
  lead,
  canReset,
  onReset,
  children,
}: {
  title: string;
  lead: string;
  canReset: boolean;
  onReset: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section className="studio-settings__group">
      <div className="studio-settings__group-head">
        <span className="studio-settings__group-title">{title}</span>
        <button
          type="button"
          className="studio-settings__reset"
          disabled={!canReset}
          onClick={onReset}
        >
          {t('studio.settings.reset')}
        </button>
      </div>
      <span className="studio-settings__lead">{lead}</span>
      {children}
    </section>
  );
}

/** A control's value as its range reads best: few decimals for small ones. */
const formatParam = (param: IScenePackParam, value: number) => {
  const span = Math.abs(param.max - param.min);
  let digits = 0;
  if (span <= 10) {
    digits = 1;
  }
  if (span <= 2) {
    digits = 2;
  }
  return value.toFixed(digits);
};

interface IStudioSettingsProps {
  params: readonly IScenePackParam[];
  values: Readonly<Record<string, number>>;
  response: ISceneResponse;
  saved: TTuningSaved;
  /** Nothing is on the stage: the settings wait, unlit, where they will be. */
  idle: boolean;
  canResetParams: boolean;
  canResetResponse: boolean;
  onParam: (id: string, value: number) => void;
  onResponse: (key: keyof ISceneResponse, value: number) => void;
  onCommit: () => void;
  onResetParams: () => void;
  onResetResponse: () => void;
}

/**
 * The scene's settings, in the Studio's column beside the stage: its own
 * controls — the sliders its `pack.json` declares, named as it names them —
 * and how it answers the music: sensitivity, threshold, attack and release
 * (see `sceneResponse.ts`). Both move the stage as they are dragged and are
 * saved into the scene when let go, so the look and anything published carry
 * what the member settled on.
 */
export default function StudioSettings({
  params,
  values,
  response,
  saved,
  idle,
  canResetParams,
  canResetResponse,
  onParam,
  onResponse,
  onCommit,
  onResetParams,
  onResetResponse,
}: IStudioSettingsProps) {
  const { t, locale } = useTranslation();

  const responseValue = (key: keyof ISceneResponse) => {
    const value = response[key];
    if (key === 'sensitivity' || key === 'threshold') {
      return t('studio.settings.percent', { percent: Math.round(value * 100) });
    }
    return t('studio.settings.ms', { ms: Math.round(value) });
  };

  return (
    <div
      className={`studio-card studio-settings${idle ? ' is-idle' : ''}`}
      aria-disabled={idle}
    >
      <span className="studio-card__eyebrow">{t('studio.settings.title')}</span>

      <div className="studio-settings__groups">
        {params.length > 0 && (
          <Group
            title={t('studio.settings.controls')}
            lead={t('studio.settings.controlsLead')}
            canReset={canResetParams && !idle}
            onReset={onResetParams}
          >
            {params.map((param) => {
              const value = values[param.id] ?? param.value;
              const span = param.max - param.min || 1;
              return (
                <Setting
                  key={param.id}
                  label={resolveParamName(param, locale)}
                  value={formatParam(param, value)}
                  position={(value - param.min) / span}
                  disabled={idle}
                  onPosition={(position) =>
                    onParam(param.id, param.min + position * span)
                  }
                  onCommit={onCommit}
                />
              );
            })}
          </Group>
        )}

        <Group
          title={t('studio.settings.response')}
          lead={t('studio.settings.responseLead')}
          canReset={canResetResponse && !idle}
          onReset={onResetResponse}
        >
          {RESPONSE_KEYS.map((key) => (
            <Setting
              key={key}
              label={t(RESPONSE_TEXT[key].label)}
              hint={t(RESPONSE_TEXT[key].hint)}
              value={responseValue(key)}
              position={toPosition(key, response[key])}
              disabled={idle}
              onPosition={(position) =>
                onResponse(key, fromPosition(key, position))
              }
              onCommit={onCommit}
            />
          ))}
        </Group>
      </div>

      <span
        className={`studio-settings__saved${saved === 'failed' ? ' is-failed' : ''}`}
        role="status"
      >
        {saved ? t(SAVED_KEYS[saved]) : t('studio.settings.carries')}
      </span>
    </div>
  );
}
