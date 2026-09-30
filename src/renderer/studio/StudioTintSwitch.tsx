/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useId, type CSSProperties } from 'react';
import TintIcon from '../icons/TintIcon';
import { useTranslation } from '../utils/I18nContext';
import { sceneAccentSwatch } from '../utils/sceneTint';
import {
  SCENE_TINT_MODE_NAMES,
  SCENE_TINT_MODE_SHORT_NAMES,
  STUDIO_TINT_MODES,
  setStudioTintMode,
  studioSkyKey,
  useRememberedSceneSky,
  useShownSceneSky,
  useStudioTintMode,
  useStudioTintSource,
} from '../utils/sceneTintStore';
import { useStudio } from './studioStore';

/**
 * What the project on the bench does to the whole window while the Studio is
 * open, so a member can see their scene as the app's theme, and feel it,
 * without leaving.
 *
 * THE STUDIO'S OWN CHOICE, never the app's (`useStudioTintMode`; Ivan,
 * 2026-09-27: "the studio options are independent of the global ones, you
 * can't modify the global ones"). Theme is the app's own choice, whatever
 * the graph's Window colours are set to, and the Studio claims nothing; the
 * other two are the graph's Colours and Ambient with the project on the
 * bench as the scene. The graph's Backdrop is not offered: there is no graph
 * here to put the scene behind, and it showed as Ambient (Ivan, 2026-09-28:
 * "remove backdrop option from studio only"). For a day the tiles set the
 * app's one mode, and picking Theme here put the whole app on Original.
 *
 * Tiles rather than the graph's single button, because the card has the room
 * and a member judging a scene wants to see every choice at once. Each wears
 * the glyph the graph's menu does for it, in the colour it would give the
 * window: the theme's accent on Theme, the scene's on the other two.
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
  const shownSky = useShownSceneSky();
  // The project's own colour on every tile that lends it, whatever is
  // chosen: the one it was last measured to have, and while it lends the
  // window its colour, the one being shown. It was only the chosen tile's,
  // only while it lent, so with Theme chosen the other three were grey dots
  // that said nothing of the scene they stand for (Ivan, 2026-09-27: "fix
  // all this crap"). The Theme tile wears the theme's own accent
  // (`--theme-accent`, `StudioStage.scss`).
  const { state } = useStudio();
  const project = source?.project ?? state.activeId;
  const rememberedSky = useRememberedSceneSky(
    project ? studioSkyKey(project) : '',
  );
  const sky = (source ? shownSky : undefined) ?? rememberedSky;
  const swatch = sky
    ? ({ '--scene-tint-swatch': sceneAccentSwatch(sky) } as CSSProperties)
    : undefined;
  return (
    <div className="studio-tint" style={swatch}>
      <span className="studio-card__eyebrow" id={titleId}>
        {t('studio.tint.label')}
      </span>
      <div
        className="studio-tiles studio-tiles--tint"
        role="group"
        aria-labelledby={titleId}
      >
        {STUDIO_TINT_MODES.map((entry) => (
          <button
            key={entry}
            type="button"
            className="studio-tile"
            aria-pressed={mode === entry}
            aria-label={t(
              entry === 'theme'
                ? 'studio.tint.theme'
                : SCENE_TINT_MODE_NAMES[entry],
            )}
            title={t(
              entry === 'theme'
                ? 'studio.tint.theme'
                : SCENE_TINT_MODE_NAMES[entry],
            )}
            onClick={() => setStudioTintMode(entry)}
          >
            <TintIcon
              className="studio-tint__glyph"
              mode={entry === 'theme' ? 'off' : entry}
            />
            <span className="studio-tile__name">
              {t(
                entry === 'theme'
                  ? 'studio.tint.theme'
                  : SCENE_TINT_MODE_SHORT_NAMES[entry],
              )}
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
