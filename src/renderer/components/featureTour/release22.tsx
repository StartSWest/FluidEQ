/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { ReactNode } from 'react';
import type { TranslationKey } from '../../../common/i18n';
import { useTranslation } from '../../utils/I18nContext';
import LanguagePicker from '../LanguagePicker';
import StartupPicker from '../StartupPicker';
import KaraokeBackgroundVisual from './KaraokeBackgroundVisual';
import LanguagesVisual from './LanguagesVisual';
import TrayVisual from './TrayVisual';
import type { ISlideActions } from './slides';

const POINTS = ['point1', 'point2', 'point3'] as const;

/**
 * A 2.2 slide whose "How to start" is the real control itself, from the
 * menu it lives in, rather than a button that sends the reader there: the
 * Start with Windows switch, the language menu.
 */
function ControlSlide({
  prefix,
  control,
  visual,
  values,
}: {
  prefix: 'tour.tray' | 'tour.languages';
  control: ReactNode;
  visual: ReactNode;
  values?: Record<string, string>;
}) {
  const { t } = useTranslation();
  const key = (suffix: string) => `${prefix}.${suffix}` as TranslationKey;
  return (
    <div className="tour-slide tour-slide--showcase">
      <div className="tour-slide__text">
        <span className="tour-slide__kicker">{t(key('kicker'))}</span>
        <h3 className="tour-slide__title">{t(key('title'))}</h3>
        <p className="tour-slide__lead">{t(key('lead'), values)}</p>
        <ul className="tour-showcase__points">
          {POINTS.map((point) => (
            <li key={point}>{t(key(point), values)}</li>
          ))}
        </ul>
        <div className="tour-slide__how dialog-frame__group">
          <span className="tour-slide__how-title">{t('tour.howTitle')}</span>
          <p>{t(key('how'))}</p>
          {/* The menu's own settings tray: its rows lay their glyph, name and
              control out on the tray's grid, not on their own. */}
          <div className="actions-menu__prefs">{control}</div>
        </div>
      </div>
      <figure className="tour-showcase__visual">{visual}</figure>
    </div>
  );
}

/**
 * Starting with Windows starts FluidEQ in the tray (Ivan, 2026-10-29: "is
 * there anything new? like systray minimized app"). The switch is the menu's
 * own, so turning it on here turns it on.
 */
export function TraySlide() {
  const { t } = useTranslation();
  return (
    <ControlSlide
      prefix="tour.tray"
      control={<StartupPicker />}
      visual={<TrayVisual />}
      values={{ startup: t('startup.label') }}
    />
  );
}

/** Korean and Traditional Chinese, with the menu's own language list. */
export function LanguagesSlide() {
  return (
    <ControlSlide
      prefix="tour.languages"
      control={<LanguagePicker />}
      visual={<LanguagesVisual />}
    />
  );
}

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
