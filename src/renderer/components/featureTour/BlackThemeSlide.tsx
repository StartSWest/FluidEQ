/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useTranslation } from '../../utils/I18nContext';
import { setTheme, useTheme } from '../../utils/theme';
import blackThemeShot from '../../../../assets/tour/black-theme.png';

/**
 * The Black theme, shown rather than described: a full capture of the EQ tab
 * in it, with a song playing, and a button that flips the live window so the
 * reader can see the change land behind the panel.
 */
export default function BlackThemeSlide() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isBlack = theme === 'black';

  return (
    <div className="tour-slide tour-slide--theme">
      <figure className="tour-slide__figure">
        <img
          className="tour-slide__shot"
          src={blackThemeShot}
          alt={t('tour.theme.imageAlt')}
        />
      </figure>

      <div className="tour-slide__text">
        <span className="tour-slide__kicker">{t('tour.theme.kicker')}</span>
        <h3 className="tour-slide__title">{t('tour.theme.title')}</h3>
        <p className="tour-slide__lead">{t('tour.theme.lead')}</p>

        <ul className="tour-slide__points">
          <li>{t('tour.theme.point1')}</li>
          <li>{t('tour.theme.point2')}</li>
          <li>{t('tour.theme.point3')}</li>
        </ul>

        <div className="tour-slide__how">
          <span className="tour-slide__how-title">
            {t('tour.theme.howTitle')}
          </span>
          <p>{t('tour.theme.how')}</p>
          <button
            type="button"
            className={`button small${isBlack ? ' subtle' : ''}`}
            onClick={() => setTheme(isBlack ? 'ocean' : 'black')}
          >
            {isBlack ? t('tour.theme.tryOcean') : t('tour.theme.tryBlack')}
          </button>
        </div>
      </div>
    </div>
  );
}
