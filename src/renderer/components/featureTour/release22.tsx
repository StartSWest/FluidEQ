/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useTranslation } from '../../utils/I18nContext';
import KaraokeBackgroundVisual from './KaraokeBackgroundVisual';
import type { ISlideActions } from './slides';

/** One focused discovery entry; the full release notes still record fixes. */
export default function KaraokeBackgroundSlide({
  actions,
}: {
  actions: ISlideActions;
}) {
  const { t } = useTranslation();
  return (
    <div className="tour-slide tour-slide--showcase">
      <div className="tour-slide__text">
        <span className="tour-slide__kicker">{t('tabs.karaoke')}</span>
        <h3 className="tour-slide__title">
          {t('tour.karaokeBackground.title')}
        </h3>
        <p className="tour-slide__lead">{t('tour.karaokeBackground.lead')}</p>
        <div className="tour-slide__how dialog-frame__group">
          <span className="tour-slide__how-title">{t('tour.howTitle')}</span>
          <p>
            {t('tour.karaokeBackground.how', {
              looks: t('graph.picker.label'),
              showGraph: t('karaoke.stage.showGraph'),
            })}
          </p>
          <button
            type="button"
            className="button small"
            onClick={() => actions.openTab('karaoke')}
          >
            {t('tour.karaokeBackground.open')}
          </button>
        </div>
      </div>
      <figure className="tour-showcase__visual">
        <KaraokeBackgroundVisual />
      </figure>
    </div>
  );
}
