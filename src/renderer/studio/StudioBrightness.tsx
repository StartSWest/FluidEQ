/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import WindowTimeGlyph from '../components/WindowTimeGlyph';
import {
  PERCENT_SNAPS,
  snapFraction,
  snapPercent,
} from '../utils/percentSnaps';
import { useTranslation } from '../utils/I18nContext';
import { setThemeShade, useThemeShade } from '../utils/theme';
import { THEME_SHADE_MAX, THEME_SHADE_MIN } from '../utils/themeShade';
import { useNearerEnd } from '../utils/useEditedStop';
import useLiveSlider from '../utils/useLiveSlider';
import TIME_NAME, { WINDOW_ENDS } from '../utils/windowTimeNames';
import { Setting } from './StudioSettings';

const SHADE_SPAN = THEME_SHADE_MAX - THEME_SHADE_MIN;
/** The quarters, marked where the Window colours slider marks them. */
const SHADE_SNAPS = PERCENT_SNAPS.map((snap) =>
  snapFraction(snap, THEME_SHADE_MIN, THEME_SHADE_MAX),
);

// Painted frames between two of the window's restyles while Brightness is
// dragged (useLiveSlider): each one restyles the whole window, and one a
// frame apart left the thumb stepping behind the hand (Ivan, 2026-11-18:
// "when doing the Brightness slider, also like that, so it moves smoother").
const BRIGHTNESS_REST_FRAMES = 3;

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
 * with the same quarters to fall into, marked on the track as the Window
 * colours slider marks them (Ivan, 2026-09-28: "add same snap points we have
 * for app brightness, 25% 50% etc"). Never unlit while the stage waits:
 * the window answers it whatever is playing.
 */

export default function StudioBrightness() {
  const { t } = useTranslation();
  // The thumb under the pointer, the window's restyle a frame behind it.
  const { shown: shade, set } = useLiveSlider(
    useThemeShade(),
    setThemeShade,
    BRIGHTNESS_REST_FRAMES,
  );
  const now = useNearerEnd();
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
        snaps={SHADE_SNAPS}
      />
      {/* What each end of the track is, for the eye: the slider's own value
          already says where it stands. */}
      <div className="studio-brightness__times" aria-hidden="true">
        {WINDOW_ENDS.map((time) => (
          <span
            key={time}
            className={`studio-brightness__time${time === now ? ' is-now' : ''}`}
          >
            <WindowTimeGlyph time={time} />
            {t(TIME_NAME[time])}
          </span>
        ))}
      </div>
    </div>
  );
}
