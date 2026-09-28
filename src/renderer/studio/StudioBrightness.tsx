/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { snapPercent } from '../utils/percentSnaps';
import { useTranslation } from '../utils/I18nContext';
import { setThemeShade, useThemeShade } from '../utils/theme';
import { THEME_SHADE_MAX, THEME_SHADE_MIN } from '../utils/themeShade';
import useLiveSlider from '../utils/useLiveSlider';
import { Setting } from './StudioSettings';

const SHADE_SPAN = THEME_SHADE_MAX - THEME_SHADE_MIN;

/**
 * The whole app's Brightness, under the window's colours on the Tune tab,
 * so a scene is tried from night to day where it is made (Ivan, 2026-09-27:
 * "add brightness to the studio that controls also the app brightness to be
 * able to test the scenes"). It is the theme's own slider, the one in Window
 * colours and the actions menu (`WindowBrightnessSlider`), not a copy for the
 * stage: every scene's Daylight follows it (`sceneDaylight.ts`), so the stage
 * turns with the window exactly as a listener's does, and what is set here is
 * the app's Brightness when the Studio closes.
 *
 * Drawn as the Studio's own rows (`Setting`), the Wave height's beside it,
 * with the same quarters to fall into. Never unlit while the stage waits:
 * the window answers it whatever is playing.
 */
export default function StudioBrightness() {
  const { t } = useTranslation();
  // The thumb under the pointer, the window's restyle a frame behind it.
  const { shown: shade, set } = useLiveSlider(useThemeShade(), setThemeShade);
  return (
    <div className="studio-brightness">
      <Setting
        label={t('graph.sceneTint.brightness')}
        hint={t('studio.brightness.hint')}
        value={t('studio.settings.percent', { percent: shade })}
        position={(shade - THEME_SHADE_MIN) / SHADE_SPAN}
        disabled={false}
        onPosition={(position) =>
          set(snapPercent(Math.round(THEME_SHADE_MIN + position * SHADE_SPAN)))
        }
      />
      <span className="studio-test__hint studio-brightness__hint">
        {t('studio.brightness.hint')}
      </span>
    </div>
  );
}
