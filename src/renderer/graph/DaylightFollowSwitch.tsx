/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, type ReactNode } from 'react';
import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import {
  setDaylightSource,
  useSceneDaylightSetting,
  type TDaylightSource,
} from '../utils/sceneDaylightSetting';
import Switch from '../widgets/Switch';
import { pageDaylight } from './sceneDaylight';

type TFollowed = Exclude<TDaylightSource, 'own'>;

const FOLLOWED: Record<
  TFollowed,
  { name: TranslationKey; hint: TranslationKey; glyph: ReactNode }
> = {
  brightness: {
    name: 'graph.sceneTint.daylightFollows',
    hint: 'graph.sceneTint.daylightFollowsHint',
    glyph: (
      <>
        <path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2.2-2.2a2.6 2.6 0 0 0-3.7-3.7l-.9.9" />
        <path d="M9.2 6.8a2.6 2.6 0 0 0-3.7 0L3.3 9a2.6 2.6 0 0 0 3.7 3.7l.9-.9" />
      </>
    ),
  },
  clock: {
    name: 'graph.sceneTint.daylightClock',
    hint: 'graph.sceneTint.daylightClockHint',
    glyph: (
      <>
        <circle cx="8" cy="8" r="5.5" />
        <path d="M8 5v3.2l2.2 1.4" />
      </>
    ),
  },
};

/**
 * What a Plus visualizer's time of day follows: the window's Brightness
 * (Ivan, 2026-09-29: "an option for daytime follow brightness") or the
 * computer's clock ("an option that follows the time, so when it is on it
 * follows the daytime") — one switch each, under the Daylight slider they
 * drive. Turning one on turns the other off, since a scene has one time of
 * day; turning either off leaves the scene where it is, on the slider
 * (`setDaylightSource`), so nothing on screen jumps.
 *
 * A row of the Window colours menu's own grid, drawn as Rainbow mode's switch
 * is.
 */
const DaylightFollowSwitch = ({ source }: { source: TFollowed }) => {
  const { t } = useTranslation();
  const id = useId();
  const setting = useSceneDaylightSetting();
  const isOn = setting.source === source;
  const { name, hint, glyph } = FOLLOWED[source];
  return (
    <div
      className="graph-view-menu__slider graph-view-menu__slider--switch"
      title={t(hint)}
    >
      <svg className="graph-view-menu__icon" viewBox="0 0 16 16" aria-hidden>
        {glyph}
      </svg>
      <label htmlFor={id}>{t(name)}</label>
      <span className="graph-view-menu__switch">
        <Switch
          id={id}
          isOn={isOn}
          isDisabled={false}
          handleToggle={() =>
            setDaylightSource(isOn ? 'own' : source, pageDaylight())
          }
          ariaLabel={t(name)}
        />
      </span>
    </div>
  );
};

export default DaylightFollowSwitch;
