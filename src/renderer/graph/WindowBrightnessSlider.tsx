/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useMemo, type CSSProperties } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { tintThemePalette, type ISceneSky } from '../utils/sceneTint';
import { tintLiftForShade } from '../utils/sceneTintPalette';
import { useSceneTintMode, useShownSceneSky } from '../utils/sceneTintStore';
import { setThemeShade, useThemeShade } from '../utils/theme';
import {
  OCEAN_SHADE,
  THEME_SHADE_MAX,
  THEME_SHADE_MIN,
  THEME_SHADE_TRACK,
  themeShadeTokens,
} from '../utils/themeShade';

const PANEL = '--surface-panel';

/** The panes at `shade` in the sky's colours, as the window would wear them. */
const tintedPanel = (sky: ISceneSky, shade: number) =>
  tintThemePalette(themeShadeTokens(shade), sky, tintLiftForShade(shade))[
    PANEL
  ] ?? themeShadeTokens(shade)[PANEL];

const tintedTrack = (sky: ISceneSky) =>
  `linear-gradient(in oklab 90deg, ${tintedPanel(sky, THEME_SHADE_MIN)}, ${tintedPanel(
    sky,
    OCEAN_SHADE,
  )} ${OCEAN_SHADE}%, ${tintedPanel(sky, THEME_SHADE_MAX)})`;

/**
 * How light the window stands, at the head of the window-colours menu beside
 * Transparency — the two things that menu sets (Ivan, 2026-09-25: "in total
 * I want only two options brightness and transparency").
 *
 * It is the theme's own slider (`themeShade.ts`), the one the actions menu
 * shows as Dark to Light: with the theme it walks Black to a lighter Ocean,
 * and while a visualizer lends the window its colours it walks those from
 * their darkest, never black, to their lightest ("if ambient is on is not
 * black is ambient color … dark to more lighter"). The track is painted in
 * whichever of the two the window is wearing, so it shows where the thumb
 * will take it.
 */
const WindowBrightnessSlider = () => {
  const { t } = useTranslation();
  const shade = useThemeShade();
  const mode = useSceneTintMode();
  const sky = useShownSceneSky();
  const isTinted = mode !== 'off' && sky !== undefined;
  const track = useMemo(
    () =>
      ({
        '--brightness-track':
          isTinted && sky ? tintedTrack(sky) : THEME_SHADE_TRACK,
      }) as CSSProperties,
    [isTinted, sky],
  );
  return (
    <label
      className="graph-view-menu__slider graph-view-menu__slider--brightness"
      htmlFor="scene-look-brightness"
      title={t('graph.sceneTint.brightnessHint')}
    >
      <svg className="graph-view-menu__icon" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M3.4 12.6l1.3-1.3M11.3 4.7l1.3-1.3" />
      </svg>
      <span>{t('graph.sceneTint.brightness')}</span>
      <input
        id="scene-look-brightness"
        type="range"
        aria-label={t('graph.sceneTint.brightness')}
        style={track}
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
