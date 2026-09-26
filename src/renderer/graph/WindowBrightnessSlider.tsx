/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useId } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { setThemeShade, useThemeShade } from '../utils/theme';
import { THEME_SHADE_MAX, THEME_SHADE_MIN } from '../utils/themeShade';

/**
 * How light the window stands, beside Transparency at the head of the
 * window-colours menu and in the actions menu's tray — the two things either
 * menu sets about the window's look (Ivan, 2026-09-25: "in total I want only
 * two options brightness and transparency"; 2026-09-26: "do same in the main
 * menu … no theme").
 *
 * It is the theme's own slider (`themeShade.ts`), the one the Compact
 * player's menu shows as Dark to Light: with the theme it walks Black to a
 * lighter Ocean,
 * and while a visualizer lends the window its colours it walks those from
 * their darkest, never black, to their lightest ("if ambient is on is not
 * black is ambient color … dark to more lighter").
 *
 * Drawn exactly as Transparency under it, the menu's own slider row: a first
 * cut painted its track in the colours it walks, thickened to carry them, and
 * the two rows read as two different kinds of control (Ivan: "I dont like
 * that bring slider").
 */
const WindowBrightnessSlider = () => {
  const { t } = useTranslation();
  const shade = useThemeShade();
  const id = useId();
  return (
    <label
      className="graph-view-menu__slider"
      htmlFor={id}
      title={t('graph.sceneTint.brightnessHint')}
    >
      <svg className="graph-view-menu__icon" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M3.4 12.6l1.3-1.3M11.3 4.7l1.3-1.3" />
      </svg>
      <span>{t('graph.sceneTint.brightness')}</span>
      <input
        id={id}
        type="range"
        aria-label={t('graph.sceneTint.brightness')}
        min={THEME_SHADE_MIN}
        max={THEME_SHADE_MAX}
        step={1}
        value={shade}
        onChange={(event) => setThemeShade(Number(event.target.value))}
      />
      <span className="graph-view-menu__value" aria-hidden>
        {t('graph.scene.percent', { percent: String(shade) })}
      </span>
    </label>
  );
};

export default WindowBrightnessSlider;
