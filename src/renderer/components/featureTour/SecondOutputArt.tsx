/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties } from 'react';
import { useTranslation } from '../../utils/I18nContext';

/**
 * The Second output panel in miniature, drawn from the panel's own words
 * (`ExtraOutputs.tsx`): "One player at a time", three outputs with a headset
 * switched on under its own EQ profile and volume, and how it keeps up.
 *
 * It replaced two captures, one per theme, that stopped matching the panel
 * the day the window lost its two themes; drawn, it wears whatever shade the
 * reader has.
 */

/** Real devices, because the feature is about the outputs people own. */
const DEVICES: { name: string; volume?: number; profile?: string }[] = [
  { name: 'BlackShark V2 Pro', volume: 0.72, profile: 'Gaming' },
  { name: 'Speakers (Realtek Audio)' },
  { name: 'LG TV (HDMI)' },
];

export default function SecondOutputArt() {
  const { t } = useTranslation();
  const [on] = DEVICES;
  return (
    <div
      className="output-art"
      role="img"
      aria-label={t('tour.output.imageAlt')}
    >
      <div className="output-art__panel">
        <span className="output-art__head">
          <strong>{t('extraOutput.title')}</strong>
          <span className="output-art__status">{on.name}</span>
        </span>

        <span className="output-art__rule">
          <span className="output-art__switch is-on" />
          <span>{t('extraOutput.singlePlayer')}</span>
        </span>

        <ul className="output-art__devices">
          {DEVICES.map((device) => (
            <li
              key={device.name}
              className={device.volume === undefined ? undefined : 'is-on'}
            >
              <span
                className={`output-art__switch${
                  device.volume === undefined ? '' : ' is-on'
                }`}
              />
              <span className="output-art__device">
                <strong>{device.name}</strong>
                {device.profile && (
                  <span className="output-art__profile">
                    <small>{t('extraOutput.profile')}</small>
                    {device.profile}
                  </span>
                )}
                {device.volume !== undefined && (
                  <span
                    className="output-art__volume"
                    style={{ '--level': device.volume } as CSSProperties}
                  >
                    <span />
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>

        <span className="output-art__mode-title">
          {t('extraOutput.mode.title')}
        </span>
        <span className="output-art__modes">
          <span className="is-chosen">
            <strong>{t('extraOutput.mode.video.title')}</strong>
            <small>{t('extraOutput.mode.video.buffer')}</small>
          </span>
          <span>
            <strong>{t('extraOutput.mode.music.title')}</strong>
            <small>{t('extraOutput.mode.music.buffer')}</small>
          </span>
        </span>
      </div>
    </div>
  );
}
