/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { CSSProperties } from 'react';
import { useTranslation } from '../utils/I18nContext';
import {
  TINT_BRIGHTNESS_MAX,
  TINT_BRIGHTNESS_MIN,
  setTintBrightness,
  useTintBrightness,
  type TTintBrightnessMode,
} from '../utils/sceneTintBrightness';

/** The theme's own lightness, marked on the track as the middle. */
const CENTRE_FRACTION =
  -TINT_BRIGHTNESS_MIN / (TINT_BRIGHTNESS_MAX - TINT_BRIGHTNESS_MIN);

/**
 * How light the window stands in the visualizer's colours, in the
 * window-colours menu under the mode it belongs to — each of Colours,
 * Ambient and the Backdrop keeps its own (Ivan, 2026-09-25: "add another
 * slider too for the brightness so the light theme we can do more light
 * even not just transparent"). Shown signed from the theme's own lightness,
 * which the track marks at its middle.
 */
const SceneTintBrightnessSlider = ({ mode }: { mode: TTintBrightnessMode }) => {
  const { t } = useTranslation();
  const brightness = useTintBrightness(mode);
  let shown = '0';
  if (brightness > 0) {
    shown = `+${brightness}`;
  } else if (brightness < 0) {
    shown = `−${-brightness}`;
  }
  return (
    <label
      className="graph-view-menu__slider"
      htmlFor={`scene-look-brightness-${mode}`}
      title={t('graph.sceneTint.brightnessHint')}
    >
      <svg className="graph-view-menu__icon" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M3.4 12.6l1.3-1.3M11.3 4.7l1.3-1.3" />
      </svg>
      <span>{t('graph.sceneTint.brightness')}</span>
      <span className="graph-view-menu__track">
        <i
          className="graph-view-menu__snap"
          style={{ '--snap-frac': CENTRE_FRACTION } as CSSProperties}
          aria-hidden
        />
        <input
          id={`scene-look-brightness-${mode}`}
          type="range"
          aria-label={t('graph.sceneTint.brightness')}
          min={TINT_BRIGHTNESS_MIN}
          max={TINT_BRIGHTNESS_MAX}
          step={1}
          value={brightness}
          onChange={(event) =>
            setTintBrightness(mode, Number(event.target.value))
          }
        />
      </span>
      <span className="graph-view-menu__value" aria-hidden>
        {t('graph.scene.percent', { percent: shown })}
      </span>
    </label>
  );
};

export default SceneTintBrightnessSlider;
