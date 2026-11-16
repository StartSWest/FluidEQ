/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import {
  SCENE_TINT_CHOICES,
  SCENE_TINT_MODE_ABOUT,
  SCENE_TINT_MODE_SHORT_NAMES,
  setSceneTintMode,
  useSceneTintMode,
} from '../utils/sceneTintStore';

/**
 * What a Plus visualizer does to the window's colours, one row of three in
 * the actions menu's tray: Original, the theme, which the window's Tint
 * colours; Colours, the scene's; and Ambient, the scene's colours with its
 * light and its elements round the window (Ivan, 2026-11-16: "color =
 * original so they change the color via app color slider, then we want
 * scene color so they pick those scene colors, then scene colors plus
 * flaying things"). The scene behind the window is Transparency's, not a
 * fourth choice here.
 *
 * Drawn as the time of day's choice is drawn (`DaylightSourceChoice`), the
 * tray's own three-way row; what each does is its title.
 */
const WindowColourChoice = () => {
  const { t } = useTranslation();
  const mode = useSceneTintMode();
  const name = t('graph.sceneTint.label');
  return (
    <div className="graph-view-menu__slider graph-view-menu__slider--switch">
      <svg className="graph-view-menu__icon" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="5.5" />
        <path d="M8 2.5v11" />
        <path
          d="M8 2.5a5.5 5.5 0 0 0 0 11z"
          fill="currentColor"
          stroke="none"
        />
      </svg>
      <span>{name}</span>
      <span
        className="segmented graph-view-menu__choice"
        role="radiogroup"
        aria-label={name}
      >
        {SCENE_TINT_CHOICES.map((choice) => {
          const isChosen = mode === choice;
          return (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={isChosen}
              className={`segmented__option${isChosen ? ' is-selected' : ''}`}
              title={t(SCENE_TINT_MODE_ABOUT[choice])}
              onClick={() => setSceneTintMode(choice)}
            >
              {t(SCENE_TINT_MODE_SHORT_NAMES[choice])}
            </button>
          );
        })}
      </span>
    </div>
  );
};

export default WindowColourChoice;
