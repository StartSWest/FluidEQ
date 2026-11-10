/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties, ReactNode } from 'react';
import aurora from '../../../../assets/tour/scene-aurora.jpg';
import type { TranslationKey } from '../../../common/i18n';
import { PALETTE_PRESETS } from '../../../common/scenePalette';
import { useTranslation } from '../../utils/I18nContext';

/**
 * What a scene can hand the member to tune now, on the Studio's Tune tab:
 * its palettes as the palette control draws them (the stock Aurora and
 * Sunset, `scenePalette.ts`), a choice of three with an icon each, one
 * colour, and a slider that shows only while the choice that uses it is
 * picked. Beside it the scene's page: its package against the limit, the
 * version it is on, and the versions kept, one of them being saved.
 *
 * One loop of CSS (`_tour-release24b.scss`): the choice walks Clear, Rain,
 * Snow, and the snowfall slider comes in with Snow.
 */

const PALETTES = [
  { name: 'studioPalette.preset.aurora', stops: PALETTE_PRESETS.aurora },
  { name: 'studioPalette.preset.sunset', stops: PALETTE_PRESETS.sunset },
] as const satisfies readonly {
  name: TranslationKey;
  stops: readonly string[];
}[];

const strip = (stops: readonly string[]): CSSProperties => ({
  background: `linear-gradient(90deg, ${stops.join(', ')})`,
});

/** The choice's three icons, stroked in the chip's ink. */
const ICONS: Record<'clear' | 'rain' | 'snow', ReactNode> = {
  clear: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </>
  ),
  rain: (
    <>
      <path d="M7 15a4 4 0 1 1 1-7.9A5 5 0 0 1 17.6 9 3.5 3.5 0 0 1 17 16H7" />
      <path d="M9 18l-1 2M13 18l-1 2M17 18l-1 2" />
    </>
  ),
  snow: (
    <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 6l2.5-1.5M9.5 19.5 12 18l2.5 1.5" />
  ),
};

const CHOICES = ['clear', 'rain', 'snow'] as const;

const VERSIONS = [12, 11, 10] as const;

export default function SceneControlsVisual() {
  const { t } = useTranslation();
  return (
    <div
      className="controls-visual"
      role="img"
      aria-label={t('tour.controls.imageAlt')}
    >
      <div className="controls-visual__tune">
        <span className="controls-visual__group">
          {t('studioPalette.group')}
        </span>
        {PALETTES.map((palette) => (
          <span key={palette.name} className="controls-visual__palette">
            <small>{t(palette.name)}</small>
            <span
              className="controls-visual__strip"
              style={strip(palette.stops)}
            >
              {palette.stops.map((stop, index) => (
                <i
                  key={stop}
                  style={
                    {
                      '--stop': stop,
                      left: `${(index / (palette.stops.length - 1)) * 100}%`,
                    } as CSSProperties
                  }
                />
              ))}
            </span>
          </span>
        ))}

        <span className="controls-visual__group">
          {t('tour.controls.weather')}
        </span>
        <span className="controls-visual__chips">
          {CHOICES.map((choice) => (
            <span
              key={choice}
              className={`controls-visual__chip controls-visual__chip--${choice}`}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {ICONS[choice]}
              </svg>
              {t(`tour.controls.${choice}`)}
            </span>
          ))}
        </span>

        <span className="controls-visual__row">
          <span>{t('tour.controls.glow')}</span>
          <i className="controls-visual__swatch" />
        </span>
        <span className="controls-visual__row controls-visual__snowfall">
          <span>{t('tour.controls.snowfall')}</span>
          <span className="controls-visual__slider">
            <i />
          </span>
        </span>
      </div>

      <div className="controls-visual__page">
        <span className="controls-visual__cover">
          <img src={aurora} alt="" />
          <span className="controls-visual__version">
            {t('plus.version.short', { version: 12 })}
          </span>
        </span>
        <span className="controls-visual__size">
          <span>
            <strong>{t('studio.publish.size')}</strong>
            <small>
              {t('studio.publish.sizeOf', { size: '3.4 MB', limit: '5 MB' })}
            </small>
          </span>
          <span className="controls-visual__meter">
            <i className="is-art" />
            <i className="is-models" />
            <i className="is-code" />
          </span>
        </span>
        <span className="controls-visual__versions">
          <span className="controls-visual__versions-title">
            {t('plus.version.title')}
          </span>
          {VERSIONS.map((version, index) => (
            <span key={version} className="controls-visual__kept">
              <span>{t('plus.version.short', { version })}</span>
              {index === 0 ? (
                <small>{t('plus.version.current')}</small>
              ) : (
                <small className="controls-visual__save">
                  {index === 1
                    ? t('plus.version.keptHere')
                    : t('plus.version.saveShort')}
                </small>
              )}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
