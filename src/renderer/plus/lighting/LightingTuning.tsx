/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useId, useState, type CSSProperties } from 'react';
import type { TranslationKey } from 'common/i18n/en';
import {
  LIGHTING_PULSES,
  MIN_LIGHTING_BRIGHTNESS,
  type ILightingSettings,
  type TLightingPulse,
} from 'common/lighting/lightingModel';
import { setLightingSettings } from '../../lighting/lightingStore';
import { useTranslation } from '../../utils/I18nContext';

const PULSE_KEYS: Record<TLightingPulse, TranslationKey> = {
  off: 'lighting.pulse.off',
  gentle: 'lighting.pulse.gentle',
  full: 'lighting.pulse.full',
};

/**
 * How the devices light: how bright, and how hard they jump on a beat. The
 * colours are not here on purpose — they are the scene's.
 *
 * The slider moves the value the page shows as it is dragged and saves when
 * it is let go, the way the Studio's settings do: a file written for every
 * pixel of a drag is a file written sixty times a second.
 */
export default function LightingTuning({
  settings,
}: {
  settings: ILightingSettings;
}) {
  const { t } = useTranslation();
  const brightnessId = useId();
  const [brightness, setBrightness] = useState(settings.brightness);
  useEffect(() => setBrightness(settings.brightness), [settings.brightness]);

  const position =
    (brightness - MIN_LIGHTING_BRIGHTNESS) / (1 - MIN_LIGHTING_BRIGHTNESS);
  const commit = () => {
    if (brightness !== settings.brightness) {
      setLightingSettings({ brightness });
    }
  };

  return (
    <div className="lighting-tuning">
      <div className="studio-setting">
        <div className="studio-setting__head">
          <label className="studio-setting__label" htmlFor={brightnessId}>
            {t('lighting.brightness')}
          </label>
          <span className="studio-setting__value">
            {t('lighting.brightness.value', {
              percent: Math.round(brightness * 100),
            })}
          </span>
        </div>
        <input
          id={brightnessId}
          className="studio-slider"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={position}
          style={{ '--fill': `${position * 100}%` } as CSSProperties}
          onChange={(event) =>
            setBrightness(
              MIN_LIGHTING_BRIGHTNESS +
                Number(event.currentTarget.value) *
                  (1 - MIN_LIGHTING_BRIGHTNESS),
            )
          }
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
        />
      </div>

      <div className="lighting-tuning__pulse">
        <span className="studio-setting__label">{t('lighting.pulse')}</span>
        <div
          className="segmented"
          role="group"
          aria-label={t('lighting.pulse')}
        >
          {LIGHTING_PULSES.map((pulse) => (
            <button
              key={pulse}
              type="button"
              className={`segmented__option${settings.pulse === pulse ? ' is-selected' : ''}`}
              aria-pressed={settings.pulse === pulse}
              onClick={() => setLightingSettings({ pulse })}
            >
              {t(PULSE_KEYS[pulse])}
            </button>
          ))}
        </div>
      </div>

      <p className="lighting-tuning__hint">{t('lighting.colours.hint')}</p>
    </div>
  );
}
