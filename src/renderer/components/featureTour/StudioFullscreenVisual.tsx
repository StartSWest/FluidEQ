/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import aurora from '../../../../assets/tour/scene-aurora.jpg';
import type { TranslationKey } from '../../../common/i18n';
import { useTranslation } from '../../utils/I18nContext';

/**
 * The Studio's full screen as cf3c70748 built it: the scene across the whole
 * screen, still playing, the work pane sliding up over its lower part on its
 * Tune tab, and the chat docking at the right. Over it the full-screen
 * plate's two buttons, drawn as the plate draws them (a screen with its
 * lower band, a screen with its right band), each with its key. Every word
 * is the Studio's own label.
 *
 * One loop of CSS (`_tour-release25b.scss`); under reduced motion both panes
 * stand open.
 */

const TABS: readonly TranslationKey[] = [
  'studio.work.tune',
  'studio.code.title',
  'studio.work.pictures',
  'studio.work.animations',
];

/** The work pane's Tune rows, as far along as a tuned scene leaves them. */
const ROWS = [0.62, 0.38, 0.8];

export default function StudioFullscreenVisual() {
  const { t } = useTranslation();
  return (
    <div
      className="fullscreen-visual"
      role="img"
      aria-label={t('tour.fullscreen.imageAlt')}
    >
      <div className="fullscreen-visual__screen">
        <img className="fullscreen-visual__scene" src={aurora} alt="" />

        <span className="fullscreen-visual__plate">
          <span className="fullscreen-visual__button is-pane">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <rect x="1.8" y="2.8" width="12.4" height="10.4" rx="1.6" />
              <path d="M1.8 9.2h12.4" />
            </svg>
            <kbd>Ctrl+J</kbd>
          </span>
          <span className="fullscreen-visual__button is-chat">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <rect x="1.8" y="2.8" width="12.4" height="10.4" rx="1.6" />
              <path d="M10 2.8v10.4" />
            </svg>
            <kbd>Ctrl+L</kbd>
          </span>
        </span>

        <span className="fullscreen-visual__pane">
          <i className="fullscreen-visual__grip" />
          <span className="fullscreen-visual__tabs">
            {TABS.map((tab, index) => (
              <span
                key={tab}
                className={`fullscreen-visual__tab${index === 0 ? ' is-on' : ''}`}
              >
                {t(tab)}
              </span>
            ))}
          </span>
          {ROWS.map((at) => (
            <span key={at} className="fullscreen-visual__row">
              <i style={{ width: `${at * 100}%` }} />
            </span>
          ))}
        </span>

        <span className="fullscreen-visual__chat">
          <strong>{t('studioChat.title')}</strong>
          <span className="fullscreen-visual__mine">
            {t('tour.fullscreen.request')}
          </span>
          <span className="fullscreen-visual__step is-done">
            <i />
            {t('studioChat.step.hear')}
          </span>
          <span className="fullscreen-visual__step">
            <i />
            {t('studioChat.step.writeNow', { file: 'scene.frag' })}
          </span>
        </span>
      </div>
    </div>
  );
}
