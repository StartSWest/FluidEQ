/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useId, type CSSProperties } from 'react';
import TintIcon from '../icons/TintIcon';
import { useTranslation } from '../utils/I18nContext';
import { sceneTintSwatch } from '../utils/sceneTint';
import {
  SCENE_TINT_MODE_NAMES,
  SCENE_TINT_MODE_SHORT_NAMES,
  SCENE_TINT_MODES,
  setStudioTintMode,
  useShownSceneSky,
  useStudioTintMode,
  useStudioTintSource,
} from '../utils/sceneTintStore';

/**
 * What the project on the bench does to the whole window while the Studio is
 * open: nothing, its colours, or its colours beating with it — so a member
 * can see their scene as the app's theme, and feel it, without leaving.
 *
 * Three tiles like the test signals' above, rather than the graph's single
 * button, because the card has the room and a member judging a scene wants
 * to see all three at once. Each wears the glyph the graph's button does for
 * it, the half filled with the colour the window is taking.
 *
 * Never disabled, unlike the test controls above it. The project claims the
 * window's colour even while its scene is loading or too heavy to play, and
 * a control that could not be turned off at exactly those moments would be a
 * trap.
 */
export default function StudioTintSwitch() {
  const { t } = useTranslation();
  const titleId = useId();
  const mode = useStudioTintMode();
  const source = useStudioTintSource();
  const sky = useShownSceneSky();
  const swatch =
    mode !== 'off' && source && sky
      ? ({ '--scene-tint-swatch': sceneTintSwatch(sky) } as CSSProperties)
      : undefined;
  return (
    <div className={`studio-tint${swatch ? ' is-lit' : ''}`} style={swatch}>
      <span className="studio-card__eyebrow" id={titleId}>
        {t('studio.tint.label')}
      </span>
      <div
        className="studio-tiles studio-tiles--tint"
        role="group"
        aria-labelledby={titleId}
      >
        {SCENE_TINT_MODES.map((entry) => (
          <button
            key={entry}
            type="button"
            className="studio-tile"
            aria-pressed={mode === entry}
            aria-label={t(SCENE_TINT_MODE_NAMES[entry])}
            title={t(SCENE_TINT_MODE_NAMES[entry])}
            onClick={() => setStudioTintMode(entry)}
          >
            <TintIcon className="studio-tint__glyph" mode={entry} />
            <span className="studio-tile__name">
              {t(SCENE_TINT_MODE_SHORT_NAMES[entry])}
            </span>
          </button>
        ))}
      </div>
      <span className="studio-test__hint studio-tint__hint">
        {t('studio.tint.hint')}
      </span>
    </div>
  );
}
