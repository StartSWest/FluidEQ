/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId } from 'react';
import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import MenuPreferenceIcon from './MenuPreferenceIcon';
import {
  SLIDER_HANDLES,
  TSliderHandle,
  setSliderHandle,
  useSliderHandle,
} from '../utils/sliderHandle';

const LABELS: Readonly<Record<TSliderHandle, TranslationKey>> = {
  round: 'eq.sliders.round',
  rect: 'eq.sliders.rect',
};

/**
 * Round handles or fader caps on the EQ page's band sliders, as a row of the
 * settings in the titlebar's menu, beside how the window looks and moves
 * (Ivan, 2026-09-26: "user can change rec or circle there in menu settings").
 *
 * Two small keys drawn as what they put on the sliders, a ring and a cap,
 * rather than two words: the row has to fit beside its name in ten
 * languages, and the Russian for "rectangular" alone is wider than the
 * language list under it. Each is named for assistive tech and on hover.
 */
export default function SliderHandlePicker() {
  const { t } = useTranslation();
  const handle = useSliderHandle();
  const label = useId();

  return (
    <div className="menu-preference">
      <MenuPreferenceIcon name="sliders" />
      <span id={label} className="menu-preference__label">
        {t('eq.sliders')}
      </span>
      <span
        className="menu-preference__choices"
        role="group"
        aria-labelledby={label}
      >
        {SLIDER_HANDLES.map((option) => (
          <button
            type="button"
            key={option}
            role="menuitemradio"
            aria-checked={option === handle}
            aria-label={t(LABELS[option])}
            title={t(LABELS[option])}
            className={`menu-preference__choice${option === handle ? ' is-on' : ''}`}
            onClick={() => setSliderHandle(option)}
          >
            <span
              className={`slider-handle-glyph slider-handle-glyph--${option}`}
              aria-hidden="true"
            />
          </button>
        ))}
      </span>
    </div>
  );
}
