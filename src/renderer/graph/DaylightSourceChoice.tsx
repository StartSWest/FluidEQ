/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import {
  setDaylightSource,
  useSceneDaylightSetting,
  type TDaylightSource,
} from '../utils/sceneDaylightSetting';
import { pageDaylight } from './sceneDaylight';

const SOURCES: readonly {
  source: TDaylightSource;
  name: TranslationKey;
  hint: TranslationKey;
}[] = [
  {
    source: 'own',
    name: 'graph.sceneTint.daylightSourceOwn',
    hint: 'graph.sceneTint.daylightOwnHint',
  },
  {
    source: 'brightness',
    name: 'graph.sceneTint.daylightSourceBrightness',
    hint: 'graph.sceneTint.daylightFollowsHint',
  },
  {
    source: 'clock',
    name: 'graph.sceneTint.daylightSourceClock',
    hint: 'graph.sceneTint.daylightClockHint',
  },
];

/**
 * What a Plus visualizer's time of day follows, one row under the Daylight
 * slider it drives: nothing (the slider sets it), the window's Brightness, or
 * the computer's clock. It was two switches, one per follow, which only ever
 * stood one at a time, so the menu carried a row too many for a choice of
 * three (Ivan, 2026-10-25: "we need to fix all that mess, too many options",
 * "let's simplify this on both sides"). Leaving a follow keeps the scene
 * where it was, on the slider (`setDaylightSource`), so nothing jumps.
 *
 * While the Studio is open it shows Brightness and does not move: the
 * Studio holds the time of day to its Brightness, and a choice made there
 * would change one nothing on screen is using.
 */
const DaylightSourceChoice = () => {
  const { t } = useTranslation();
  const setting = useSceneDaylightSetting();
  const held = setting.heldByStudio === true;
  const name = t('graph.sceneTint.daylightSource');
  return (
    <div
      className="graph-view-menu__slider graph-view-menu__slider--switch"
      title={held ? t('graph.sceneTint.daylightStudioHint') : undefined}
    >
      <svg className="graph-view-menu__icon" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="5.5" />
        <path d="M8 5v3.2l2.2 1.4" />
      </svg>
      <span>{name}</span>
      <span
        className="segmented graph-view-menu__choice"
        role="radiogroup"
        aria-label={name}
      >
        {SOURCES.map(({ source, name: option, hint }) => {
          const isChosen = setting.source === source;
          return (
            <button
              key={source}
              type="button"
              role="radio"
              aria-checked={isChosen}
              className={`segmented__option${isChosen ? ' is-selected' : ''}`}
              title={t(hint)}
              disabled={held}
              onClick={() => setDaylightSource(source, pageDaylight())}
            >
              {t(option)}
            </button>
          );
        })}
      </span>
    </div>
  );
};

export default DaylightSourceChoice;
