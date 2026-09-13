/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
import { useId } from 'react';
import type { TranslationKey } from 'common/i18n/en';
import type { ILightingSettings } from 'common/lighting/lightingModel';
import {
  DEFAULT_LIGHTING_PROFILE,
  LIGHTING_EFFECTS,
  LIGHTING_FOCUS,
  LIGHTING_IDLE,
  deviceTuning,
  lightingProfile,
  type IDeviceLightingTuning,
  type ILightingProfile,
} from 'common/lighting/lightingProfiles';
import { setLightingSettings } from '../../lighting/lightingStore';
import { useTranslation } from '../../utils/I18nContext';
import LightingSlider from './LightingSlider';

const EFFECT_PATHS = {
  scene: 'M3 17 9 8l5 5 4-7 3 11M3 20h18',
  flow: 'M2 8c4-8 8 8 12 0s6 0 8 0M2 16c4-8 8 8 12 0s6 0 8 0',
  spectrum: 'M4 16V9m5 11V3m6 15V6m5 10v-5',
  pulse: 'M1 12h5l3-8 5 16 4-8h5',
};

export default function LightingProfileTuning({
  settings,
  sceneId,
  target,
  targetName,
  shared,
  keyboardFit,
}: {
  settings: ILightingSettings;
  sceneId?: string;
  target: string;
  targetName: string;
  shared?: string;
  keyboardFit?: boolean;
}) {
  const { t } = useTranslation();
  const reverseId = useId();
  const profile = lightingProfile(settings.profiles, sceneId);
  const tuning =
    target === 'all' ? profile.tuning : deviceTuning(profile, target);
  const save = (next: ILightingProfile) => {
    if (sceneId) {
      setLightingSettings({
        profiles: { ...settings.profiles, [sceneId]: next },
      });
    }
  };
  const tune = (change: Partial<IDeviceLightingTuning>) =>
    save(
      target === 'all'
        ? { ...profile, tuning: { ...profile.tuning, ...change } }
        : {
            ...profile,
            devices: {
              ...profile.devices,
              [target]: { ...profile.devices[target], ...change },
            },
          },
    );
  const reset = () => {
    if (target === 'all') {
      save(DEFAULT_LIGHTING_PROFILE);
    } else {
      save({
        ...profile,
        devices: Object.fromEntries(
          Object.entries(profile.devices).filter(([key]) => key !== target),
        ),
      });
    }
  };
  const slider = (
    key:
      | 'brightness'
      | 'backgroundBrightness'
      | 'foregroundBrightness'
      | 'sceneScale'
      | 'sceneOffsetX'
      | 'sceneOffsetY'
      | 'sensitivity'
      | 'speed'
      | 'saturation'
      | 'smoothing'
      | 'spread',
    label: TranslationKey,
    min = 0,
    max = 1,
  ) => (
    <LightingSlider
      key={`${target}:${key}`}
      label={t(label)}
      value={tuning[key]}
      min={min}
      max={max}
      onCommit={(value) => tune({ [key]: value })}
    />
  );

  return (
    <div className="lighting-tuning">
      <div className="lighting-editor__head">
        <div>
          <span className="studio-card__eyebrow">
            {t('lighting.tuning.title')}
          </span>
          <h3>{targetName}</h3>
        </div>
        <button
          type="button"
          className="button small subtle"
          onClick={reset}
          disabled={!sceneId}
        >
          {t('lighting.tuning.reset')}
        </button>
      </div>
      {shared && (
        <p className="lighting-editor__shared">
          {t('lighting.target.shared', { devices: shared })}
        </p>
      )}
      <fieldset className="lighting-editor__fields" disabled={!sceneId}>
        <div
          className="lighting-effects"
          role="group"
          aria-label={t('lighting.tuning.title')}
        >
          {LIGHTING_EFFECTS.map((effect) => (
            <button
              key={effect}
              type="button"
              className={`lighting-effect${tuning.effect === effect ? ' is-selected' : ''}`}
              aria-pressed={tuning.effect === effect}
              onClick={() => tune({ effect })}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={EFFECT_PATHS[effect]} />
              </svg>
              <span>{t(`lighting.effect.${effect}`)}</span>
            </button>
          ))}
        </div>
        {slider('brightness', 'lighting.brightness')}
        {tuning.effect === 'scene' &&
          slider(
            'foregroundBrightness',
            'lighting.tuning.foregroundBrightness',
            0,
            2,
          )}
        {tuning.effect === 'scene' &&
          slider(
            'backgroundBrightness',
            'lighting.tuning.backgroundBrightness',
            0,
            4,
          )}
        {tuning.effect !== 'scene' &&
          slider('sensitivity', 'lighting.tuning.sensitivity', 0.25, 2)}
        {tuning.effect === 'scene' && (
          <details className="lighting-fine lighting-alignment">
            <summary>{t('lighting.alignment.title')}</summary>
            <div>
              <p className="lighting-editor__shared">
                {t(
                  keyboardFit
                    ? 'lighting.alignment.keyboardFit'
                    : 'lighting.alignment.hint',
                )}
              </p>
              {slider('sceneScale', 'lighting.alignment.size', 0.5, 2)}
              {slider(
                'sceneOffsetX',
                'lighting.alignment.horizontal',
                -0.5,
                0.5,
              )}
              {slider('sceneOffsetY', 'lighting.alignment.vertical', -0.5, 0.5)}
              <button
                type="button"
                className="button small subtle"
                onClick={() =>
                  tune({ sceneScale: 1, sceneOffsetX: 0, sceneOffsetY: 0 })
                }
              >
                {t('lighting.alignment.reset')}
              </button>
            </div>
          </details>
        )}
        {tuning.effect === 'flow' &&
          slider('speed', 'lighting.tuning.speed', 0.1, 2)}
        {(tuning.effect === 'pulse' || tuning.effect === 'spectrum') && (
          <div className="studio-setting">
            <span className="studio-setting__label">
              {t('lighting.tuning.focus')}
            </span>
            <div
              className="segmented lighting-focus"
              role="group"
              aria-label={t('lighting.tuning.focus')}
            >
              {LIGHTING_FOCUS.map((focus) => (
                <button
                  key={focus}
                  type="button"
                  className={`segmented__option${tuning.focus === focus ? ' is-selected' : ''}`}
                  aria-pressed={tuning.focus === focus}
                  onClick={() => tune({ focus })}
                >
                  {t(`lighting.focus.${focus}`)}
                </button>
              ))}
            </div>
          </div>
        )}
        <details className="lighting-fine">
          <summary>{t('lighting.tuning.advanced')}</summary>
          <div>
            {slider('saturation', 'lighting.tuning.saturation', 0.5, 2)}
            {slider('smoothing', 'lighting.tuning.smoothing')}
            {(tuning.effect === 'flow' || tuning.effect === 'pulse') &&
              slider('spread', 'lighting.tuning.spread')}
            {(tuning.effect === 'flow' || tuning.effect === 'spectrum') && (
              <label className="lighting-reverse" htmlFor={reverseId}>
                <input
                  id={reverseId}
                  type="checkbox"
                  checked={tuning.reverse}
                  onChange={(event) =>
                    tune({ reverse: event.currentTarget.checked })
                  }
                />
                {t('lighting.tuning.reverse')}
              </label>
            )}
          </div>
        </details>
        {target === 'all' && (
          <section className="lighting-idle">
            <span className="studio-card__eyebrow">
              {t('lighting.idle.title')}
            </span>
            <div
              className="lighting-idle__choices"
              role="group"
              aria-label={t('lighting.idle.title')}
            >
              {LIGHTING_IDLE.map((idle) => (
                <button
                  key={idle}
                  type="button"
                  className={`button small${profile.idle === idle ? '' : ' subtle'}`}
                  aria-pressed={profile.idle === idle}
                  onClick={() => save({ ...profile, idle })}
                >
                  {t(`lighting.idle.${idle}`)}
                </button>
              ))}
            </div>
            <LightingSlider
              label={t('lighting.idle.brightness')}
              value={profile.idleBrightness}
              min={0.05}
              max={0.8}
              onCommit={(idleBrightness) =>
                save({ ...profile, idleBrightness })
              }
            />
            {profile.idle !== 'hold' && (
              <LightingSlider
                label={t('lighting.idle.speed')}
                value={profile.idleSpeed}
                min={0.1}
                onCommit={(idleSpeed) => save({ ...profile, idleSpeed })}
              />
            )}
          </section>
        )}
      </fieldset>
    </div>
  );
}
