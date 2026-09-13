/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { CSSProperties } from 'react';
import TintIcon from '../icons/TintIcon';
import { useTranslation } from '../utils/I18nContext';
import { sceneTintSwatch } from '../utils/sceneTint';
import {
  SCENE_TINT_MODE_NAMES,
  SCENE_TINT_MODES,
  setSceneTintMode,
  useSceneTintMode,
  useShownSceneSky,
} from '../utils/sceneTintStore';

/**
 * What the Plus visualizer does to the window — nothing, its colours, or its
 * colours beating with it — one press to the next of the three.
 *
 * A single button walking the three rather than a menu, because it stands in
 * the palette toggle's place in a row that runs out of width first, and only
 * while a Plus visualizer is chosen: a scene brings its own colours, so the
 * palette toggle is always disabled on one. Its glyph is the mode it is in,
 * and the filled half is the colour the window is taking; its title names the
 * mode and the one a press moves to.
 *
 * Never disabled: the colour and the beat change the whole window whether or
 * not the wave is on the plot, and a control that could only be turned off
 * while something else was on would be a trap.
 */
const SceneTintToggle = () => {
  const { t } = useTranslation();
  const mode = useSceneTintMode();
  const sky = useShownSceneSky();
  const next =
    SCENE_TINT_MODES[
      (SCENE_TINT_MODES.indexOf(mode) + 1) % SCENE_TINT_MODES.length
    ];
  const label = t('graph.sceneTint.cycle', {
    mode: t(SCENE_TINT_MODE_NAMES[mode]),
    next: t(SCENE_TINT_MODE_NAMES[next]),
  });
  const swatch =
    mode !== 'off' && sky
      ? ({ '--scene-tint-swatch': sceneTintSwatch(sky) } as CSSProperties)
      : undefined;
  return (
    <button
      type="button"
      className="graph-look-step graph-look-step--toggle graph-scene-tint"
      aria-pressed={mode !== 'off'}
      aria-label={label}
      title={label}
      style={swatch}
      onClick={() => setSceneTintMode(next)}
    >
      <TintIcon mode={mode} />
    </button>
  );
};

export default SceneTintToggle;
