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
 * switched on under its own EQ profile and volume, and how far behind it
 * plays — its own figure and, with Share Audio, another computer's.
 *
 * It replaced two captures, one per theme, that stopped matching the panel
 * the day the window lost its two themes; drawn, it wears whatever shade the
 * reader has.
 */

/** Real devices, because the feature is about the outputs people own. */
const DEVICES: {
  name: string;
  volume?: number;
  profile?: string;
  delayMs?: number;
}[] = [
  { name: 'BlackShark V2 Pro', volume: 0.72, profile: 'Gaming', delayMs: 38 },
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
                {device.delayMs !== undefined && (
                  <span className="output-art__delay">
                    <span>
                      {t('extraOutput.delay', { milliseconds: device.delayMs })}
                    </span>
                    <span>
                      {t('extraOutput.delayFrom', {
                        name: 'Laptop',
                        milliseconds: device.delayMs + 138,
                      })}
                    </span>
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
