/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useId } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { THEMES, setTheme, useTheme } from '../utils/theme';
import '../styles/Dsp.scss';

/**
 * The theme, in the actions menu's settings tray: both of them side by side,
 * each with a swatch of itself.
 *
 * Two choices do not need a list that has to be opened to find out what the
 * other one is — the reason the app has the segmented control at all. The
 * swatch is painted from the theme's own surface and accent, which
 * `App.scss` declares for `data-theme-swatch` beside the theme itself, so it
 * shows Ocean while Black is on and cannot drift from what picking it does.
 */
const ThemePicker = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const labelId = useId();

  return (
    <div className="menu-preference">
      <span id={labelId} className="menu-preference__label">
        {t('theme.aria')}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        className="segmented menu-preference__control"
      >
        {THEMES.map((entry) => (
          <button
            key={entry}
            type="button"
            role="menuitemradio"
            aria-checked={entry === theme}
            className={`segmented__option theme-picker__option${
              entry === theme ? ' is-selected' : ''
            }`}
            onClick={() => setTheme(entry)}
          >
            <span
              className="theme-picker__swatch"
              data-theme-swatch={entry}
              aria-hidden="true"
            />
            {t(`theme.${entry}`)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ThemePicker;
