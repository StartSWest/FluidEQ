/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useId, type CSSProperties } from 'react';
import { useTranslation } from '../utils/I18nContext';
import {
  PERCENT_SNAPS,
  snapFraction,
  snapPercent,
} from '../utils/percentSnaps';
import { setThemeShade, useThemeShade } from '../utils/theme';
import {
  THEME_SHADE_MAX,
  THEME_SHADE_MIN,
  THEME_SHADE_TRACK,
} from '../utils/themeShade';
import '../styles/ThemeShade.scss';

const TRACK_STYLE = {
  '--theme-shade-track': THEME_SHADE_TRACK,
} as CSSProperties;

/**
 * The theme, as a slider from Black to a lighter Ocean, in the amp's menu.
 * It replaced a choice of two themes: every step between them is a theme now
 * (`themeShade.ts`). The actions menu and the window-colours menu carry the
 * same value as their Brightness (`WindowBrightnessSlider`), where it also
 * walks a visualizer's colours.
 *
 * The window follows the thumb as it moves: nothing is committed on release,
 * because the colour on screen is the only way to judge where to stop. It
 * falls into the same quarters as the window's Brightness (`percentSnaps.ts`),
 * so the two never disagree about where a quarter is.
 */
const ThemeShadeSlider = () => {
  const { t } = useTranslation();
  const shade = useThemeShade();
  const id = useId();

  return (
    <div className="menu-preference">
      <label htmlFor={id} className="menu-preference__label">
        {t('theme.aria')}
      </label>
      <div className="menu-preference__control theme-shade">
        <span className="theme-shade__end" aria-hidden="true">
          {t('theme.black')}
        </span>
        <span className="theme-shade__track">
          {PERCENT_SNAPS.map((snap) => (
            <i
              key={snap}
              className="theme-shade__snap"
              style={
                {
                  '--snap-frac': snapFraction(
                    snap,
                    THEME_SHADE_MIN,
                    THEME_SHADE_MAX,
                  ),
                } as CSSProperties
              }
              aria-hidden
            />
          ))}
          <input
            id={id}
            type="range"
            className="theme-shade__range"
            style={TRACK_STYLE}
            min={THEME_SHADE_MIN}
            max={THEME_SHADE_MAX}
            step={1}
            value={shade}
            onChange={(event) =>
              setThemeShade(snapPercent(Number(event.target.value)))
            }
          />
        </span>
        <span className="theme-shade__end" aria-hidden="true">
          {t('theme.ocean')}
        </span>
      </div>
    </div>
  );
};

export default ThemeShadeSlider;
