/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, type CSSProperties } from 'react';
import type { TranslationKey } from 'common/i18n';
import { SCENE_DAYLIGHT_MAX, SCENE_DAYLIGHT_MIN } from 'common/sceneDaylight';
import { useTranslation } from '../utils/I18nContext';
import {
  PERCENT_SNAPS,
  snapFraction,
  snapPercent,
} from '../utils/percentSnaps';
import {
  setSceneDaylight,
  useSceneDaylightSetting,
  type TDaylightSource,
} from '../utils/sceneDaylightSetting';
import useLiveSlider from '../utils/useLiveSlider';
import { usePageDaylight } from './sceneDaylight';

/** What the slider's title says while something else sets it. */
const FOLLOWING_HINT: Record<TDaylightSource, TranslationKey> = {
  brightness: 'graph.sceneTint.daylightFollowingHint',
  clock: 'graph.sceneTint.daylightFollowingClockHint',
  own: 'graph.sceneTint.daylightHint',
};

/**
 * A Plus visualizer's time of day, from night (0) to full day (100), in the
 * Window colours menu under Transparency (Ivan, 2026-09-29: "if off the user
 * can select an individual time of day for the scene"). Drawn as the menu's
 * other slider rows, with the same quarters to fall into.
 *
 * While it follows Brightness or the clock (`DaylightFollowSwitch`, the rows
 * under it) it stands dimmed and does not move under the pointer — as
 * Transparency does outside the Backdrop — and shows the time of day it is
 * being given, so dragging Brightness moves this thumb too, and switching the
 * follow off leaves it exactly there.
 */
const SceneDaylightSlider = () => {
  const { t } = useTranslation();
  const setting = useSceneDaylightSetting();
  const followed = Math.round(usePageDaylight());
  const isOwn = setting.source === 'own';
  // The thumb under the pointer, the scene a frame behind it
  // (`useLiveSlider`), as Brightness above it.
  const { shown, set } = useLiveSlider(setting.daylight, setSceneDaylight);
  const daylight = isOwn ? shown : followed;
  const id = useId();
  return (
    <label
      className={`graph-view-menu__slider${isOwn ? '' : ' is-disabled'}`}
      htmlFor={id}
      title={t(FOLLOWING_HINT[setting.source])}
    >
      <svg className="graph-view-menu__icon" viewBox="0 0 16 16" aria-hidden>
        <path d="M1.5 12h13M4.5 12a3.5 3.5 0 0 1 7 0" />
        <path d="M8 3.5v2M3.2 5.6l1.3 1.3M12.8 5.6l-1.3 1.3" />
      </svg>
      <span>{t('graph.sceneTint.daylight')}</span>
      <span className="graph-view-menu__track">
        {PERCENT_SNAPS.map((snap) => (
          <i
            key={snap}
            className="graph-view-menu__snap"
            style={
              {
                '--snap-frac': snapFraction(
                  snap,
                  SCENE_DAYLIGHT_MIN,
                  SCENE_DAYLIGHT_MAX,
                ),
              } as CSSProperties
            }
            aria-hidden
          />
        ))}
        <input
          id={id}
          type="range"
          aria-label={t('graph.sceneTint.daylight')}
          min={SCENE_DAYLIGHT_MIN}
          max={SCENE_DAYLIGHT_MAX}
          step={1}
          disabled={!isOwn}
          value={daylight}
          onChange={(event) => set(snapPercent(Number(event.target.value)))}
        />
      </span>
      <span className="graph-view-menu__value" aria-hidden>
        {t('graph.scene.percent', { percent: String(daylight) })}
      </span>
    </label>
  );
};

export default SceneDaylightSlider;
